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
from app.db.session import async_session_factory, engine


def utc_iso(days_offset: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()


def _read_knowledge_markdown(file_name: str) -> str:
    knowledge_dir = Path(__file__).resolve().parents[1] / "knowledge_base" / "software_engineering_4th"
    return (knowledge_dir / file_name).read_text(encoding="utf-8").strip()


def build_software_engineering_seed_resources() -> list[GeneratedResource]:
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
    for spec in resource_specs:
        sections = [_read_knowledge_markdown(name) for name in spec["source_files"]]
        content_markdown = "\n\n".join(sections)
        resources.append(
            GeneratedResource(
                id=spec["id"],
                user_id=1001,
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
                },
                is_archived=False,
                download_scope="public",
                download_count=0,
                created_at=spec["created_at"],
                updated_at=spec["updated_at"],
            )
        )
    return resources


async def create_tables() -> None:
    Path("local_data").mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
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

        resource_1 = GeneratedResource(
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
        )
        resource_2 = GeneratedResource(
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
        )
        software_engineering_resources = build_software_engineering_seed_resources()
        session.add_all([resource_1, resource_2, *software_engineering_resources])

        session.add(
            ResourceFavorite(
                id=1,
                user_id=1001,
                resource_id=1,
                category="联调重点",
                notes="前端资源页默认展示的数据来源",
                created_at=utc_iso(-1),
                updated_at=utc_iso(-1),
            )
        )
        session.add(
            ResourceFavoriteHistory(
                id=1,
                user_id=1001,
                resource_id=1,
                action="favorite",
                created_at=utc_iso(-1),
                updated_at=utc_iso(-1),
            )
        )
        session.add_all(
            [
                ResourceFavorite(
                    id=2,
                    user_id=1001,
                    resource_id=101,
                    category="软件工程导学",
                    notes="适合作为课程首页推荐的导学资源。",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
                ResourceFavorite(
                    id=3,
                    user_id=1001,
                    resource_id=104,
                    category="实验实践",
                    notes="可直接给资源中心的实践分类做初始样例。",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
                ResourceFavoriteHistory(
                    id=2,
                    user_id=1001,
                    resource_id=101,
                    action="favorite",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
                ResourceFavoriteHistory(
                    id=3,
                    user_id=1001,
                    resource_id=104,
                    action="favorite",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
            ]
        )

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
