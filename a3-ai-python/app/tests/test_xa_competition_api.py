import asyncio
import app.api.v1.xa_competition as xa_module

from app.api.v1.xa_competition import _analyze_job_texts, _build_industry_decisions, _extract_html_job_texts, _is_allowed_public_url, industry_jobs_analysis, monitor_professional_groups, list_job_snapshots, generate_learning_task, generate_job_ability, recommend_adaptive_learning
from app.schemas.xa_competition import LearningTaskRequest, JobAbilityRequest, AdaptiveLearningRequest


def test_job_adapter_normalizes_public_texts():
    skills, count, mode = _analyze_job_texts([
        "招聘工业视觉检测与 Python 数据处理工程师，负责质量控制。",
        "需要 Python 数据处理能力和工业视觉检测经验。",
    ], ["https://example.test/jobs.json"])
    assert mode == "public-job-http-adapter"
    assert count == 2
    assert any(item.name == "Python 数据处理" and item.current > 0 for item in skills)
    assert all(item.growth == 0 for item in skills)


def test_job_adapter_reads_category_tags_and_english_skill_aliases():
    text = xa_module._record_to_text({
        "title": "Senior React Full-stack Developer",
        "category": "Software Development",
        "tags": ["React", "REST", "Docker"],
        "description": "Build APIs and automated tests",
        "publication_date": "2026-09-09T08:00:00Z",
    })
    skills, count, mode = _analyze_job_texts([text], ["https://example.test/jobs.json"], "软件技术专业群")
    by_name = {item.name: item.current for item in skills}
    assert count == 1
    assert mode == "public-job-http-adapter"
    assert by_name["前端开发"] > 0
    assert by_name["接口开发"] > 0
    assert by_name["持续集成"] > 0


def test_public_job_feed_is_not_duplicated_across_unrelated_groups():
    texts = ["Senior React developer REST API Docker software development"]
    software = _analyze_job_texts(texts, ["https://example.test/jobs.json"], "软件技术专业群")
    vehicle = _analyze_job_texts(texts, ["https://example.test/jobs.json"], "新能源汽车技术专业群")
    assert software[1] == 1
    assert vehicle[1] == 0
    assert vehicle[2] == "public-job-http-adapter-no-matching-postings"
    alerts, recommendations, plan = _build_industry_decisions(vehicle[0], "新能源汽车技术专业群")
    assert "未发现匹配岗位" in alerts[0]["title"]
    assert recommendations and plan[0]["evidence"].endswith("0")


def test_analysis_exposes_fetched_and_group_matched_counts(monkeypatch, tmp_path):
    monkeypatch.setattr(xa_module, "SNAPSHOT_DB", tmp_path / "snapshots.db")
    async def fake_collect(_override=None):
        return [
            "Senior React developer REST API Docker software development",
            "Warehouse planner inventory WMS supply chain",
        ], ["https://example.test/jobs.json"]
    monkeypatch.setattr(xa_module, "_collect_public_job_texts", fake_collect)
    result = asyncio.run(industry_jobs_analysis(professional_group="软件技术专业群"))
    assert result.fetched_count == 2
    assert result.sample_count == 1
    assert result.sample_count < result.fetched_count


def test_public_source_cache_prevents_duplicate_reads_within_monitor_window(monkeypatch):
    xa_module._PUBLIC_SOURCE_CACHE.clear()
    calls = 0

    class Response:
        headers = {"content-type": "application/json"}
        def raise_for_status(self):
            return None
        def json(self):
            return [{"title": "Python backend developer"}]

    class Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return None
        async def get(self, _url):
            nonlocal calls
            calls += 1
            return Response()

    monkeypatch.setattr(xa_module.httpx, "AsyncClient", lambda **_kwargs: Client())
    first = asyncio.run(xa_module._collect_public_job_texts(["https://example.test/jobs.json"]))
    second = asyncio.run(xa_module._collect_public_job_texts(["https://example.test/jobs.json"]))
    assert first == second
    assert calls == 1
    xa_module._PUBLIC_SOURCE_CACHE.clear()


def test_public_source_configuration_is_loaded_from_settings(monkeypatch):
    monkeypatch.delenv("XA_PUBLIC_JOB_SOURCES", raising=False)
    monkeypatch.setattr(xa_module.settings, "xa_public_job_sources", "https://example.test/public-jobs.json")
    # The collector should select the configured URL even when no request override is supplied.
    # Network access is not needed: an invalid test host simply yields no rows and confirms
    # that configuration resolution does not fall back to normalized demo rows prematurely.
    texts, urls = asyncio.run(xa_module._collect_public_job_texts())
    assert texts == []
    assert urls == []


def test_html_job_adapter_extracts_job_posting_records():
    html = '<article><h2>工业视觉检测工程师</h2><p>负责缺陷识别和质量控制</p></article><article><h2>PLC 调试员</h2><p>负责产线调试</p></article>'
    assert len(_extract_html_job_texts(html)) == 2


def test_html_job_adapter_extracts_jobposting_jsonld():
    html = '<script type="application/ld+json">{"@type":"JobPosting","title":"数据标注工程师","description":"负责数据标注"}</script>'
    assert "数据标注工程师" in _extract_html_job_texts(html)[0]


def test_analysis_endpoint_has_explicit_source_and_safety_fields(monkeypatch, tmp_path):
    monkeypatch.delenv("XA_PUBLIC_JOB_SOURCES", raising=False)
    monkeypatch.setattr(xa_module.settings, "xa_public_job_sources", "")
    monkeypatch.setattr(xa_module, "SNAPSHOT_DB", tmp_path / "snapshots.db")
    result = asyncio.run(industry_jobs_analysis())
    assert result.sample_count == 0
    assert result.fetched_count == 0
    assert result.collection_mode
    assert result.source_urls or result.collection_mode == "no-public-source-normalized-sample"
    assert result.safety_notice
    assert result.ai_generated is False
    assert result.trend_source == "normalized-interpolation"
    assert result.optimization_plan
    assert all(set(("priority", "target", "action", "evidence")) <= set(item) for item in result.optimization_plan)


def test_learning_task_changes_by_job_context():
    battery = asyncio.run(generate_learning_task(LearningTaskRequest(work_task="新能源汽车电池包拆装与绝缘检测")))
    robot = asyncio.run(generate_learning_task(LearningTaskRequest(work_task="工业机器人坐标系切换与轨迹校准", job_name="工业机器人系统运维员")))
    assert battery.skill_points != robot.skill_points
    assert any("高压" in item for item in battery.safety_points)
    assert any("示教" in item for item in robot.skill_points)
    assert "学习任务" in battery.task_description


def test_learning_task_uses_industry_and_professional_context():
    result = asyncio.run(generate_learning_task(LearningTaskRequest(
        work_task="工业视觉检测缺陷复核", job_name="工业视觉检测工程师",
        professional_group="智能制造专业群", industry_context="智能工厂质量追溯与机器视觉产线",
        ability_focus=["缺陷判定", "质量复核"],
    )))
    assert "智能制造专业群" in result.task_description
    assert "智能工厂质量追溯" in result.work_context
    assert any("缺陷" in item or "质量" in item for item in result.skill_points)
    assert result.resources and result.resources[0].href.startswith("/resources?search=")


def test_learning_task_preserves_explicit_ability_focus():
    result = asyncio.run(generate_learning_task(LearningTaskRequest(work_task="用户权限模块开发", ability_focus=["接口设计", "安全测试"])))
    assert "接口设计、安全测试" in result.task_description
    assert "接口设计" in result.skill_points
    assert result.generation_mode == "rule-template"


def test_job_ability_declares_generation_mode():
    result = asyncio.run(generate_job_ability(JobAbilityRequest(job_name="工业机器人系统运维员")))
    assert result.generation_mode == "rule-template"


def test_industry_analysis_switches_professional_group(monkeypatch, tmp_path):
    monkeypatch.setattr(xa_module.settings, "xa_public_job_sources", "")
    monkeypatch.setattr(xa_module, "SNAPSHOT_DB", tmp_path / "snapshots.db")
    software = asyncio.run(industry_jobs_analysis(professional_group="软件技术专业群", core_job=None))
    manufacturing = asyncio.run(industry_jobs_analysis(professional_group="智能制造专业群", core_job=None))
    assert software.professional_group != manufacturing.professional_group
    assert software.core_job != manufacturing.core_job
    assert software.skills[0].name != manufacturing.skills[0].name


def test_industry_analysis_returns_time_series_for_heat_curve(monkeypatch, tmp_path):
    monkeypatch.delenv("XA_PUBLIC_JOB_SOURCES", raising=False)
    monkeypatch.setattr(xa_module.settings, "xa_public_job_sources", "")
    monkeypatch.setattr(xa_module, "SNAPSHOT_DB", tmp_path / "snapshots.db")
    result = asyncio.run(industry_jobs_analysis(professional_group="软件技术专业群"))
    assert result.trend_months == []
    assert result.trend_series == {}
    assert result.trend_source == "normalized-interpolation"


def test_job_ability_generation_maps_input_job_to_graph():
    result = asyncio.run(generate_job_ability(JobAbilityRequest(job_name="工业机器人系统运维员", professional_group="智能制造专业群")))
    assert result.job_name == "工业机器人系统运维员"
    assert "智能制造" in result.industry_chain
    assert result.typical_tasks
    assert result.abilities[0].skill_points
    assert result.abilities[0].knowledge_points


def test_job_ability_generation_uses_professional_group_context():
    ev = asyncio.run(generate_job_ability(JobAbilityRequest(job_name="维修技术员", professional_group="新能源汽车技术专业群")))
    sw = asyncio.run(generate_job_ability(JobAbilityRequest(job_name="开发工程师", professional_group="软件技术专业群")))
    assert "新能源汽车" in ev.industry_chain
    assert any("拆装" in task for task in ev.typical_tasks)
    assert "软件" in sw.industry_chain
    assert any("接口开发" in task for task in sw.typical_tasks)


def test_job_ability_can_ingest_measured_skills_and_tasks():
    result = asyncio.run(generate_job_ability(JobAbilityRequest(
        job_name="软件开发工程师", professional_group="软件技术专业群",
        observed_skills=["代码审查"], typical_tasks=["企业 API 联调与验收"],
    )))
    assert "企业 API 联调与验收" in result.typical_tasks
    assert any("代码审查" in node.skill_points for node in result.abilities)
    assert "公开来源" in result.citations[1]


def test_job_ability_generation_supports_additional_competition_professional_groups():
    logistics = asyncio.run(generate_job_ability(JobAbilityRequest(job_name="仓储规划师", professional_group="现代物流管理专业群")))
    bim = asyncio.run(generate_job_ability(JobAbilityRequest(job_name="BIM 建模师", professional_group="建筑信息模型技术专业群")))
    assert logistics.industry_chain == "现代物流产业链"
    assert any("库位" in task for task in logistics.typical_tasks)
    assert bim.industry_chain == "数字建造产业链"
    assert any("碰撞" in task for task in bim.typical_tasks)


def test_adaptive_learning_recommendation_uses_goal_and_diagnostic_scores():
    result = asyncio.run(recommend_adaptive_learning(AdaptiveLearningRequest(
        goal="备战世界职业院校技能大赛", goal_scene="competition", job_name="工业机器人系统运维员",
        assessment_scores={"K01": 42, "K02": 88},
    )))
    assert result.goal_scene == "competition"
    assert result.weak_areas[0].score == 42
    assert [item.kind for item in result.next_steps] == ["课", "岗", "赛"]
    assert result.badges


def test_adaptive_learning_uses_supplied_ability_labels():
    result = asyncio.run(recommend_adaptive_learning(AdaptiveLearningRequest(
        goal="新能源汽车岗位实训", assessment_scores={"K01": 42},
        ability_labels={"K01": "高压安全诊断"},
    )))
    assert "高压安全诊断" in result.next_steps[0].title


def test_adaptive_learning_does_not_invent_scores_without_diagnosis():
    result = asyncio.run(recommend_adaptive_learning(AdaptiveLearningRequest(goal="岗位实习准备")))
    assert result.weak_areas == []
    assert "尚未收到岗位能力诊断分数" in result.diagnostic_summary


def test_adaptive_learning_progress_accepts_completed_step_titles():
    initial = asyncio.run(recommend_adaptive_learning(AdaptiveLearningRequest(goal="岗位实习准备", assessment_scores={"K01": 42})))
    completed = asyncio.run(recommend_adaptive_learning(AdaptiveLearningRequest(goal="岗位实习准备", assessment_scores={"K01": 42}, completed_skills=[initial.next_steps[0].title])))
    assert completed.progress == 33


def test_adaptive_all_measured_dimensions_above_benchmark_uses_real_lowest_score():
    result = asyncio.run(recommend_adaptive_learning(AdaptiveLearningRequest(goal="岗位综合实训", assessment_scores={"K01": 91, "K02": 84})))
    assert result.weak_areas == []
    assert "规范操作与安全综合迁移" in result.next_steps[0].title
    assert "岗位基准已达标" in result.badges


def test_industry_decisions_follow_measured_skill_rows():
    skills, _, _ = _analyze_job_texts(["工业视觉检测 工业视觉检测 工业视觉检测"], ["https://example.test/jobs.json"], "智能制造专业群")
    alerts, recommendations, plan = _build_industry_decisions(skills, "智能制造专业群")
    assert "工业视觉检测" in alerts[0]["title"]
    assert "工业视觉检测" in recommendations[0]
    assert plan and {"priority", "target", "action", "evidence"} <= set(plan[0])


def test_real_job_snapshots_build_history_without_storing_demo_rows(tmp_path):
    original = xa_module.SNAPSHOT_DB
    xa_module.SNAPSHOT_DB = tmp_path / "snapshots.db"
    try:
        skills, _, _ = _analyze_job_texts(["工业视觉检测"], ["https://example.test/jobs.json"])
        xa_module._persist_job_snapshot("智能制造专业群", "视觉检测工程师", [], skills)
        assert not xa_module.SNAPSHOT_DB.exists()
        xa_module._persist_job_snapshot("智能制造专业群", "视觉检测工程师", ["https://example.test/jobs.json"], skills)
        newer = [item.model_copy(update={"current": min(100, item.current + 5)}) for item in skills]
        xa_module._persist_job_snapshot("智能制造专业群", "视觉检测工程师", ["https://example.test/jobs.json"], newer)
        history = xa_module._load_job_snapshot_history("智能制造专业群", "视觉检测工程师")
        months, series = xa_module._build_trend_series(newer, history)
        assert len(history) == 2
        assert len(months) == 2
        assert series["工业视觉检测"] == [skills[0].current, newer[0].current]
    finally:
        xa_module.SNAPSHOT_DB = original


def test_professional_groups_monitor_returns_cross_group_comparison():
    result = asyncio.run(monitor_professional_groups())
    assert len(result.items) >= 4
    assert {item.professional_group for item in result.items} >= {"软件技术专业群", "智能制造专业群"}
    assert all(item.leading_skill and 0 <= item.average_match <= 100 for item in result.items)


def test_professional_groups_monitor_runs_independent_groups_concurrently(monkeypatch):
    calls: list[str] = []
    async def fake_analysis(*, refresh=False, professional_group, core_job, source_urls=None):
        calls.append(professional_group)
        class Skill:
            name = "技能"
            growth = 0
            match = 80
        class Result:
            sample_count = 1
            skills = [Skill()]
            alerts = []
            collection_mode = "public-job-http-adapter"
        await asyncio.sleep(0)
        return Result()
    monkeypatch.setattr(xa_module, "industry_jobs_analysis", fake_analysis)
    result = asyncio.run(monitor_professional_groups())
    assert len(result.items) == 6
    assert len(calls) == 6


def test_analysis_accepts_runtime_public_source_override():
    result = asyncio.run(industry_jobs_analysis(source_urls="file:///not-allowed.json,https://example.test/jobs.json"))
    assert result.collection_mode == "no-public-source-normalized-sample"
    assert result.source_urls == []


def test_public_source_url_rejects_private_network_and_credentials():
    assert _is_allowed_public_url("https://remotive.com/api/remote-jobs") is True
    assert _is_allowed_public_url("http://127.0.0.1/jobs.json") is False
    assert _is_allowed_public_url("http://10.0.0.4/jobs.json") is False
    assert _is_allowed_public_url("http://localhost/jobs.json") is False
    assert _is_allowed_public_url("https://user:secret@example.test/jobs.json") is False


def test_snapshot_history_endpoint_exposes_aggregate_provenance_only(tmp_path):
    original = xa_module.SNAPSHOT_DB
    xa_module.SNAPSHOT_DB = tmp_path / "snapshots.db"
    try:
        skills, _, _ = _analyze_job_texts(["Python 接口开发"], ["https://example.test/jobs.json"], "软件技术专业群")
        xa_module._persist_job_snapshot("软件技术专业群", "软件开发工程师", ["https://example.test/jobs.json"], skills)
        result = asyncio.run(list_job_snapshots(professional_group="软件技术专业群", limit=10))
        assert len(result.items) == 1
        assert result.items[0].source_urls == ["https://example.test/jobs.json"]
        assert result.items[0].skill_summary[0].name
        assert result.safety_notice
    finally:
        xa_module.SNAPSHOT_DB = original


def test_single_public_snapshot_does_not_invent_six_month_history(monkeypatch, tmp_path):
    monkeypatch.setattr(xa_module.settings, "xa_public_job_sources", "")
    monkeypatch.setattr(xa_module, "SNAPSHOT_DB", tmp_path / "snapshots.db")
    async def fake_collect(_override=None):
        return ["Java Python 软件测试"], ["https://example.test/jobs.json"]
    monkeypatch.setattr(xa_module, "_collect_public_job_texts", fake_collect)
    result = asyncio.run(industry_jobs_analysis(professional_group="软件技术专业群"))
    assert result.trend_source == "single-public-snapshot"
    assert result.history_count == 1
    assert len(result.trend_months) == 1
    assert all(item.growth == 0 for item in result.skills)
