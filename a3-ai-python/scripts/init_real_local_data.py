import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete

from app.db.base import Base
from app.db.models.chat_ticket import ChatTicket, ChatTicketReply
from app.db.models.evaluation_paper import EvaluationAnswer, EvaluationPaper
from app.db.models.evaluation_record import EvaluationRecord
from app.db.models.generated_resource import GeneratedResource, ResourceFavorite, ResourceFavoriteHistory
from app.db.models.resource_source_file import ResourceSourceFile
from app.db.models.profile_conversation import ProfileHistoryModel, StudentProfileModel
from app.db.session import async_session_factory, sqlite_engine

SEED_USER_IDS = list(range(1001, 1011))


def utc_iso(days_offset: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()


def _read_knowledge_markdown(file_name: str) -> str:
    knowledge_dir = Path(__file__).resolve().parents[1] / "knowledge_base" / "software_engineering_4th"
    return (knowledge_dir / file_name).read_text(encoding="utf-8").strip()


def build_course_seed_resources(
    *,
    user_id: int,
    course_code: str,
    base_resource_id: int,
    course_label: str,
    resource_specs: list[dict],
) -> list[GeneratedResource]:
    resources: list[GeneratedResource] = []
    resource_id_offset = max(0, user_id - 1001) * 1000
    for index, spec in enumerate(resource_specs):
        resources.append(
            GeneratedResource(
                id=base_resource_id + index + resource_id_offset,
                user_id=user_id,
                course_code=course_code,
                resource_type=spec["resource_type"],
                title=spec["title"],
                summary=spec["summary"],
                content_markdown=spec["content_markdown"],
                source_titles=spec["source_titles"],
                study_suggestion=spec["study_suggestion"],
                generation_context={
                    "seed": True,
                    "scenario": f"{course_code}_course_resources",
                    "seed_owner": user_id,
                    "course_label": course_label,
                },
                is_archived=False,
                download_scope="public",
                download_count=spec.get("download_count", 0),
                created_at=spec["created_at"],
                updated_at=spec["updated_at"],
            )
        )
    return resources


def build_software_engineering_seed_resources(*, user_id: int = 1001) -> list[GeneratedResource]:
    resource_specs = [
        {
            "id": 101,
            "resource_type": "lecture_note",
            "title": "软件工程课程画像与学习导引",
            "summary": "基于课程画像与教学进度整理的导学讲义，适合作为课程开篇阅读。",
            "source_titles": ["课程画像", "教学进度与章节安排"],
            "study_suggestion": "先看课程定位、能力目标和周次安排，再进入章节学习。",
            "source_files": ["section_13_course_profile.md", "section_14_teaching_schedule.md"],
            "created_at": utc_iso(-6),
            "updated_at": utc_iso(-2),
        },
        {
            "id": 102,
            "resource_type": "mindmap",
            "title": "软件工程章节知识图谱",
            "summary": "覆盖第1章到第10章的主线知识点，适合复习和答疑前快速定位。",
            "source_titles": ["章节知识图谱"],
            "study_suggestion": "按章节主线浏览后，再回到 PPT 或教案补细节。",
            "source_files": ["section_15_chapter_map.md"],
            "created_at": utc_iso(-5),
            "updated_at": utc_iso(-2),
        },
        {
            "id": 103,
            "resource_type": "teaching_plan",
            "title": "软件工程混合式教学组织模板",
            "summary": "提炼课前、课中、课后与线上线下结合的课堂组织方式，可直接用于备课。",
            "source_titles": ["教学方法与课堂组织"],
            "study_suggestion": "备课时优先参考活动节奏和任务分配，再结合本校周次做裁剪。",
            "source_files": ["section_16_teaching_method.md"],
            "created_at": utc_iso(-4),
            "updated_at": utc_iso(-1),
        },
        {
            "id": 104,
            "resource_type": "practice_set",
            "title": "软件工程实验与课设选题包",
            "summary": "整理实验、课设和工具资源，便于生成实践任务或资源推荐卡片。",
            "source_titles": ["实验、课设与工具资源"],
            "study_suggestion": "结合当前章节选择一个实验方向，再补看对应案例与工具说明。",
            "source_files": ["section_17_labs_projects_and_tools.md"],
            "created_at": utc_iso(-4),
            "updated_at": utc_iso(-1),
        },
        {
            "id": 105,
            "resource_type": "assessment_guide",
            "title": "软件工程考核与毕业要求说明",
            "summary": "归纳实验评价标准、考核重点与毕业要求映射，适合课程收尾和答疑。",
            "source_titles": ["考核、实验评价与毕业要求"],
            "study_suggestion": "复习阶段优先关注评分维度，再回查实验报告和课程目标对应关系。",
            "source_files": ["section_18_assessment_and_outcomes.md"],
            "created_at": utc_iso(-3),
            "updated_at": utc_iso(-1),
        },
        {
            "id": 106,
            "resource_type": "course_overview",
            "title": "软件工程课程资源总览",
            "summary": "汇总课程资料规模、核心目录与高价值资料入口，适合资源中心首页展示。",
            "source_titles": ["课程资料库概览", "课程画像", "章节知识图谱"],
            "study_suggestion": "先从总览确认资料入口，再进入课程画像和章节图谱。",
            "source_files": ["00_overview.md", "section_13_course_profile.md", "section_15_chapter_map.md"],
            "created_at": utc_iso(-2),
            "updated_at": utc_iso(-1),
        },
    ]

    resources: list[GeneratedResource] = []
    resource_id_offset = max(0, user_id - 1001) * 1000
    for spec in resource_specs:
        sections = [_read_knowledge_markdown(name) for name in spec["source_files"]]
        content_markdown = "\n\n".join(sections)
        resources.append(
            GeneratedResource(
                id=spec["id"] + resource_id_offset,
                user_id=user_id,
                course_code="software_engineering_4th",
                resource_type=spec["resource_type"],
                title=spec["title"],
                summary=spec["summary"],
                content_markdown=content_markdown,
                source_titles=spec["source_titles"],
                study_suggestion=spec["study_suggestion"],
                generation_context={
                    "seed": True,
                    "scenario": "software_engineering_course_resources",
                    "source_files": spec["source_files"],
                    "seed_owner": user_id,
                },
                is_archived=False,
                download_scope="public",
                download_count=0,
                created_at=spec["created_at"],
                updated_at=spec["updated_at"],
            )
        )
    return resources


def build_multi_course_seed_resources(*, user_id: int = 1001) -> list[GeneratedResource]:
    resource_specs_by_course = {
        "ml_intro": {
            "base_resource_id": 201,
            "course_label": "A3 智能学习助手实战",
            "items": [
                {
                    "resource_type": "lecture_note",
                    "title": "A3 学习闭环主线讲义",
                    "summary": "围绕画像、路径、资源、答疑与报告串起整条学习闭环，适合首页和答辩讲解。",
                    "content_markdown": "# A3 学习闭环主线讲义\n\n- 学习画像如何初始化\n- 学习路径如何动态调整\n- 资源生成如何结合弱项\n- AI 导师如何承接课堂上下文\n- 报告如何形成下一步决策",
                    "source_titles": ["学习画像", "路径规划", "资源生成", "AI 导师", "学习报告"],
                    "study_suggestion": "先看整条链路，再按页面逐段验证接口和数据落点。",
                    "created_at": utc_iso(-6),
                    "updated_at": utc_iso(-2),
                },
                {
                    "resource_type": "mindmap",
                    "title": "A3 多智能体协作图",
                    "summary": "把画像、路径、资源、答疑、评测五类智能体的协作关系整理成可视化图谱。",
                    "content_markdown": "# A3 多智能体协作图\n\n- 画像智能体\n- 路径规划智能体\n- 资源生成智能体\n- AI 导师智能体\n- 评测反馈智能体",
                    "source_titles": ["画像智能体", "路径智能体", "资源智能体", "评测智能体"],
                    "study_suggestion": "适合答辩前快速复盘多角色协作关系。",
                    "created_at": utc_iso(-5),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "practice_set",
                    "title": "A3 联调检查清单",
                    "summary": "把画像、资源、评测和会话联调拆成一组实际检查项，适合开发验收。",
                    "content_markdown": "# A3 联调检查清单\n\n1. 校验当前登录用户是否透传\n2. 校验页面是否读取真实数据库\n3. 校验资源收藏是否按用户变化\n4. 校验学习报告是否与评测记录一致",
                    "source_titles": ["联调检查", "用户透传", "数据库验证"],
                    "study_suggestion": "边验接口边勾选，能快速发现 demo 感来源。",
                    "created_at": utc_iso(-4),
                    "updated_at": utc_iso(-1),
                },
            ],
        },
        "vue3_engineering": {
            "base_resource_id": 301,
            "course_label": "Vue 3 项目工程化落地",
            "items": [
                {
                    "resource_type": "lecture_note",
                    "title": "Vue 3 页面工程化讲义",
                    "summary": "聚焦组件抽象、状态边界和接口联调，是前端工程化主线的入门讲义。",
                    "content_markdown": "# Vue 3 页面工程化讲义\n\n- 页面结构与模块分层\n- 组件职责边界\n- 状态管理拆分\n- 接口联调与容错",
                    "source_titles": ["组件抽象", "状态边界", "接口联调"],
                    "study_suggestion": "先看页面怎么拆，再看状态和接口怎么接。",
                    "created_at": utc_iso(-5),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "mindmap",
                    "title": "前端状态边界导图",
                    "summary": "把推荐流、学习进度、AI 导师等状态面梳理成一张前端结构图。",
                    "content_markdown": "# 前端状态边界导图\n\n- 推荐流\n- 学习进度\n- 资源工作台\n- AI 导师面板",
                    "source_titles": ["推荐流", "学习进度", "AI 导师"],
                    "study_suggestion": "适合首页改版前先做结构定位。",
                    "created_at": utc_iso(-4),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "practice_set",
                    "title": "前端页面改版练习题",
                    "summary": "围绕页面密度、视觉层级和状态边界设计了一组练习题。",
                    "content_markdown": "# 前端页面改版练习题\n\n1. 如何减少首屏信息密度？\n2. 哪些状态应该脱离页面局部组件？\n3. AI 导师入口放在哪里最顺手？",
                    "source_titles": ["页面密度", "视觉层级", "状态边界"],
                    "study_suggestion": "学完一节后立刻练，能更快形成产品直觉。",
                    "created_at": utc_iso(-3),
                    "updated_at": utc_iso(-1),
                },
            ],
        },
        "llm_app_intro": {
            "base_resource_id": 401,
            "course_label": "大模型应用开发导论",
            "items": [
                {
                    "resource_type": "lecture_note",
                    "title": "多智能体与 RAG 主线讲义",
                    "summary": "整理了 RAG、联网检索、会话上下文和资源生成之间的主干关系。",
                    "content_markdown": "# 多智能体与 RAG 主线讲义\n\n- 什么时候走知识库\n- 什么时候触发联网检索\n- 资源生成如何承接上下文\n- 多角色智能体如何协作",
                    "source_titles": ["RAG", "联网检索", "资源生成", "多智能体"],
                    "study_suggestion": "先看判断链路，再看每个工具的调用时机。",
                    "created_at": utc_iso(-5),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "extended_reading",
                    "title": "Agent 工具调用扩展阅读",
                    "summary": "扩展说明了工具选择、上下文裁剪和调用边界，适合进阶阅读。",
                    "content_markdown": "# Agent 工具调用扩展阅读\n\n- 工具选择条件\n- 上下文裁剪策略\n- 外部信息可信度判断\n- 结果回填到主会话的方法",
                    "source_titles": ["工具选择", "上下文裁剪", "外部信息判断"],
                    "study_suggestion": "看完主线后再看，会更容易理解为什么要自主判断。",
                    "created_at": utc_iso(-4),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "case_study",
                    "title": "联网补资料决策案例",
                    "summary": "通过真实问题案例说明智能体如何判断是否需要 web search 或扩展阅读。",
                    "content_markdown": "# 联网补资料决策案例\n\n1. 识别问题是否依赖最新外部信息\n2. 判断本地知识库是否已覆盖\n3. 决定是否追加视频、阅读或代码案例",
                    "source_titles": ["联网补资料", "决策案例", "工具调用"],
                    "study_suggestion": "适合给 AI 导师联动功能做演示脚本。",
                    "created_at": utc_iso(-3),
                    "updated_at": utc_iso(-1),
                },
            ],
        },
        "contest_project_lab": {
            "base_resource_id": 501,
            "course_label": "软挑赛题项目实训",
            "items": [
                {
                    "resource_type": "lecture_note",
                    "title": "项目答辩主线讲义",
                    "summary": "帮助团队把需求、实现、亮点和学习闭环整理成可直接讲的答辩主线。",
                    "content_markdown": "# 项目答辩主线讲义\n\n- 业务问题\n- 系统方案\n- 多智能体亮点\n- 学习闭环价值\n- 下一步扩展",
                    "source_titles": ["答辩主线", "系统方案", "亮点表达"],
                    "study_suggestion": "讲之前先删掉次要信息，只保留最能支撑价值的链路。",
                    "created_at": utc_iso(-4),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "practice_set",
                    "title": "答辩追问模拟题",
                    "summary": "围绕评委常问的功能价值、数据真实性和协作架构设计了模拟题。",
                    "content_markdown": "# 答辩追问模拟题\n\n1. 为什么你的项目不只是普通 dashboard？\n2. 多智能体分别做了什么？\n3. 数据为什么可信？\n4. 下一步准备怎么扩？",
                    "source_titles": ["答辩追问", "数据真实性", "协作架构"],
                    "study_suggestion": "适合演练 3 分钟版本和 8 分钟版本两套说法。",
                    "created_at": utc_iso(-3),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "course_overview",
                    "title": "项目资料工作台总览",
                    "summary": "把讲义、PPT、思维导图、测评反馈和课堂记录整理成统一入口。",
                    "content_markdown": "# 项目资料工作台总览\n\n- 讲义\n- PPT\n- 思维导图\n- 课堂记录\n- 测评反馈\n- 答辩版本输出",
                    "source_titles": ["资料工作台", "PPT", "课堂记录", "评测反馈"],
                    "study_suggestion": "适合作为项目首页或收藏工作台的内容来源。",
                    "created_at": utc_iso(-2),
                    "updated_at": utc_iso(-1),
                },
            ],
        },
        "spring_cloud_bootcamp": {
            "base_resource_id": 601,
            "course_label": "Spring Cloud 微服务训练营",
            "items": [
                {
                    "resource_type": "lecture_note",
                    "title": "微服务治理导学讲义",
                    "summary": "帮助理解网关、注册发现、配置中心和故障隔离之间的关系。",
                    "content_markdown": "# 微服务治理导学讲义\n\n- 注册发现\n- 网关治理\n- 配置中心\n- 限流与熔断\n- 联调与监控",
                    "source_titles": ["网关治理", "注册发现", "配置中心"],
                    "study_suggestion": "先看链路，再看每个服务怎么承担职责。",
                    "created_at": utc_iso(-5),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "mindmap",
                    "title": "后端服务调用关系图",
                    "summary": "用一张调用关系图把服务入口、配置分发和追踪链路串起来。",
                    "content_markdown": "# 后端服务调用关系图\n\n- Gateway\n- Service Registry\n- Config Center\n- Business Services\n- Tracing & Logs",
                    "source_titles": ["调用链路", "网关", "配置分发"],
                    "study_suggestion": "适合联调前先统一团队认知。",
                    "created_at": utc_iso(-4),
                    "updated_at": utc_iso(-1),
                },
                {
                    "resource_type": "case_study",
                    "title": "联调故障排查案例",
                    "summary": "通过一次真实联调案例解释接口异常、链路追踪和状态回溯。",
                    "content_markdown": "# 联调故障排查案例\n\n1. 入口请求失败\n2. 网关日志定位\n3. 服务注册状态检查\n4. 配置项比对\n5. 回归验证",
                    "source_titles": ["联调故障", "链路追踪", "回归验证"],
                    "study_suggestion": "适合接口治理和联调演示。",
                    "created_at": utc_iso(-3),
                    "updated_at": utc_iso(-1),
                },
            ],
        },
    }

    resources: list[GeneratedResource] = []
    for course_code, config in resource_specs_by_course.items():
        resources.extend(
            build_course_seed_resources(
                user_id=user_id,
                course_code=course_code,
                base_resource_id=config["base_resource_id"],
                course_label=config["course_label"],
                resource_specs=config["items"],
            )
        )
    return resources


def build_seed_resources_for_user(*, user_id: int) -> list[GeneratedResource]:
    resources: list[GeneratedResource] = []
    if user_id == 1001:
        resources.extend(
            [
                GeneratedResource(
                    id=1,
                    user_id=1001,
                    course_code="ml_intro",
                    resource_type="lecture_note",
                    title="A3 智能学习助手机制梳理",
                    summary="聚焦画像、资源、评测三条主链路的讲义笔记，适合联调时快速对齐。",
                    content_markdown=(
                        "# A3 智能学习助手机制梳理\n\n"
                        "## 重点\n"
                        "- 学习画像来自真实 student_profile 表\n"
                        "- 资源收藏与归档来自 generated_resource 相关表\n"
                        "- 评测趋势来自 evaluation_record\n\n"
                        "## 建议\n"
                        "先看整体链路，再验证每条接口的字段映射。"
                    ),
                    source_titles=["画像联调", "资源联调", "评测联调"],
                    study_suggestion="先完成一次全链路浏览，再逐项核对字段。",
                    generation_context={"seed": True, "scenario": "real_local_debug"},
                    is_archived=False,
                    download_scope="owner",
                    download_count=3,
                    created_at=utc_iso(-3),
                    updated_at=utc_iso(-1),
                ),
                GeneratedResource(
                    id=2,
                    user_id=1001,
                    course_code="ml_intro",
                    resource_type="practice_set",
                    title="A3 联调自测题单",
                    summary="用于验证资源归档与历史页的补充题单。",
                    content_markdown=(
                        "# A3 联调自测题单\n\n"
                        "1. 说出画像摘要接口依赖的主表。\n"
                        "2. 说出资源收藏历史接口依赖的主表。\n"
                        "3. 说出评测趋势接口如何计算 improvement。"
                    ),
                    source_titles=["归档验证", "历史接口"],
                    study_suggestion="做完后回看评测趋势里的薄弱点。",
                    generation_context={"seed": True, "scenario": "archive_debug"},
                    is_archived=True,
                    archived_at=utc_iso(-2),
                    archived_by="system_seed",
                    archive_reason="用于归档接口联调",
                    download_scope="owner",
                    download_count=1,
                    created_at=utc_iso(-4),
                    updated_at=utc_iso(-2),
                ),
            ]
        )
    resources.extend(build_software_engineering_seed_resources(user_id=user_id))
    resources.extend(build_multi_course_seed_resources(user_id=user_id))
    return resources


def build_seed_favorites() -> tuple[list[ResourceFavorite], list[ResourceFavoriteHistory]]:
    favorites: list[ResourceFavorite] = []
    histories: list[ResourceFavoriteHistory] = []
    favorite_id = 1
    history_id = 1

    for user_id in SEED_USER_IDS:
        resource_id_offset = max(0, user_id - 1001) * 1000
        seed_pairs = [
            (1 + resource_id_offset if user_id == 1001 else 201 + resource_id_offset, "联调重点", "首页与资源页联调用的默认收藏。"),
            (101 + resource_id_offset, "软件工程导学", "适合作为课程首页推荐的导学资源。"),
            (104 + resource_id_offset, "实验实践", "可直接给资源中心的实践分类做初始样例。"),
            (301 + resource_id_offset, "前端工程化", "跨课程补充用，适合首页和课堂页联动展示。"),
            (401 + resource_id_offset, "AI 应用", "多智能体与联网补资料的核心示例资源。"),
        ]

        for resource_id, category, notes in seed_pairs:
            favorites.append(
                ResourceFavorite(
                    id=favorite_id,
                    user_id=user_id,
                    resource_id=resource_id,
                    category=category,
                    notes=notes,
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                )
            )
            histories.append(
                ResourceFavoriteHistory(
                    id=history_id,
                    user_id=user_id,
                    resource_id=resource_id,
                    action="favorite",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                )
            )
            favorite_id += 1
            history_id += 1

    return favorites, histories


async def create_tables() -> None:
    Path("local_data").mkdir(parents=True, exist_ok=True)
    async with sqlite_engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                GeneratedResource.__table__,
                ResourceFavorite.__table__,
                ResourceFavoriteHistory.__table__,
                ResourceSourceFile.__table__,
                ChatTicket.__table__,
                ChatTicketReply.__table__,
                EvaluationPaper.__table__,
                EvaluationAnswer.__table__,
                EvaluationRecord.__table__,
                StudentProfileModel.__table__,
                ProfileHistoryModel.__table__,
                ],
            )
        )


async def seed_data() -> None:
    async with async_session_factory() as session:
        await session.execute(delete(ChatTicketReply))
        await session.execute(delete(ChatTicket))
        await session.execute(delete(EvaluationAnswer))
        await session.execute(delete(EvaluationPaper))
        await session.execute(delete(ResourceFavoriteHistory))
        await session.execute(delete(ResourceFavorite))
        await session.execute(delete(ResourceSourceFile))
        await session.execute(delete(GeneratedResource))
        await session.execute(delete(EvaluationRecord))
        await session.execute(delete(ProfileHistoryModel))
        await session.execute(delete(StudentProfileModel))

        all_seed_resources: list[GeneratedResource] = []
        for user_id in SEED_USER_IDS:
            all_seed_resources.extend(build_seed_resources_for_user(user_id=user_id))
        session.add_all(all_seed_resources)

        favorite_rows, favorite_history_rows = build_seed_favorites()
        session.add_all(favorite_rows)
        session.add_all(favorite_history_rows)

        session.add(
            ChatTicket(
                id=1,
                user_id=1001,
                session_id=None,
                course_code="ml_intro",
                title="Need help reviewing weak-point questions",
                question_summary="I want a quick explanation for why trend aggregation and archive summary were marked as weak points.",
                latest_answer="Start from the latest evaluation trend, then compare it with the archived resource summary.",
                priority="normal",
                status="open",
                created_at=utc_iso(-1),
                updated_at=utc_iso(-1),
            )
        )
        session.add(
            ChatTicketReply(
                id=1,
                ticket_id=1,
                replier_name="A3 Support",
                replier_role="staff",
                content="Review the latest evaluation trend first, then revisit the archived practice set to see where the confusion started.",
                created_at=utc_iso(-1),
                updated_at=utc_iso(-1),
            )
        )

        session.add_all(
            [
                EvaluationPaper(
                    id=9001,
                    user_id=1001,
                    course_code="ml_intro",
                    paper_type="diagnostic",
                    status="submitted",
                    questions_data=[
                        {
                            "question_id": "q1",
                            "question_type": "single_choice",
                            "prompt": "Which table stores profile snapshots for summary aggregation?",
                            "options": ["A. generated_resource", "B. student_profile", "C. evaluation_record", "D. resource_favorite_history"],
                            "correct_answer": "B",
                            "explanation": "The summary profile is assembled from the persisted student profile table.",
                            "knowledge_point": "profile summary",
                            "difficulty": "basic",
                        },
                        {
                            "question_id": "q2",
                            "question_type": "single_choice",
                            "prompt": "Which table helps reconstruct favorite-action history?",
                            "options": ["A. resource_favorite_history", "B. profile_history", "C. evaluation_record", "D. evaluation_answer"],
                            "correct_answer": "A",
                            "explanation": "Favorite history reads from the dedicated favorite history table.",
                            "knowledge_point": "favorite history",
                            "difficulty": "basic",
                        },
                    ],
                    created_at=utc_iso(-7),
                    updated_at=utc_iso(-7),
                ),
                EvaluationPaper(
                    id=9002,
                    user_id=1001,
                    course_code="ml_intro",
                    paper_type="diagnostic",
                    status="submitted",
                    questions_data=[
                        {
                            "question_id": "q1",
                            "question_type": "single_choice",
                            "prompt": "What powers archive summary aggregation?",
                            "options": ["A. favorite cache", "B. generated_resource archive fields", "C. chat session cache", "D. course categories"],
                            "correct_answer": "B",
                            "explanation": "Archive summary is grouped from archived resource rows and metadata.",
                            "knowledge_point": "archive summary",
                            "difficulty": "advanced",
                        },
                        {
                            "question_id": "q2",
                            "question_type": "single_choice",
                            "prompt": "How is improvement computed in the trend endpoint?",
                            "options": ["A. latest - earliest", "B. average - latest", "C. best - average", "D. total / count"],
                            "correct_answer": "A",
                            "explanation": "The trend endpoint compares the newest score with the earliest score in the selected range.",
                            "knowledge_point": "trend aggregation",
                            "difficulty": "advanced",
                        },
                    ],
                    created_at=utc_iso(-5),
                    updated_at=utc_iso(-5),
                ),
                EvaluationPaper(
                    id=9003,
                    user_id=1001,
                    course_code="ml_intro",
                    paper_type="diagnostic",
                    status="submitted",
                    questions_data=[
                        {
                            "question_id": "q1",
                            "question_type": "single_choice",
                            "prompt": "What is the safest way to validate the API contract end to end?",
                            "options": ["A. Read only the frontend", "B. Compare schema, repository, and live response together", "C. Trust cached output", "D. Skip persistence checks"],
                            "correct_answer": "B",
                            "explanation": "True contract validation checks persisted fields against repository and response behavior together.",
                            "knowledge_point": "api contract",
                            "difficulty": "challenge",
                        },
                        {
                            "question_id": "q2",
                            "question_type": "single_choice",
                            "prompt": "Which topic remains the current weak point in the latest diagnostic?",
                            "options": ["A. archive summary", "B. profile summary", "C. boundary validation", "D. favorite history"],
                            "correct_answer": "C",
                            "explanation": "The latest seeded diagnostic keeps boundary validation as the remaining focus item.",
                            "knowledge_point": "boundary validation",
                            "difficulty": "challenge",
                        },
                    ],
                    created_at=utc_iso(-2),
                    updated_at=utc_iso(-2),
                ),
                EvaluationRecord(
                    id=1,
                    user_id=1001,
                    course_code="ml_intro",
                    evaluation_type="diagnostic",
                    result_data={
                        "paper_id": 9001,
                        "evaluation_type": "diagnostic",
                        "overall_score": 62,
                        "mastery_level": "developing",
                        "report_summary": "已理解主链路，但字段口径和接口关系还不稳定。",
                        "weak_points": ["画像摘要", "收藏历史"],
                        "knowledge_points": ["profile summary", "favorite history"],
                    },
                    created_at=utc_iso(-7),
                    updated_at=utc_iso(-7),
                ),
                EvaluationRecord(
                    id=2,
                    user_id=1001,
                    course_code="ml_intro",
                    evaluation_type="diagnostic",
                    result_data={
                        "paper_id": 9002,
                        "evaluation_type": "diagnostic",
                        "overall_score": 74,
                        "mastery_level": "progressing",
                        "report_summary": "可以完成资源与画像联调，但对归档与趋势聚合还需要复核。",
                        "weak_points": ["归档汇总", "趋势聚合"],
                        "knowledge_points": ["archive summary", "trend aggregation"],
                    },
                    created_at=utc_iso(-5),
                    updated_at=utc_iso(-5),
                ),
                EvaluationRecord(
                    id=3,
                    user_id=1001,
                    course_code="ml_intro",
                    evaluation_type="diagnostic",
                    result_data={
                        "paper_id": 9003,
                        "evaluation_type": "diagnostic",
                        "overall_score": 88,
                        "mastery_level": "proficient",
                        "report_summary": "已经能独立定位接口、表结构和返回字段之间的对应关系。",
                        "weak_points": ["边界验证"],
                        "knowledge_points": ["real db integration", "api contract"],
                    },
                    created_at=utc_iso(-2),
                    updated_at=utc_iso(-2),
                ),
            ]
        )
        await session.flush()

        session.add_all(
            [
                EvaluationAnswer(
                    id=1,
                    paper_id=9001,
                    user_id=1001,
                    question_id="q1",
                    question_type="single_choice",
                    prompt="Which table stores profile snapshots for summary aggregation?",
                    knowledge_point="profile summary",
                    user_answer="B",
                    correct_answer="B",
                    is_correct=True,
                    explanation="The summary profile is assembled from the persisted student profile table.",
                    created_at=utc_iso(-7),
                    updated_at=utc_iso(-7),
                ),
                EvaluationAnswer(
                    id=2,
                    paper_id=9001,
                    user_id=1001,
                    question_id="q2",
                    question_type="single_choice",
                    prompt="Which table helps reconstruct favorite-action history?",
                    knowledge_point="favorite history",
                    user_answer="C",
                    correct_answer="A",
                    is_correct=False,
                    explanation="Favorite history reads from the dedicated favorite history table.",
                    created_at=utc_iso(-7),
                    updated_at=utc_iso(-7),
                ),
                EvaluationAnswer(
                    id=3,
                    paper_id=9002,
                    user_id=1001,
                    question_id="q1",
                    question_type="single_choice",
                    prompt="What powers archive summary aggregation?",
                    knowledge_point="archive summary",
                    user_answer="B",
                    correct_answer="B",
                    is_correct=True,
                    explanation="Archive summary is grouped from archived resource rows and metadata.",
                    created_at=utc_iso(-5),
                    updated_at=utc_iso(-5),
                ),
                EvaluationAnswer(
                    id=4,
                    paper_id=9002,
                    user_id=1001,
                    question_id="q2",
                    question_type="single_choice",
                    prompt="How is improvement computed in the trend endpoint?",
                    knowledge_point="trend aggregation",
                    user_answer="D",
                    correct_answer="A",
                    is_correct=False,
                    explanation="The trend endpoint compares the newest score with the earliest score in the selected range.",
                    created_at=utc_iso(-5),
                    updated_at=utc_iso(-5),
                ),
                EvaluationAnswer(
                    id=5,
                    paper_id=9003,
                    user_id=1001,
                    question_id="q1",
                    question_type="single_choice",
                    prompt="What is the safest way to validate the API contract end to end?",
                    knowledge_point="api contract",
                    user_answer="B",
                    correct_answer="B",
                    is_correct=True,
                    explanation="True contract validation checks persisted fields against repository and response behavior together.",
                    created_at=utc_iso(-2),
                    updated_at=utc_iso(-2),
                ),
                EvaluationAnswer(
                    id=6,
                    paper_id=9003,
                    user_id=1001,
                    question_id="q2",
                    question_type="single_choice",
                    prompt="Which topic remains the current weak point in the latest diagnostic?",
                    knowledge_point="boundary validation",
                    user_answer="C",
                    correct_answer="C",
                    is_correct=True,
                    explanation="The latest seeded diagnostic keeps boundary validation as the remaining focus item.",
                    created_at=utc_iso(-2),
                    updated_at=utc_iso(-2),
                ),
            ]
        )

        profile = StudentProfileModel(
            id=1001,
            user_id=1001,
            version=3,
            knowledge_base={
                "level": "中级",
                "focus_topics": ["真实库联调", "接口字段核对", "问题定位"],
                "confidence": "stable",
            },
            cognitive_style={
                "preferred_format": ["结构化笔记", "动手验证"],
                "feedback_preference": "快速指出问题并给出修复路径",
            },
            learning_progress={
                "completion_rate": 82,
                "learning_pace": "steady",
                "current_goal": "完成画像/资源/评测三条链路联调",
            },
            error_preference={
                "common_issues": ["字段口径不一致", "本地环境缺少依赖"],
                "review_style": "先定位根因，再补验证",
            },
            interest_direction={
                "topics": ["多智能体系统", "学习系统联调", "接口验收"],
            },
            learning_habit={
                "best_time": "晚上",
                "session_length": "45 分钟",
                "practice_style": "边改边验",
            },
            tags=["真实数据联调", "接口验收", "稳定推进"],
            summary="能够围绕画像、资源和评测链路完成真实数据联调，并偏好结构化、快速反馈的推进方式。",
            completeness=86,
            status=1,
            last_behavior_time=(datetime.now(timezone.utc) - timedelta(hours=6)).replace(tzinfo=None),
            created_at=utc_iso(-10),
            updated_at=utc_iso(-1),
        )
        session.add(profile)
        session.add(
            ProfileHistoryModel(
                id=1,
                profile_id=1001,
                user_id=1001,
                version=3,
                snapshot_data={
                    "knowledge_base": profile.knowledge_base,
                    "cognitive_style": profile.cognitive_style,
                    "learning_progress": profile.learning_progress,
                    "error_preference": profile.error_preference,
                    "interest_direction": profile.interest_direction,
                    "learning_habit": profile.learning_habit,
                    "tags": profile.tags,
                    "summary": profile.summary,
                },
                change_type=1,
                change_description="初始化本地真实联调画像",
                changed_dimensions="knowledge_base,cognitive_style,learning_progress,error_preference,interest_direction,learning_habit",
                created_at=utc_iso(-1),
                updated_at=utc_iso(-1),
            )
        )

        await session.commit()


async def main() -> None:
    await create_tables()
    await seed_data()
    print("seeded real local data into the configured database")


if __name__ == "__main__":
    asyncio.run(main())
