import asyncio
from datetime import datetime, timezone
import time
import csv
import io
import ipaddress
import json
import os
import re
import sqlite3
from html import unescape
from urllib.parse import quote_plus, urlparse
from pathlib import Path
import httpx
from fastapi import APIRouter, Query
from app.schemas.xa_competition import (IndustryAnalysisResponse, LearningTaskRequest, LearningTaskResponse, LearningResourceLink, SkillTrend, JobAbilityRequest, JobAbilityResponse, JobAbilityNode, AdaptiveLearningRequest, AdaptiveLearningResponse, AdaptiveWeakArea, AdaptiveNextStep, ProfessionalGroupMonitor, ProfessionalGroupsMonitorResponse, JobSnapshotRecord, JobSnapshotHistoryResponse)
from app.core.config import settings

router = APIRouter()

SKILL_TERMS = ("工业视觉检测", "Python 数据处理", "PLC 调试", "数字孪生建模", "工业机器人运维", "数据标注", "质量控制")
GROUP_SKILL_TERMS = {
    "软件技术专业群": ("需求分析", "Java", "Python", "前端开发", "接口开发", "软件测试", "持续集成"),
    "智能制造专业群": ("工业视觉检测", "PLC 调试", "数字孪生建模", "工业机器人运维", "设备诊断", "质量控制"),
    "机电一体化技术专业群": ("PLC 调试", "工业机器人运维", "电气控制", "传感器应用", "设备诊断", "质量控制"),
    "新能源汽车技术专业群": ("高压安全", "动力电池", "电池包拆装", "绝缘检测", "整车诊断", "质量控制"),
    "人工智能技术应用专业群": ("Python 数据处理", "数据标注", "数据清洗", "模型部署", "机器学习", "质量控制"),
    "现代物流管理专业群": ("仓储规划", "库存控制", "订单分析", "拣选优化", "物流信息系统", "供应链管理"),
    "建筑信息模型技术专业群": ("BIM 建模", "图纸识读", "参数化建模", "碰撞检查", "管线综合", "模型交付"),
}
# Public job feeds are usually English, while the dashboard labels are Chinese.
# Keep the displayed labels stable but count transparent aliases from the
# source text (title/category/tags/description). This avoids reporting a zero
# software demand merely because a posting says "React" instead of "前端开发".
GROUP_SKILL_ALIASES = {
    "软件技术专业群": {
        "需求分析": ("requirements analysis", "business analyst", "product requirements"),
        "Java": ("java",),
        "Python": ("python",),
        "前端开发": ("frontend", "front-end", "react", "vue", "html", "css"),
        "接口开发": ("api", "rest", "graphql", "backend", "back-end"),
        "软件测试": ("qa", "quality assurance", "software testing", "test engineer"),
        "持续集成": ("devops", "continuous integration", "ci/cd", "docker", "kubernetes"),
    },
    "智能制造专业群": {
        "工业视觉检测": ("machine vision", "computer vision", "visual inspection", "industrial vision"),
        "PLC 调试": ("plc", "programmable logic", "ladder logic"),
        "数字孪生建模": ("digital twin", "digital thread"),
        "工业机器人运维": ("industrial robot", "robotics", "robot maintenance"),
        "设备诊断": ("equipment diagnostics", "predictive maintenance", "condition monitoring"),
        "质量控制": ("quality control", "quality assurance", "inspection"),
    },
    "机电一体化技术专业群": {
        "PLC 调试": ("plc", "programmable logic", "ladder logic"),
        "工业机器人运维": ("industrial robot", "robotics", "robot maintenance"),
        "电气控制": ("electrical control", "electrical engineering", "motor control"),
        "传感器应用": ("sensor", "instrumentation"),
        "设备诊断": ("equipment diagnostics", "predictive maintenance", "condition monitoring"),
        "质量控制": ("quality control", "inspection"),
    },
    "新能源汽车技术专业群": {
        "高压安全": ("high voltage", "ev safety", "electrical safety"),
        "动力电池": ("battery", "lithium-ion", "energy storage"),
        "电池包拆装": ("battery pack", "pack assembly"),
        "绝缘检测": ("insulation testing", "megohmmeter"),
        "整车诊断": ("vehicle diagnostics", "automotive diagnostics", "ev diagnostics"),
        "质量控制": ("quality control", "inspection"),
    },
    "人工智能技术应用专业群": {
        "Python 数据处理": ("python", "pandas", "data processing"),
        "数据标注": ("data annotation", "data labeling", "labeling"),
        "数据清洗": ("data cleaning", "data cleansing"),
        "模型部署": ("model deployment", "mlops", "inference"),
        "机器学习": ("machine learning", "artificial intelligence", "ai/ml"),
        "质量控制": ("quality control", "quality assurance"),
    },
    "现代物流管理专业群": {
        "仓储规划": ("warehouse", "warehousing", "warehouse planning"),
        "库存控制": ("inventory", "stock control"),
        "订单分析": ("order management", "order analysis"),
        "拣选优化": ("picking", "fulfillment optimization"),
        "物流信息系统": ("warehouse management system", "wms", "logistics software"),
        "供应链管理": ("supply chain", "procurement"),
    },
    "建筑信息模型技术专业群": {
        "BIM 建模": ("bim", "building information modeling"),
        "图纸识读": ("construction drawings", "blueprint"),
        "参数化建模": ("parametric modeling", "revit"),
        "碰撞检查": ("clash detection", "coordination"),
        "管线综合": ("mep", "mechanical electrical plumbing"),
        "模型交付": ("model delivery", "digital construction"),
    },
}
SAMPLE_ROWS = [("工业视觉检测", 86, 66, 78), ("Python 数据处理", 74, 61, 92), ("PLC 调试", 68, 64, 71), ("数字孪生建模", 53, 47, 59), ("工业机器人运维", 49, 54, 84)]
SNAPSHOT_DB = Path(__file__).resolve().parents[3] / "local_data" / "xa_job_snapshots.db"
PUBLIC_SOURCE_CACHE_TTL_SECONDS = 300
_PUBLIC_SOURCE_CACHE: dict[str, tuple[float, list[str]]] = {}


def _persist_job_snapshot(professional_group: str, core_job: str, source_urls: list[str], skills: list[SkillTrend]) -> None:
    """Persist only successful public-source aggregates; demo rows are never stored."""
    if not source_urls:
        return
    SNAPSHOT_DB.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(SNAPSHOT_DB) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS job_snapshot (id INTEGER PRIMARY KEY AUTOINCREMENT, collected_at TEXT NOT NULL, professional_group TEXT NOT NULL, core_job TEXT NOT NULL, source_urls TEXT NOT NULL, skills TEXT NOT NULL)")
        source_json = json.dumps(source_urls, ensure_ascii=False)
        skills_json = json.dumps([item.model_dump() for item in skills], ensure_ascii=False, sort_keys=True)
        # Refreshes that observe the same public payload must not manufacture a
        # second historical point. A later source change (or a later date) is
        # persisted normally and can be compared transparently.
        latest = connection.execute(
            "SELECT source_urls, skills FROM job_snapshot WHERE professional_group = ? AND core_job = ? ORDER BY id DESC LIMIT 1",
            (professional_group, core_job),
        ).fetchone()
        if latest and latest[0] == source_json and latest[1] == skills_json:
            return
        connection.execute("INSERT INTO job_snapshot (collected_at, professional_group, core_job, source_urls, skills) VALUES (datetime('now'), ?, ?, ?, ?)", (professional_group, core_job, source_json, skills_json))
        connection.commit()


def _load_job_snapshot_history(professional_group: str, core_job: str, limit: int = 6) -> list[tuple[str, list[dict]]]:
    if not SNAPSHOT_DB.exists():
        return []
    with sqlite3.connect(SNAPSHOT_DB) as connection:
        rows = connection.execute("SELECT collected_at, skills FROM job_snapshot WHERE professional_group = ? AND core_job = ? ORDER BY id DESC LIMIT ?", (professional_group, core_job, limit * 4)).fetchall()
    selected = sorted(rows, key=lambda row: row[0])[-limit:]
    return [(stamp, json.loads(skills_json)) for stamp, skills_json in selected]


def _build_trend_series(skills: list[SkillTrend], history: list[tuple[str, list[dict]]]) -> tuple[list[str], dict[str, list[int]]]:
    if len(history) >= 2:
        months = [stamp[:10] for stamp, _ in history]
        return months, {item.name: [next((int(row.get("current", 0)) for row in snapshot if row.get("name") == item.name), 0) for _, snapshot in history] for item in skills[:5]}
    if len(history) == 1:
        stamp, snapshot = history[0]
        return [stamp[:10]], {item.name: [next((int(row.get("current", 0)) for row in snapshot if row.get("name") == item.name), 0)] for item in skills[:5]}
    # No public snapshot means no defensible time series. Keep the response
    # empty so the UI can explain that a second dated collection is required.
    return [], {}


def _record_to_text(record: object) -> str:
    if isinstance(record, str):
        return record.strip()
    if isinstance(record, dict):
        tags = record.get("tags", [])
        if isinstance(tags, (list, tuple)):
            tags = " ".join(str(item) for item in tags)
        return " ".join(str(record.get(key, "")) for key in ("title", "jobTitle", "name", "position", "category", "jobIndustry", "description", "jobDescription", "jobExcerpt", "content", "skills", "qualifications", "tags", "job_type", "jobType", "publication_date", "pubDate", "date")) + f" {tags}".strip()
    return ""


def _extract_html_job_texts(raw_html: str) -> list[str]:
    """Extract job records from common public HTML shapes without crawling links."""
    texts: list[str] = []
    for script in re.findall(r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>", raw_html, flags=re.I | re.S):
        try:
            payload = json.loads(unescape(script).strip())
        except (ValueError, TypeError):
            continue
        records = payload if isinstance(payload, list) else [payload]
        for record in records:
            if isinstance(record, dict) and record.get("@type") in ("JobPosting", ["JobPosting"]):
                text = _record_to_text(record)
                if text:
                    texts.append(text)
    if texts:
        return texts[:500]
    blocks = re.findall(r"<article\b[^>]*>(.*?)</article>", raw_html, flags=re.I | re.S)
    for block in blocks[:500]:
        text = re.sub(r"<[^>]+>", " ", block)
        text = re.sub(r"\s+", " ", unescape(text)).strip()
        if len(text) >= 4:
            texts.append(text)
    if texts:
        return texts
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = re.sub(r"\s+", " ", unescape(text)).strip()
    return [text[:200000]] if text else []


async def _collect_public_job_texts(source_urls_override: list[str] | None = None) -> tuple[list[str], list[str]]:
    """Fetch configured public, permission-free sources and return raw job text + URLs.

    Sources must be supplied by the deployment owner through XA_PUBLIC_JOB_SOURCES.
    JSON sources may be arrays of objects (title/description/content) or strings;
    HTML is treated as text and normalized by the analyzer. No credentials or
    personal data are accepted by this adapter.
    """
    configured_value = os.getenv("XA_PUBLIC_JOB_SOURCES") or settings.xa_public_job_sources
    configured = source_urls_override if source_urls_override is not None else configured_value.split(",")
    urls = [item.strip() for item in configured if item and _is_allowed_public_url(item.strip())][:10]
    if not urls:
        return [], []
    async def collect_one(client: httpx.AsyncClient, url: str) -> tuple[str, list[str]]:
        cached = _PUBLIC_SOURCE_CACHE.get(url)
        if cached and time.monotonic() - cached[0] < PUBLIC_SOURCE_CACHE_TTL_SECONDS:
            return url, list(cached[1])
        try:
            response = await client.get(url)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            rows: list[str] = []
            if "json" in content_type or url.lower().endswith(".json"):
                payload = response.json()
                records: object = payload
                if isinstance(payload, dict):
                    records = payload.get("items") or payload.get("jobs") or payload.get("data") or payload.get("results") or []
                if isinstance(records, dict):
                    records = records.get("items") or records.get("jobs") or records.get("data") or []
                if isinstance(records, list):
                    for record in records[:500]:
                        text = record.strip() if isinstance(record, str) else _record_to_text(record) if isinstance(record, dict) else ""
                        if text:
                            rows.append(text[:20000])
            elif "csv" in content_type or url.lower().endswith(".csv"):
                rows = [_record_to_text(record)[:20000] for record in csv.DictReader(io.StringIO(response.text)) if _record_to_text(record)]
            else:
                rows = _extract_html_job_texts(response.text)
            if rows:
                _PUBLIC_SOURCE_CACHE[url] = (time.monotonic(), list(rows))
            return url, rows
        except (httpx.HTTPError, ValueError, TypeError):
            return url, []

    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers={"User-Agent": "XA-202603-public-job-adapter/1.0"}) as client:
        results = await asyncio.gather(*(collect_one(client, url) for url in urls[:10]))
    texts = [text for _url, rows in results for text in rows]
    used = [url for url, rows in results if rows]
    return texts, used


def _is_allowed_public_url(value: str) -> bool:
    """Accept only public HTTP(S) URLs; reject local/private targets and URL credentials."""
    try:
        parsed = urlparse(value)
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            return False
        host = parsed.hostname.rstrip(".").lower()
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
            return False
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            return True
        return not (address.is_private or address.is_loopback or address.is_link_local or address.is_multicast or address.is_reserved or address.is_unspecified)
    except ValueError:
        return False


def _analyze_job_texts(texts: list[str], urls: list[str], professional_group: str | None = None) -> tuple[list[SkillTrend], int, str]:
    if not texts:
        skills = [SkillTrend(name=n, current=c, previous=c, match=m, growth=0) for n, c, _p, m in SAMPLE_ROWS]
        return skills, 0, "no-public-source-normalized-sample"
    aliases = GROUP_SKILL_ALIASES.get(professional_group or "")
    # Only count postings that actually match at least one skill alias for the
    # selected professional group. A fetched source with no matching postings
    # is reported as zero samples instead of being duplicated across groups.
    if aliases:
        lowered = [item.lower() for item in texts]
        # Generic QA/quality terms occur in unrelated industries. They may be
        # counted after a posting is selected by a domain-specific alias, but
        # must not be the reason a posting is assigned to a professional group.
        relevance_aliases = [alias for term, values in aliases.items() if term != "质量控制" for alias in (term, *values)]
        relevant = [item for item in lowered if any(alias.lower() in item for alias in relevance_aliases)]
    else:
        relevant = [item.lower() for item in texts]
    joined = "\n".join(relevant)
    total = len(relevant)
    skills: list[SkillTrend] = []
    terms = GROUP_SKILL_TERMS.get(professional_group or "", SKILL_TERMS)
    for term in terms:
        term_aliases = (term.lower(),) + tuple(aliases.get(term, ()) if aliases else ())
        count = sum(item.count(alias.lower()) for item in relevant for alias in term_aliases)
        current = round(count / max(1, total) * 100) if total else 0
        current = min(100, current)
        # A single collection cannot prove a trend. Growth remains zero until
        # an earlier successful public-source snapshot exists.
        skills.append(SkillTrend(name=term, current=current, previous=current, match=(max(45, min(96, 60 + count * 3)) if total else 0), growth=0))
    return skills, total, "public-job-http-adapter" if total else "public-job-http-adapter-no-matching-postings"


def _apply_historical_growth(skills: list[SkillTrend], history: list[tuple[str, list[dict]]]) -> list[SkillTrend]:
    if not history:
        return skills
    previous_snapshot = history[-1][1]
    previous_by_name = {str(item.get("name", "")): max(0, int(item.get("current", 0))) for item in previous_snapshot}
    enriched: list[SkillTrend] = []
    for item in skills:
        previous = previous_by_name.get(item.name, item.current)
        growth = round((item.current - previous) / previous * 100) if previous > 0 else (100 if item.current > 0 else 0)
        enriched.append(item.model_copy(update={"previous": previous, "growth": growth}))
    return enriched


def _build_industry_decisions(skills: list[SkillTrend], professional_group: str) -> tuple[list[dict[str, str]], list[str], list[dict[str, str]]]:
    """Derive alerts and curriculum actions from the measured skill rows."""
    alerts: list[dict[str, str]] = []
    recommendations: list[str] = []
    optimization_plan: list[dict[str, str]] = []
    if skills and max(item.current for item in skills) == 0:
        alerts.append({"title": "当前公开源未发现匹配岗位", "detail": f"本次公开源已成功读取，但没有检出与{professional_group}技能词相关的岗位；不能把其他专业群岗位计入本专业群。"})
        recommendations.append(f"为{professional_group}补充相关公开岗位源，或由专业负责人复核岗位关键词映射")
        optimization_plan.append({"priority": "中", "target": "岗位源与关键词", "action": f"为{professional_group}补充相关公开岗位源，或由专业负责人复核岗位关键词映射", "evidence": "当前公开源匹配岗位数为 0"})
        return alerts, recommendations, optimization_plan
    rising = sorted((item for item in skills if item.growth > 0), key=lambda item: item.growth, reverse=True)
    if rising:
        lead = rising[0]
        alerts.append({"title": f"{lead.name}需求上升", "detail": f"当前趋势较前期上升 {lead.growth}%，建议复核该技能在专业群中的课程覆盖。"})
        recommendations.append(f"在{professional_group}增设或强化“{lead.name}”实训模块")
        optimization_plan.append({"priority": "高", "target": "实训模块", "action": f"在{professional_group}增设或强化“{lead.name}”实训模块", "evidence": f"真实历史快照显示需求较前期上升 {lead.growth}%"})
    elif skills:
        # Without a prior snapshot, report concentration rather than inventing
        # a time-based growth rate.
        lead = max(skills, key=lambda item: item.current)
        baseline = sorted(item.current for item in skills)[len(skills) // 2]
        if lead.current >= max(10, baseline * 2):
            alerts.append({"title": f"{lead.name}需求集中", "detail": f"本次公开岗位样本中“{lead.name}”热度为 {lead.current}，暂缺历史快照，不能推断增长率。"})
            recommendations.append(f"复核{professional_group}是否需要强化“{lead.name}”实训模块")
            optimization_plan.append({"priority": "中", "target": "课程覆盖", "action": f"复核{professional_group}是否需要强化“{lead.name}”实训模块", "evidence": f"本次公开岗位样本热度为 {lead.current}，暂无历史快照"})
    low_match = sorted(skills, key=lambda item: item.match)
    if low_match and low_match[0].match < 75:
        gap = low_match[0]
        alerts.append({"title": f"{gap.name}专业匹配度偏低", "detail": f"岗位需求匹配度为 {gap.match}%，建议纳入基础能力单元并增加仿真实训。"})
        recommendations.append(f"将“{gap.name}”纳入{professional_group}岗位能力基础单元")
        optimization_plan.append({"priority": "中", "target": "岗位能力基础单元", "action": f"将“{gap.name}”纳入{professional_group}岗位能力基础单元", "evidence": f"专业匹配度为 {gap.match}%"})
    if not alerts:
        alerts.append({"title": "暂未发现显著预警", "detail": "当前样本中的技能趋势和专业匹配度处于常规范围，建议继续积累岗位样本。"})
    if not recommendations:
        recommendations.append(f"继续采集公开岗位数据，滚动复核{professional_group}培养方案")
        optimization_plan.append({"priority": "低", "target": "数据采集", "action": f"继续采集公开岗位数据，滚动复核{professional_group}培养方案", "evidence": "当前没有足够的可比较历史快照"})
    return alerts, recommendations, optimization_plan


@router.get("/industry/jobs-analysis", response_model=IndustryAnalysisResponse)
async def industry_jobs_analysis(
    refresh: bool = Query(default=False),
    professional_group: str = Query(default="软件技术专业群", min_length=2, max_length=80),
    core_job: str | None = Query(default=None, max_length=80),
    source_urls: str | None = Query(default=None, max_length=2000),
) -> IndustryAnalysisResponse:
    if not isinstance(professional_group, str):
        professional_group = "软件技术专业群"
    if core_job is not None and not isinstance(core_job, str):
        core_job = None
    requested_sources = source_urls.split(",") if isinstance(source_urls, str) and source_urls.strip() else None
    texts, collected_source_urls = await _collect_public_job_texts(requested_sources)
    skills, sample_count, collection_mode = _analyze_job_texts(texts, collected_source_urls, professional_group)
    # Never present unrelated policy portals as if they were the job sources
    # actually sampled.  An empty list is intentional for the normalized demo
    # mode and lets the UI explain that a deployment source still needs to be
    # configured.
    job = core_job or {
        "软件技术专业群": "软件开发工程师",
        "智能制造专业群": "工业机器人系统运维员",
        "机电一体化技术专业群": "工业机器人系统运维员",
        "新能源汽车技术专业群": "新能源汽车维修技师",
        "现代物流管理专业群": "仓储规划师",
        "建筑信息模型技术专业群": "BIM 建模师",
    }.get(professional_group, "AI 数据标注工程师")
    # A normalized fallback is not a measured trend. Only successful public
    # snapshots may establish a time-based growth rate.
    if professional_group in {"智能制造专业群", "机电一体化技术专业群"} and not texts:
        fallback_rows = [("工业机器人运维", 88, 91), ("PLC 调试", 79, 86), ("数字孪生建模", 67, 72), ("工业视觉检测", 61, 68), ("Python 数据处理", 48, 55)]
        skills = [SkillTrend(name=name, current=current, previous=current, match=match, growth=0) for name, current, match in fallback_rows]
    previous_history = _load_job_snapshot_history(professional_group, job)
    if collected_source_urls:
        skills = _apply_historical_growth(skills, previous_history)
    alerts, recommendations, optimization_plan = _build_industry_decisions(skills, professional_group)
    _persist_job_snapshot(professional_group, job, collected_source_urls, skills)
    history = _load_job_snapshot_history(professional_group, job)
    history_span_days = 0
    if len(history) >= 2:
        try:
            first = datetime.fromisoformat(history[0][0]).replace(tzinfo=timezone.utc)
            last = datetime.fromisoformat(history[-1][0]).replace(tzinfo=timezone.utc)
            history_span_days = max(0, (last - first).days)
        except ValueError:
            history_span_days = 0
    trend_history = history if history_span_days >= 1 else history[-1:]
    months, trend_series = _build_trend_series(skills, trend_history)
    trend_source = "historical-snapshots" if history_span_days >= 1 else ("single-public-snapshot" if collected_source_urls else "normalized-interpolation")
    return IndustryAnalysisResponse(
        professional_group=professional_group, core_job=job, collected_at=datetime.now(timezone.utc),
        collection_mode=collection_mode, source_urls=collected_source_urls,
        sample_count=sample_count, fetched_count=len(texts), skills=skills,
        trend_months=months, trend_series=trend_series,
        alerts=alerts, recommendations=recommendations,
        optimization_plan=optimization_plan, history_count=len(history), history_span_days=history_span_days,
        trend_source=trend_source,
        safety_notice="岗位数据仅用于专业建设分析；正式调整培养方案前需由专业负责人复核来源、样本和统计口径。",
    )


@router.get("/industry/professional-groups", response_model=ProfessionalGroupsMonitorResponse)
async def monitor_professional_groups(refresh: bool = Query(default=False), source_urls: str | None = Query(default=None, max_length=2000)) -> ProfessionalGroupsMonitorResponse:
    groups = (("软件技术专业群", "软件开发工程师"), ("智能制造专业群", "工业机器人系统运维员"), ("机电一体化技术专业群", "工业机器人系统运维员"), ("新能源汽车技术专业群", "新能源汽车维修技师"), ("现代物流管理专业群", "仓储规划师"), ("建筑信息模型技术专业群", "BIM 建模师"))
    # Warm the shared public-source cache once before analyzing six groups.
    # Without this single-flight warmup, six concurrent analyses can race and
    # issue the same four remote requests 6 times on a cold dashboard load.
    requested_sources = source_urls.split(",") if isinstance(source_urls, str) and source_urls.strip() else None
    await _collect_public_job_texts(requested_sources)
    # Fetch groups concurrently; each analysis now reuses the warmed source
    # payload and only performs local skill matching/history work.
    results = await asyncio.gather(*(
        industry_jobs_analysis(refresh=refresh, professional_group=professional_group, core_job=core_job, source_urls=source_urls)
        for professional_group, core_job in groups
    ))
    items: list[ProfessionalGroupMonitor] = []
    for (professional_group, core_job), result in zip(groups, results):
        leading = max(result.skills, key=lambda item: item.growth)
        items.append(ProfessionalGroupMonitor(professional_group=professional_group, core_job=core_job, sample_count=result.sample_count, average_match=round(sum(item.match for item in result.skills) / max(1, len(result.skills))), leading_skill=leading.name, leading_growth=leading.growth, alert_count=len(result.alerts), collection_mode=result.collection_mode))
    return ProfessionalGroupsMonitorResponse(collected_at=datetime.now(timezone.utc), items=items, safety_notice="横向监测仅用于专业建设决策支持；调整培养方案前需复核样本来源和统计口径。")


@router.get("/industry/snapshots", response_model=JobSnapshotHistoryResponse)
async def list_job_snapshots(
    professional_group: str | None = Query(default=None, max_length=80),
    core_job: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=30, ge=1, le=100),
) -> JobSnapshotHistoryResponse:
    """Expose aggregate collection provenance without raw job or personal data."""
    if professional_group is not None and not isinstance(professional_group, str):
        professional_group = None
    if core_job is not None and not isinstance(core_job, str):
        core_job = None
    if not isinstance(limit, int):
        limit = 30
    if not SNAPSHOT_DB.exists():
        rows: list[tuple[str, str, str, str, str]] = []
    else:
        clauses: list[str] = []
        params: list[object] = []
        if professional_group:
            clauses.append("professional_group = ?")
            params.append(professional_group)
        if core_job:
            clauses.append("core_job = ?")
            params.append(core_job)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        with sqlite3.connect(SNAPSHOT_DB) as connection:
            rows = connection.execute(
                f"SELECT collected_at, professional_group, core_job, source_urls, skills FROM job_snapshot{where} ORDER BY id DESC LIMIT ?",
                (*params, limit),
            ).fetchall()
    records: list[JobSnapshotRecord] = []
    for stamp, group, job, source_json, skills_json in reversed(rows):
        try:
            collected_at = datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc)
            source_urls = json.loads(source_json)
            skill_summary = [SkillTrend.model_validate(item) for item in json.loads(skills_json)]
        except (ValueError, TypeError, json.JSONDecodeError):
            continue
        records.append(JobSnapshotRecord(collected_at=collected_at, professional_group=group, core_job=job, source_urls=source_urls, skill_summary=skill_summary))
    return JobSnapshotHistoryResponse(items=records, safety_notice="仅展示公开岗位来源的聚合快照；不含岗位原文、姓名、联系方式或简历。")


@router.post("/learning-task/generate", response_model=LearningTaskResponse)
async def generate_learning_task(request: LearningTaskRequest) -> LearningTaskResponse:
    text = f"{request.job_name} {request.work_task} {request.professional_group} {request.industry_context} {' '.join(request.ability_focus)}".lower()
    if any(term in text for term in ("电池", "新能源", "高压", "绝缘")):
        steps = ["阅读工单，确认车型、电池包型号和断电等待时间", "穿戴绝缘防护用品，执行高压下电、验电与挂牌上锁", "按规定顺序拆卸连接器与紧固件，记录外观和关键参数", "完成绝缘检测、复装和质量复核，提交检测工单"]
        safety = ["高压系统作业必须执行断电、验电、挂牌上锁流程", "使用检定有效的绝缘工具并佩戴绝缘手套和护目镜"]
        knowledge = ["新能源汽车高压安全", "动力电池包结构", "绝缘电阻检测原理"]
        skills = ["高压下电", "电池包拆装", "绝缘检测", "质量工单填写"]
        resources = ["新能源汽车高压安全微课", "电池包拆装仿真练习"]
        deliverables = ["高压下电安全检查记录", "电池包拆装过程记录", "绝缘检测结果与维修工单"]
        acceptance = ["断电、验电、挂牌上锁流程无缺项", "拆装顺序和关键参数记录完整", "绝缘检测结论符合任务工单要求并经教师复核"]
        citation = "校内新能源汽车实训安全规范（需负责人补充正式编号）"
    elif any(term in text for term in ("机器人", "plc", "坐标系", "轨迹")):
        steps = ["确认机器人型号、程序版本和作业区域安全状态", "切换手动低速模式并建立工具/工件坐标系", "执行单步轨迹校准，检查奇异点、干涉和限位", "保存参数、恢复运行并提交点检与校准记录"]
        safety = ["进入机器人作业区域前必须停机并执行挂牌上锁", "示教与调试使用低速模式，人员不得进入运动包络范围"]
        knowledge = ["工业机器人坐标系", "轨迹规划原理", "安全联锁与限位"]
        skills = ["示教器操作", "坐标系标定", "轨迹校准", "报警诊断"]
        resources = ["机器人坐标系微课", "虚拟示教器仿真实训"]
        deliverables = ["作业区域安全检查表", "坐标系与轨迹参数记录", "点检和校准工单"]
        acceptance = ["安全联锁和低速示教设置符合规程", "坐标系参数可复现且轨迹无干涉", "点检、异常和恢复结果记录完整"]
        citation = "工业机器人实训操作规程（需负责人补充正式版本）"
    elif any(term in text for term in ("标注", "数据", "质检", "标签")):
        steps = ["读取项目工单和标签体系，确认边界案例与验收口径", "抽取小样本试标并与金标准对齐", "批量标注并记录不确定样本", "执行交叉质检、一致性复核和问题回流"]
        safety = ["不得导入未经脱敏的个人敏感信息", "不确定样本必须升级人工复核，不得擅自补写标签"]
        knowledge = ["数据标注规范", "标签体系设计", "抽样质检与一致性"]
        skills = ["边界判定", "标注工具操作", "一致性检查", "问题样本回流"]
        resources = ["数据合规微课", "图像标注与质检仿真实训"]
        deliverables = ["试标样本集", "批量标注结果", "质检报告与问题样本清单"]
        acceptance = ["试标结果与标签规范一致", "敏感数据已脱敏且不确定样本有标记", "抽检结果、错误类型和回流记录完整"]
        citation = "项目标注规范与数据合规要求（需负责人上传正式版本）"
    elif any(term in text for term in ("视觉", "缺陷", "机器视觉")):
        steps = ["读取视觉检测工单并确认产品型号、缺陷分类和验收阈值", "检查相机、光源和标定参数，采集标准样本", "执行缺陷识别与边界复核，记录误检和漏检样本", "完成质量追溯记录并提交复核结论"]
        safety = ["调整光源和相机前确认设备处于安全维护状态", "异常样本必须保留原始记录并由教师或质检员复核"]
        knowledge = ["机器视觉检测原理", "缺陷分类与质量标准", "相机标定与参数管理"]
        skills = ["缺陷判定", "相机标定", "质量复核", "异常样本记录"]
        resources = ["工业视觉检测微课", "机器视觉缺陷识别仿真实训"]
        deliverables = ["设备与标定参数检查表", "缺陷识别结果", "质量追溯与复核记录"]
        acceptance = ["相机、光源和标定参数记录完整", "缺陷分类符合任务验收口径", "误检、漏检和异常样本均可追溯"]
        citation = "智能制造质量检测规范（需负责人补充正式版本）"
    else:
        steps = ["阅读工单并确认设备型号、作业边界和防护用品", "执行作业前检查并记录初始状态", "按标准流程完成核心操作并记录关键参数", "依据验收标准复盘异常、提交工单和实训产出"]
        safety = ["作业前确认风险边界、工具状态和个人防护要求", "出现异常立即停止操作并升级指导教师复核"]
        knowledge = ["岗位工单与质量标准", "设备结构和操作原理", "异常诊断与记录规范"]
        skills = ["任务拆解", "规范操作", "质量记录", "异常复盘"]
        resources = ["校内实训微课", "仿真操作练习"]
        deliverables = ["作业前检查表", "核心操作过程记录", "任务工单与异常复盘"]
        acceptance = ["任务边界、安全风险和工具状态确认完整", "核心操作步骤符合岗位规范", "结果、异常和改进建议可由教师复核"]
        citation = "校内实训安全规范（需专业负责人补充正式版本）"
    for focus in request.ability_focus:
        if focus and focus not in skills:
            skills.append(focus)
    resource_links = [LearningResourceLink(name=item, href=f"/resources?search={quote_plus(item)}", resource_type="校内实训资源") for item in resources]
    learning_objectives = [f"理解{item}" for item in knowledge[:2]] + [f"能够完成{item}" for item in skills[:2]]
    return LearningTaskResponse(
        task_id="LT-20260909", task_name=request.work_task,
        task_description=f"面向{request.professional_group}的{request.job_name}学习任务：在真实岗位工作情境中完成“{request.work_task}”，重点强化{ '、'.join(request.ability_focus) if request.ability_focus else '岗位核心能力' }，形成可验收的操作记录与任务产出。",
        work_context=f"企业实训车间：围绕“{request.work_task}”完成工单交付并提交质量记录。产业背景：{request.industry_context or '依据岗位典型工作任务进行教学转化'}。",
        learning_objectives=learning_objectives, steps=steps, safety_points=safety,
        knowledge_points=knowledge, skill_points=skills, deliverables=deliverables,
        acceptance_criteria=acceptance, resources=resource_links,
        citations=["岗位任务输入（用户提供）", citation], generation_mode="rule-template",
    )


@router.post("/job-ability/generate", response_model=JobAbilityResponse)
async def generate_job_ability(request: JobAbilityRequest) -> JobAbilityResponse:
    text = f"{request.job_name} {request.professional_group}".lower()
    group_text = request.professional_group.lower()
    if any(term in group_text for term in ("新能源汽车", "汽车技术", "汽车制造")) or any(term in text for term in ("新能源", "电池", "高压下电", "整车维修")):
        chain, group, tasks = "新能源汽车产业链", "新能源汽车维修与检测岗位群", ["执行高压下电与安全确认", "完成动力电池包拆装", "开展绝缘检测并提交维修记录"]
        nodes = [JobAbilityNode(name="高压安全与诊断", score=84, ability_units=["高压系统识别", "故障诊断"], skill_points=["高压下电", "绝缘检测"], knowledge_points=["新能源汽车高压安全", "动力电池系统结构"]), JobAbilityNode(name="电池维修与交付", score=79, ability_units=["电池包拆装", "质量验收"], skill_points=["电池包拆装", "扭矩规范记录"], knowledge_points=["电池包维护工艺", "维修质量标准"])]
    elif any(term in group_text for term in ("软件技术", "软件工程", "计算机应用")):
        chain, group, tasks = "软件产业链", "软件开发与交付岗位群", ["分析业务需求并编写任务卡", "完成接口开发与联调", "执行测试并持续交付"]
        nodes = [JobAbilityNode(name="需求与设计", score=83, ability_units=["需求分析", "方案设计"], skill_points=["用户故事拆解", "接口建模"], knowledge_points=["软件工程规范", "数据库与接口原理"]), JobAbilityNode(name="开发测试与交付", score=80, ability_units=["编码实现", "质量保障"], skill_points=["接口开发", "自动化测试", "持续集成"], knowledge_points=["版本控制", "软件测试方法"])]
    elif any(term in group_text for term in ("物流", "供应链")):
        chain, group, tasks = "现代物流产业链", "仓储规划与运营岗位群", ["分析仓储订单与库位需求", "设计仓储布局与拣选流程", "执行库存盘点并优化周转指标"]
        nodes = [JobAbilityNode(name="仓储规划", score=82, ability_units=["需求预测", "库位规划"], skill_points=["订单分析", "仓储布局设计"], knowledge_points=["仓储作业流程", "库存控制原理"]), JobAbilityNode(name="运营优化", score=78, ability_units=["现场调度", "数据复盘"], skill_points=["拣选路径优化", "库存盘点", "KPI分析"], knowledge_points=["物流信息系统", "精益运营指标"])]
    elif any(term in group_text for term in ("建筑信息模型", "bim", "建筑工程")):
        chain, group, tasks = "数字建造产业链", "BIM 建模与协同岗位群", ["解析建筑图纸与建模标准", "完成专业 BIM 模型构建", "开展碰撞检查并输出协同成果"]
        nodes = [JobAbilityNode(name="模型构建", score=84, ability_units=["图纸识读", "参数化建模"], skill_points=["族与构件建模", "模型编码"], knowledge_points=["建筑制图规范", "BIM 模型标准"]), JobAbilityNode(name="协同交付", score=79, ability_units=["碰撞检查", "成果交付"], skill_points=["管线综合", "问题标注与闭环"], knowledge_points=["施工协同流程", "模型交付标准"])]
    elif "人工智能技术应用" in group_text:
        chain, group, tasks = "人工智能产业链", "数据生产与智能应用岗位群", ["理解数据任务规范", "完成数据处理与标注", "评估模型输出并复核质量"]
        nodes = [JobAbilityNode(name="数据生产与治理", score=86, ability_units=["任务拆解", "数据治理"], skill_points=["标签体系设计", "数据清洗"], knowledge_points=["数据标注规范", "数据质量标准"]), JobAbilityNode(name="智能应用验证", score=78, ability_units=["工具使用", "结果评估"], skill_points=["模型调用", "误差分析"], knowledge_points=["机器学习基础", "评测指标"])]
    elif any(term in text for term in ("机器人", "plc", "运维")):
        chain, group, tasks = "智能制造产业链", "自动化产线岗位群", ["执行设备点检", "诊断报警并恢复运行", "记录维护工单"]
        nodes = [JobAbilityNode(name="设备诊断", score=82, ability_units=["故障定位", "参数判断"], skill_points=["报警分析", "坐标系校准"], knowledge_points=["机器人结构", "电气安全规程"]), JobAbilityNode(name="维护交付", score=74, ability_units=["保养作业", "工单交付"], skill_points=["点检记录", "备件更换"], knowledge_points=["预防性维护", "质量验收"])]
    elif any(term in text for term in ("标注", "数据")):
        chain, group, tasks = "人工智能产业链", "数据生产与治理岗位群", ["理解标注规范并拆解任务", "完成数据标注", "执行质量抽检"]
        nodes = [JobAbilityNode(name="标注规划", score=86, ability_units=["任务拆解", "规范理解"], skill_points=["标签体系设计", "边界判定"], knowledge_points=["数据标注规范", "项目质量标准"]), JobAbilityNode(name="质量控制", score=78, ability_units=["工具使用", "一致性复核"], skill_points=["标注工具操作", "抽检复核"], knowledge_points=["抽样方法", "误差分析"])]
    else:
        chain, group, tasks = "数字产业链", "岗位技能服务岗位群", ["阅读岗位工单", "完成典型操作", "提交质量记录"]
        nodes = [JobAbilityNode(name="任务理解与规划", score=80, ability_units=["需求分析", "任务拆解"], skill_points=["工单阅读", "流程设计"], knowledge_points=["岗位标准", "质量要求"]), JobAbilityNode(name="规范执行与复盘", score=76, ability_units=["标准操作", "异常复盘"], skill_points=["规范操作", "质量记录"], knowledge_points=["安全规范", "验收标准"])]
    if request.typical_tasks:
        tasks = list(dict.fromkeys([item.strip() for item in request.typical_tasks if item.strip()] + tasks))[:8]
    # Keep the task-to-ability reasoning visible in the response instead of
    # returning two unrelated lists that the UI has to imply are connected.
    for index, task in enumerate(tasks):
        node = nodes[index % len(nodes)]
        if task not in node.related_tasks:
            node.related_tasks.append(task)
    if request.observed_skills and nodes:
        for index, skill in enumerate(request.observed_skills):
            normalized = skill.strip()
            if normalized and normalized not in nodes[index % len(nodes)].skill_points:
                nodes[index % len(nodes)].skill_points.append(normalized)
    citations = ["岗位任务输入（用户提供）", "专业岗位能力知识目录（需负责人复核）"]
    if request.observed_skills:
        citations.insert(1, "产业岗位分析技能聚合（公开来源，需复核）")
    return JobAbilityResponse(job_name=request.job_name, industry_chain=chain, job_group=group, typical_tasks=tasks, abilities=nodes, citations=citations, generation_mode="rule-template")


@router.post("/adaptive-learning/recommend", response_model=AdaptiveLearningResponse)
async def recommend_adaptive_learning(request: AdaptiveLearningRequest) -> AdaptiveLearningResponse:
    """Turn a learner goal and measured scores into an explicit岗-课-赛 next-step plan."""
    defaults = [("K01", "任务理解与规划"), ("K02", "规范操作与安全"), ("K03", "工具实践与交付"), ("K04", "质量复盘与迁移")]
    defaults = [(code, request.ability_labels.get(code, label)) for code, label in defaults]
    weak: list[AdaptiveWeakArea] = []
    for code, label in defaults:
        if code not in request.assessment_scores:
            continue
        raw = request.assessment_scores[code]
        score = max(0, min(100, int(raw)))
        if score < 80:
            weak.append(AdaptiveWeakArea(code=code, label=label, score=score, reason=f"当前诊断 {score} 分，距离岗位建议线 80 分还差 {80-score} 分"))
    weak = sorted(weak, key=lambda item: item.score)[:3]
    measured = [(code, label, max(0, min(100, int(request.assessment_scores[code])))) for code, label in defaults if code in request.assessment_scores]
    if weak:
        top = weak[0]
    elif measured:
        code, label, score = min(measured, key=lambda item: item[2])
        top = AdaptiveWeakArea(code=code, label=f"{label}综合迁移", score=score, reason=f"已测维度均达到岗位建议线，当前最低维度为 {score} 分，可进入综合迁移训练")
    else:
        top = AdaptiveWeakArea(code="K00", label="岗位能力诊断", score=0, reason="尚未收到已测维度；请先完成岗位能力诊断")
    completed = set(request.completed_skills)
    next_steps = [
        AdaptiveNextStep(title=f"先学：{top.label}微课", kind="课", description=f"围绕“{top.label}”完成 10 分钟概念梳理与示例讲解。", resource=f"{top.label}岗位微课", unlock_condition="完成微课随堂测验 ≥ 60 分"),
        AdaptiveNextStep(title=f"再练：{top.label}仿真任务", kind="岗", description="在低风险仿真环境完成一次可提交的岗位操作，并记录关键参数。", resource=f"{top.label}虚拟实训", unlock_condition="提交任务产出并通过安全检查"),
        AdaptiveNextStep(title="最后：竞赛/岗位综合挑战", kind="赛", description=f"将“{request.goal}”转化为一项限时综合任务，检验知识和技能迁移。", resource="岗位综合挑战题", unlock_condition="前两步完成且复测达到 80 分"),
    ]
    done = sum(1 for step in next_steps if step.title in completed or step.title.split("：", 1)[-1] in completed)
    progress = min(100, round((done / len(next_steps)) * 100))
    badges = ["目标已设定"]
    if weak: badges.append("诊断已定位")
    elif measured: badges.append("岗位基准已达标")
    if done: badges.append("任务有进展")
    return AdaptiveLearningResponse(goal=request.goal, goal_scene=request.goal_scene, job_name=request.job_name,
        diagnostic_summary=(f"已依据“{request.goal}”和岗位诊断结果定位 {len(weak)} 个优先补强项；推荐顺序为先课、再岗、后赛。" if request.assessment_scores else "尚未收到岗位能力诊断分数；请先完成测评，再生成基于学情的个性化路径。"),
        weak_areas=weak, next_steps=next_steps, progress=progress, badges=badges,
        safety_notice="推荐路径用于学习引导；涉及真实设备、车辆或生产数据的操作，必须由教师按现场安全规范复核。")
