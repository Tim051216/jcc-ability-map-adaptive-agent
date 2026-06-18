import asyncio
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models.chat_session import ChatMessage, ChatSession, ChatSessionReadState
from app.db.models.course_comment import CourseComment, CourseCommentLike
from app.db.models.evaluation_record import EvaluationRecord
from app.db.models.learning_interaction import LearningNote, LearningQuestion, LearningReply
from app.db.models.learning_plan import LearningPlan
from app.db.models.personalized_learning_state import PersonalizedLearningState
from app.db.models.plan_progress import PlanStepProgress
from app.db.models.profile_conversation import ProfileHistoryModel, StudentProfileModel
from app.db.models.tutoring import TutoringAnswer, TutoringFavorite, TutoringQuestion, TutoringSession
from app.db.models.user_inbox import UserInbox
from app.db.models.user_profile import UserProfileSnapshot
from app.db.models.video_danmaku import VideoDanmaku


ROOT_DIR = Path(__file__).resolve().parents[1]
LOCAL_DATA_DIR = ROOT_DIR / "local_data"
SQLITE_PATH = LOCAL_DATA_DIR / "a3_ai_local.db"
SQLITE_DSN = f"sqlite+aiosqlite:///{SQLITE_PATH.as_posix()}"


async def ensure_chat_session_columns(engine) -> None:
    async with engine.begin() as connection:
        table_info = await connection.execute(text("PRAGMA table_info(chat_session)"))
        columns = {str(row[1]) for row in table_info.fetchall()}
        if "peer_user_id" not in columns:
            await connection.execute(text("ALTER TABLE chat_session ADD COLUMN peer_user_id BIGINT"))
        if "peer_name" not in columns:
            await connection.execute(text("ALTER TABLE chat_session ADD COLUMN peer_name VARCHAR(255)"))


def iso_time(days: int = 0, minutes: int = 0) -> str:
    return (datetime.now() + timedelta(days=days, minutes=minutes)).isoformat(timespec="seconds")


COURSE_ID_TO_CODE = {
    101: "ml_intro",
    102: "spring_cloud_bootcamp",
    201: "vue3_engineering",
    301: "llm_app_intro",
    302: "contest_project_lab",
    401: "software_engineering_4th",
}


def build_inbox_items(user: dict, index: int) -> list[UserInbox]:
    user_id = int(user["user_id"])
    name = str(user["name"])
    course_id = int(user["state"]["course_id"])
    course_code = COURSE_ID_TO_CODE.get(course_id, "software_engineering_4th")
    topic = user["interest_direction"]["topics"][0]
    weakness = user["knowledge_base"]["weaknesses"][0]
    current_course = user["learning_progress"]["current_course"]
    progress = int(float(user["learning_progress"]["progress"]) * 100)

    return [
        UserInbox(
            id=50000 + index * 10,
            user_id=user_id,
            type=1,
            title="AI 导师已同步你的学习上下文",
            content=f"{name} 当前的课堂、资源、测评和问答历史已完成同步，可以直接继续学习。",
            is_read=index % 2 == 0,
            publisher=0,
            push_time=iso_time(minutes=-40 - index),
            status="active",
        ),
        UserInbox(
            id=50000 + index * 10 + 1,
            user_id=user_id,
            type=2,
            title="今日建议已生成",
            content=f"系统已根据你的画像，将 {topic} 和 {weakness} 相关资料排到最前，当前主线课程为 {current_course}。",
            is_read=False,
            publisher=0,
            push_time=iso_time(minutes=-28 - index),
            status="active",
        ),
        UserInbox(
            id=50000 + index * 10 + 2,
            user_id=user_id,
            type=3,
            title="本周复习提醒",
            content=f"你当前学习进度约 {progress}%，建议今晚先回看 1 段课堂重点，再完成 1 次针对 {weakness} 的强化练习。",
            is_read=index % 3 == 0,
            publisher=0,
            push_time=iso_time(minutes=-16 - index),
            status="active",
        ),
        UserInbox(
            id=50000 + index * 10 + 3,
            user_id=user_id,
            type=4,
            title="课程群有新的协同消息",
            content=f"{course_code} 课程群里新增了 1 条与你当前学习方向相关的协同建议，适合继续接着当前页面推进。",
            is_read=False,
            publisher=course_id,
            push_time=iso_time(minutes=-6 - index),
            status="active",
        ),
    ]


def build_im_seed_payloads() -> tuple[list[dict], list[dict]]:
    session_specs = [
        {
            "id": 61001,
            "user_id": 1001,
            "title": "软件工程课程群",
            "scene": "course_group",
            "subtitle": "401 · 课程群 · 项目推进",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61002,
            "user_id": 1001,
            "title": "李老师",
            "scene": "peer_im",
            "subtitle": "主讲老师 · 软件工程",
            "peer_user_id": 2001,
            "peer_name": "李老师",
        },
        {
            "id": 61003,
            "user_id": 1002,
            "title": "前端工程化课程群",
            "scene": "course_group",
            "subtitle": "201 · 课程群 · 页面结构",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61004,
            "user_id": 1002,
            "title": "设计助教 阿澄",
            "scene": "peer_im",
            "subtitle": "助教私聊 · 版式建议",
            "peer_user_id": 2002,
            "peer_name": "设计助教 阿澄",
        },
        {
            "id": 61005,
            "user_id": 1006,
            "title": "多智能体实验群",
            "scene": "course_group",
            "subtitle": "301 · 课程群 · 工具调用",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61006,
            "user_id": 1006,
            "title": "AI 导师协同台",
            "scene": "system_agent",
            "subtitle": "系统协同 · 联网补资料",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61007,
            "user_id": 1008,
            "title": "资源运营课程群",
            "scene": "course_group",
            "subtitle": "101 · 课程群 · 资料编排",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61008,
            "user_id": 1008,
            "title": "课程运营助教",
            "scene": "peer_im",
            "subtitle": "助教私聊 · 连续学习台",
            "peer_user_id": 2003,
            "peer_name": "课程运营助教",
        },
        {
            "id": 61009,
            "user_id": 1009,
            "title": "测评反馈课程群",
            "scene": "course_group",
            "subtitle": "302 · 课程群 · 报告收束",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61010,
            "user_id": 1010,
            "title": "平台工程协同群",
            "scene": "course_group",
            "subtitle": "401 · 课程群 · 模块治理",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61011,
            "user_id": 1001,
            "title": "林知夏",
            "scene": "peer_im",
            "subtitle": "同学私聊 · 课堂联动",
            "peer_user_id": 1003,
            "peer_name": "林知夏",
        },
        {
            "id": 61012,
            "user_id": 1003,
            "title": "周予安",
            "scene": "peer_im",
            "subtitle": "同学私聊 · 页面收束",
            "peer_user_id": 1001,
            "peer_name": "周予安",
        },
        {
            "id": 61013,
            "user_id": 1004,
            "title": "数据表达课程群",
            "scene": "course_group",
            "subtitle": "205 · 课程群 · 图表叙事",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61014,
            "user_id": 1004,
            "title": "报告教练 陈序",
            "scene": "peer_im",
            "subtitle": "讲师私聊 · 报告提炼",
            "peer_user_id": 2004,
            "peer_name": "报告教练 陈序",
        },
        {
            "id": 61015,
            "user_id": 1005,
            "title": "答辩策略课程群",
            "scene": "course_group",
            "subtitle": "402 · 课程群 · 结构表达",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61016,
            "user_id": 1005,
            "title": "答辩助教 祁越",
            "scene": "peer_im",
            "subtitle": "助教私聊 · 话术排练",
            "peer_user_id": 2005,
            "peer_name": "答辩助教 祁越",
        },
        {
            "id": 61017,
            "user_id": 1006,
            "title": "赵清和",
            "scene": "peer_im",
            "subtitle": "同学私聊 · Agent 编排",
            "peer_user_id": 1007,
            "peer_name": "赵清和",
        },
        {
            "id": 61018,
            "user_id": 1007,
            "title": "沈砚舟",
            "scene": "peer_im",
            "subtitle": "同学私聊 · 联网资料",
            "peer_user_id": 1006,
            "peer_name": "沈砚舟",
        },
        {
            "id": 61019,
            "user_id": 1007,
            "title": "知识库运营台",
            "scene": "system_agent",
            "subtitle": "系统协同 · 资料入库",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61020,
            "user_id": 1008,
            "title": "资源策展组",
            "scene": "course_group",
            "subtitle": "110 · 课程群 · 资料分发",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61021,
            "user_id": 1009,
            "title": "测评助教 柳言",
            "scene": "peer_im",
            "subtitle": "助教私聊 · 错因复盘",
            "peer_user_id": 2006,
            "peer_name": "测评助教 柳言",
        },
        {
            "id": 61022,
            "user_id": 1010,
            "title": "平台运行协同台",
            "scene": "system_agent",
            "subtitle": "系统协同 · 状态治理",
            "peer_user_id": None,
            "peer_name": None,
        },
        {
            "id": 61023,
            "user_id": 1002,
            "title": "苏映雪",
            "scene": "peer_im",
            "subtitle": "同学私聊 · 首页改版",
            "peer_user_id": 1008,
            "peer_name": "苏映雪",
        },
        {
            "id": 61024,
            "user_id": 1008,
            "title": "顾临川",
            "scene": "peer_im",
            "subtitle": "同学私聊 · 资源布局",
            "peer_user_id": 1002,
            "peer_name": "顾临川",
        },
    ]

    message_specs = [
        (71001, 61001, "assistant:course", "今天先把需求、设计、实现、验证四段讲法收成一条主线，答辩会更顺。", -70),
        (71002, 61001, "user:1001", "我打算先改首页，再回到报告页补结论，这个顺序可以吗？", -64),
        (71003, 61001, "assistant:course", "可以，先把首页的主线说明收清楚，再把报告页压缩成可执行结论。", -58),
        (71004, 61002, "assistant:teacher", "你这轮更适合先讲系统为什么这样拆，而不是先展示页面。", -35),
        (71005, 61002, "user:1001", "明白，我先把工程主线和角色分工写出来。", -30),
        (71006, 61003, "assistant:course", "前端工程化这一节，重点还是页面结构、状态归属和信息密度控制。", -74),
        (71007, 61003, "user:1002", "那我首页是不是应该把上面的卡片继续压缩？", -68),
        (71008, 61003, "assistant:course", "对，先压高度，再把最关键动作提到第一视觉层。", -62),
        (71009, 61004, "assistant:ta", "你可以先把推荐区和 AI 区做主次分离，再补视觉节奏。", -28),
        (71010, 61005, "assistant:course", "这一组重点是让智能体自己判断是否联网、是否要补视频和扩展阅读。", -82),
        (71011, 61005, "user:1006", "我已经把联网工具接上了，接下来应该补课堂内生成链路。", -76),
        (71012, 61005, "assistant:course", "下一步就把讲义、导图、练习、PPT 和视频脚本统一进同一个资源生成流。", -70),
        (71013, 61006, "assistant:agent", "检测到当前问题依赖外部资料，并且本地知识库命中不足，已建议进入联网补充路径。", -22),
        (71014, 61006, "user:1006", "那就优先拉扩展阅读和免费视频线索。", -18),
        (71015, 61007, "assistant:course", "资料工作台不要只堆资源，要先帮用户判断下一步。", -66),
        (71016, 61007, "user:1008", "我准备把收藏、资源、课堂串成一条连续工作流。", -59),
        (71017, 61008, "assistant:ta", "可以把高频复习资料和当天待做动作放到同一屏，减少跳转。", -24),
        (71018, 61009, "assistant:course", "测评页更适合先给一句结论，再给分数和错因支撑。", -44),
        (71019, 61009, "user:1009", "我会把最近一次反馈压缩成 3 个行动项。", -38),
        (71020, 61010, "assistant:course", "平台工程这轮更适合先讲多页面联动、状态治理和数据来源统一。", -52),
        (71021, 61011, "user:1001", "你昨天说的首页信息密度，我刚压了一版，你帮我看还空不空？", -46),
        (71022, 61011, "user:1003", "上面那块还是能再收，关键动作前置就会像产品页很多。", -41),
        (71023, 61011, "user:1001", "行，我把画像和智能体协同塞进第一屏。", -36),
        (71024, 61012, "user:1001", "你那边如果切账号，能看到我这条私聊吗？", -33),
        (71025, 61012, "user:1003", "能收到，而且我这边显示成未读了，说明双边链路通了。", -29),
        (71026, 61013, "assistant:course", "图表表达先别追求满，先把结论、证据、趋势三层关系讲清楚。", -73),
        (71027, 61013, "user:1004", "我准备把五维图重画成更轻的能力地图。", -69),
        (71028, 61014, "assistant:teacher", "报告页左侧空白太多时，优先把右侧关键结论搬回主阅读流。", -31),
        (71029, 61014, "user:1004", "明白，我会把行动建议贴着能力图放。", -26),
        (71030, 61015, "assistant:course", "答辩结构先说问题，再讲系统如何拆，最后演示结果。", -60),
        (71031, 61015, "user:1005", "那我就不再先展示页面视觉，先把主线说透。", -55),
        (71032, 61016, "assistant:ta", "你可以准备 3 句固定话术，分别对应设计、数据、智能体三部分。", -22),
        (71033, 61017, "user:1006", "我想让导师自己判断是否联网、是否生成视频资料。", -28),
        (71034, 61017, "user:1007", "可以，把工具选择权交给 agent，前端只保留结果状态。", -24),
        (71035, 61018, "user:1006", "你那边知识库里免费公开视频线索补得怎么样了？", -21),
        (71036, 61018, "user:1007", "先补文本和阅读资料，视频线索做引用，不直接塞文件。", -18),
        (71037, 61019, "assistant:agent", "检测到本地资料不足，已将 6 条外部阅读线索标记为待审核入库。", -17),
        (71038, 61019, "assistant:agent", "建议优先补 React 高阶模式、多智能体编排、报告表达 3 个主题。", -14),
        (71039, 61020, "assistant:course", "资源工作台里，课程、讲义、PPT 最好形成连续消费链，不要各自成块。", -48),
        (71040, 61020, "user:1008", "我会把收藏、生成资料、随堂记录压到一条横向路径里。", -42),
        (71041, 61021, "assistant:ta", "最近一次测评更像是结构化表达问题，不完全是知识点没记住。", -19),
        (71042, 61021, "user:1009", "那我就把练习题和讲义一起配套生成。", -15),
        (71043, 61022, "assistant:agent", "当前站点多页面状态已同步，AI 导师、课堂、画像页使用同一学习上下文。", -12),
        (71044, 61022, "assistant:agent", "下一步建议统一历史会话、资源生成任务和页面行为埋点。", -9),
        (71045, 61023, "user:1002", "我改了首页推荐区，想让视频封面更大一点。", -25),
        (71046, 61023, "user:1008", "可以，视频封面放大以后再把文字压缩到一行结论。", -20),
        (71047, 61024, "user:1002", "收藏工作台第一屏还是有点高，你有更稳的排布建议吗？", -16),
        (71048, 61024, "user:1008", "把描述缩成一句，把状态和下一步压在同一行就行。", -11),
    ]

    sessions = [
        {
            "id": item["id"],
            "user_id": item["user_id"],
            "title": item["title"],
            "scene": item["scene"],
            "peer_user_id": item.get("peer_user_id"),
            "peer_name": item.get("peer_name"),
            "created_at": iso_time(minutes=-90 - item["id"] % 9),
            "updated_at": iso_time(minutes=-5 - item["id"] % 7),
        }
        for item in session_specs
    ]
    messages = [
        {
            "id": message_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "citations": subtitle,
            "created_at": iso_time(minutes=offset),
            "updated_at": iso_time(minutes=offset),
        }
        for message_id, session_id, role, content, offset in message_specs
        for subtitle in [next((item["subtitle"] for item in session_specs if item["id"] == session_id), None)]
    ]
    return sessions, messages


def build_demo_plan_payload(user: dict, plan_id: int) -> dict:
    course_id = int(user["state"]["course_id"])
    course_code = "software_engineering_4th"
    latest_score = int(user["learning_progress"]["latest_score"])
    progress = float(user["learning_progress"]["progress"])
    focus_topic = user["interest_direction"]["topics"][0]
    weakness = user["knowledge_base"]["weaknesses"][0]
    daily_minutes = int(user["learning_habit"]["daily_minutes"])
    completion_rate = round(progress * 100, 1)
    return {
        "plan_id": plan_id,
        "user_id": user["user_id"],
        "course_code": course_code,
        "course_id": course_id,
        "course_name": "软件工程与实践（第4版）",
        "summary": f"围绕 {focus_topic} 与 {weakness} 的个性化四阶段学习路径。",
        "progress_hint": f"当前完成度约 {completion_rate:.0f}%，建议继续按每天 {daily_minutes} 分钟推进。",
        "next_action": f"先完成 1 个关于 {weakness} 的强化任务，再进入课堂资源精读。",
        "risk_alerts": [f"{weakness} 仍需重点巩固"],
        "path_mode": "guided",
        "current_stage": "阶段 2：专题强化",
        "completion_rate": completion_rate,
        "dynamic_adjustments": [f"根据最近测评分数 {latest_score} 动态调整练习顺序"],
        "recommended_checkpoints": ["完成一轮随堂测评", "整理 2 条错因归纳", "让 AI 导师复盘一次"],
        "stages": [
            {
                "stage_no": 1,
                "stage_name": "目标对齐",
                "focus": "明确这轮主攻主题",
                "objective": f"围绕 {focus_topic} 明确学习目标与输出物",
                "estimated_days": 1,
                "status": "completed",
                "recommended_resource_types": ["course_overview", "lecture_note"],
                "completion_criteria": ["确定主题", "确认节奏"],
            },
            {
                "stage_no": 2,
                "stage_name": "专题强化",
                "focus": weakness,
                "objective": f"补齐 {weakness} 相关能力短板",
                "estimated_days": 3,
                "status": "in_progress",
                "recommended_resource_types": ["lecture_note", "practice_set", "mindmap"],
                "completion_criteria": ["完成讲义+练习", "拿到一轮测评分"],
            },
            {
                "stage_no": 3,
                "stage_name": "迁移应用",
                "focus": "把知识迁到项目/课堂场景",
                "objective": "形成可展示的课堂输出或项目表达",
                "estimated_days": 2,
                "status": "pending",
                "recommended_resource_types": ["course_overview", "slides"],
                "completion_criteria": ["完成一次迁移表达"],
            },
        ],
        "steps": [
            {
                "step_id": "goal-align",
                "day": 1,
                "title": "确认本轮目标",
                "tasks": ["看总览", "确认主攻主题"],
                "stage_no": 1,
                "node_type": "study",
                "status": "completed",
                "duration_minutes": 20,
                "weak_point_focus": [],
                "knowledge_points": [focus_topic],
                "recommended_resource_types": ["course_overview"],
                "resource_pushes": [],
            },
            {
                "step_id": "weakness-drill",
                "day": 2,
                "title": f"强化 {weakness}",
                "tasks": ["看讲义", "做练习", "记录错因"],
                "stage_no": 2,
                "node_type": "practice",
                "status": "in_progress",
                "duration_minutes": daily_minutes,
                "weak_point_focus": [weakness],
                "knowledge_points": [weakness, focus_topic],
                "recommended_resource_types": ["lecture_note", "practice_set"],
                "resource_pushes": [],
            },
            {
                "step_id": "ai-review",
                "day": 3,
                "title": "让 AI 导师带你复盘",
                "tasks": ["问 AI", "复盘错因", "整理讲义/PPT"],
                "stage_no": 2,
                "node_type": "review",
                "status": "pending",
                "duration_minutes": 25,
                "weak_point_focus": [weakness],
                "knowledge_points": [weakness],
                "recommended_resource_types": ["mindmap", "slides"],
                "resource_pushes": [],
            },
        ],
    }


DEMO_USERS = [
    {
        "user_id": 1001,
        "name": "陈星宇",
        "summary": "全栈方向，中级学习者，偏好项目驱动和结构化复盘。",
        "tags": ["全栈实践", "项目驱动", "结构化复盘", "稳定推进"],
        "knowledge_base": {"level": "intermediate", "strengths": ["React", "接口联调"], "weaknesses": ["系统设计", "测试体系"]},
        "cognitive_style": {"preferred_style": "structure_first", "note_style": "outline", "pace": "steady"},
        "learning_progress": {"current_course": "software_engineering_4th", "latest_score": 84, "progress": 0.68},
        "error_preference": {"common_mistakes": ["边界遗漏", "文档抽象不足"], "fix_style": "example_driven"},
        "interest_direction": {"topics": ["软件工程", "多智能体", "全栈项目"], "career_goal": "工程负责人"},
        "learning_habit": {"daily_minutes": 60, "preferred_time": "evening", "review_cycle_days": 2},
        "completeness": 92,
        "state": {"course_id": 401, "total_watched_seconds": 4680, "completed_sections": [1, 2, 3, 4], "last_event_type": "watch"},
    },
    {
        "user_id": 1002,
        "name": "林澈",
        "summary": "前端方向，重视界面表达和组件拆分，喜欢把课程知识整理成模板。",
        "tags": ["前端架构", "模板整理", "视觉表达", "组件拆分"],
        "knowledge_base": {"level": "intermediate", "strengths": ["组件抽象", "样式规范"], "weaknesses": ["性能诊断"]},
        "cognitive_style": {"preferred_style": "visual_first", "note_style": "component_map", "pace": "focused"},
        "learning_progress": {"current_course": "series-2", "latest_score": 88, "progress": 0.74},
        "error_preference": {"common_mistakes": ["状态归属不清", "页面信息密度过高"], "fix_style": "compare_and_refactor"},
        "interest_direction": {"topics": ["React", "设计系统", "前端工程化"], "career_goal": "前端架构师"},
        "learning_habit": {"daily_minutes": 50, "preferred_time": "night", "review_cycle_days": 1},
        "completeness": 89,
        "state": {"course_id": 201, "total_watched_seconds": 3920, "completed_sections": [1, 2, 3], "last_event_type": "practice"},
    },
    {
        "user_id": 1003,
        "name": "Emily UI",
        "summary": "交互设计方向，偏好高密度资料和视觉拆解，擅长把知识做成导图。",
        "tags": ["交互设计", "视觉拆解", "高密度资料", "脑图复盘"],
        "knowledge_base": {"level": "intermediate", "strengths": ["信息布局", "交互表达"], "weaknesses": ["代码实现"]},
        "cognitive_style": {"preferred_style": "visual_storytelling", "note_style": "mindmap", "pace": "immersive"},
        "learning_progress": {"current_course": "series-1", "latest_score": 79, "progress": 0.57},
        "error_preference": {"common_mistakes": ["实现细节忽略", "工程约束感弱"], "fix_style": "see_then_build"},
        "interest_direction": {"topics": ["设计系统", "学习产品", "动效"], "career_goal": "体验设计师"},
        "learning_habit": {"daily_minutes": 45, "preferred_time": "afternoon", "review_cycle_days": 3},
        "completeness": 86,
        "state": {"course_id": 101, "total_watched_seconds": 2860, "completed_sections": [1, 2], "last_event_type": "resource"},
    },
    {
        "user_id": 1004,
        "name": "宋知夏",
        "summary": "数据分析方向，喜欢把知识点转成图表、时间线和对照表。",
        "tags": ["数据表达", "图表思维", "总结型学习", "可视化"],
        "knowledge_base": {"level": "intermediate", "strengths": ["图表叙事", "归纳总结"], "weaknesses": ["复杂工程实现"]},
        "cognitive_style": {"preferred_style": "data_mapping", "note_style": "timeline", "pace": "steady"},
        "learning_progress": {"current_course": "course-4", "latest_score": 82, "progress": 0.49},
        "error_preference": {"common_mistakes": ["只看结论", "忽略上下文"], "fix_style": "timeline_review"},
        "interest_direction": {"topics": ["D3", "可视化", "学习报告"], "career_goal": "数据产品分析师"},
        "learning_habit": {"daily_minutes": 40, "preferred_time": "morning", "review_cycle_days": 2},
        "completeness": 84,
        "state": {"course_id": 301, "total_watched_seconds": 3180, "completed_sections": [1, 2], "last_event_type": "review"},
    },
    {
        "user_id": 1005,
        "name": "许嘉禾",
        "summary": "产品方向，关注功能表达、用户感知和最终答辩叙事。",
        "tags": ["产品表达", "用户视角", "答辩叙事", "体验判断"],
        "knowledge_base": {"level": "intermediate", "strengths": ["需求表达", "价值提炼"], "weaknesses": ["技术深挖"]},
        "cognitive_style": {"preferred_style": "goal_first", "note_style": "decision_log", "pace": "rhythmic"},
        "learning_progress": {"current_course": "contest_project_lab", "latest_score": 77, "progress": 0.53},
        "error_preference": {"common_mistakes": ["实现粒度不够", "技术约束预估不足"], "fix_style": "goal_backtracking"},
        "interest_direction": {"topics": ["产品设计", "项目答辩", "学习系统"], "career_goal": "AI 产品经理"},
        "learning_habit": {"daily_minutes": 35, "preferred_time": "evening", "review_cycle_days": 2},
        "completeness": 83,
        "state": {"course_id": 302, "total_watched_seconds": 2410, "completed_sections": [1], "last_event_type": "plan"},
    },
    {
        "user_id": 1006,
        "name": "罗亦凡",
        "summary": "AI 工程方向，擅长把联网检索、知识库、资源生成串成闭环。",
        "tags": ["AI 工程", "知识库", "联网检索", "多智能体"],
        "knowledge_base": {"level": "advanced", "strengths": ["Agent", "RAG", "工具接入"], "weaknesses": ["产品表达"]},
        "cognitive_style": {"preferred_style": "systematic_experiment", "note_style": "pipeline", "pace": "fast"},
        "learning_progress": {"current_course": "llm_app_intro", "latest_score": 91, "progress": 0.81},
        "error_preference": {"common_mistakes": ["忽略用户感知", "页面产品化不够"], "fix_style": "tool_then_ui"},
        "interest_direction": {"topics": ["多智能体", "向量检索", "资源生成"], "career_goal": "AI 应用工程师"},
        "learning_habit": {"daily_minutes": 70, "preferred_time": "late_night", "review_cycle_days": 1},
        "completeness": 95,
        "state": {"course_id": 301, "total_watched_seconds": 5520, "completed_sections": [1, 2, 3, 4], "last_event_type": "chat"},
    },
    {
        "user_id": 1007,
        "name": "周沐言",
        "summary": "后端方向，擅长把系统拆成稳定服务，偏好接口治理与联调闭环。",
        "tags": ["后端工程", "接口治理", "服务拆分", "联调推进"],
        "knowledge_base": {"level": "intermediate", "strengths": ["Spring", "接口设计"], "weaknesses": ["产品表达", "前端协同"]},
        "cognitive_style": {"preferred_style": "api_first", "note_style": "sequence_diagram", "pace": "steady"},
        "learning_progress": {"current_course": "spring_cloud_bootcamp", "latest_score": 86, "progress": 0.62},
        "error_preference": {"common_mistakes": ["只看接口不看场景", "联调时缺少状态追踪"], "fix_style": "trace_and_verify"},
        "interest_direction": {"topics": ["微服务", "接口联调", "服务治理"], "career_goal": "后端技术负责人"},
        "learning_habit": {"daily_minutes": 55, "preferred_time": "night", "review_cycle_days": 2},
        "completeness": 90,
        "state": {"course_id": 102, "total_watched_seconds": 3360, "completed_sections": [1, 2, 3], "last_event_type": "sync"},
    },
    {
        "user_id": 1008,
        "name": "沈知序",
        "summary": "课程运营方向，偏好把课程资料和学习路径整理成可直接复用的工作台。",
        "tags": ["课程运营", "资源编排", "资料整理", "流程设计"],
        "knowledge_base": {"level": "intermediate", "strengths": ["资料结构化", "流程梳理"], "weaknesses": ["代码实现"]},
        "cognitive_style": {"preferred_style": "content_first", "note_style": "resource_grid", "pace": "rhythmic"},
        "learning_progress": {"current_course": "ml_intro", "latest_score": 83, "progress": 0.66},
        "error_preference": {"common_mistakes": ["信息密度失控", "资料分层不清"], "fix_style": "group_then_refine"},
        "interest_direction": {"topics": ["学习产品", "课程编排", "内容工作台"], "career_goal": "学习产品运营"},
        "learning_habit": {"daily_minutes": 45, "preferred_time": "afternoon", "review_cycle_days": 2},
        "completeness": 88,
        "state": {"course_id": 101, "total_watched_seconds": 2980, "completed_sections": [1, 2, 3], "last_event_type": "resource"},
    },
    {
        "user_id": 1009,
        "name": "顾言辞",
        "summary": "测评方向，擅长从错题、趋势和报告里提炼出真正影响学习决策的信号。",
        "tags": ["测评分析", "错因归纳", "趋势洞察", "学习反馈"],
        "knowledge_base": {"level": "intermediate", "strengths": ["反馈设计", "结果分析"], "weaknesses": ["实操案例", "工程约束"]},
        "cognitive_style": {"preferred_style": "evidence_first", "note_style": "error_log", "pace": "careful"},
        "learning_progress": {"current_course": "contest_project_lab", "latest_score": 85, "progress": 0.58},
        "error_preference": {"common_mistakes": ["只看分数不看错因", "报告结论过长"], "fix_style": "score_then_reason"},
        "interest_direction": {"topics": ["学习报告", "评测系统", "反馈闭环"], "career_goal": "学习分析师"},
        "learning_habit": {"daily_minutes": 38, "preferred_time": "evening", "review_cycle_days": 1},
        "completeness": 87,
        "state": {"course_id": 302, "total_watched_seconds": 2640, "completed_sections": [1, 2], "last_event_type": "evaluation"},
    },
    {
        "user_id": 1010,
        "name": "程启航",
        "summary": "平台工程方向，关注课程系统的稳定性、资源分发与多角色协同治理。",
        "tags": ["平台工程", "架构治理", "系统稳定性", "协同流程"],
        "knowledge_base": {"level": "advanced", "strengths": ["系统架构", "平台治理"], "weaknesses": ["课堂表达"]},
        "cognitive_style": {"preferred_style": "system_view", "note_style": "architecture_board", "pace": "fast"},
        "learning_progress": {"current_course": "software_engineering_4th", "latest_score": 93, "progress": 0.84},
        "error_preference": {"common_mistakes": ["忽略用户感知", "过度从技术视角出发"], "fix_style": "system_then_user"},
        "interest_direction": {"topics": ["平台治理", "服务稳定性", "工程体系"], "career_goal": "平台架构师"},
        "learning_habit": {"daily_minutes": 72, "preferred_time": "late_night", "review_cycle_days": 1},
        "completeness": 96,
        "state": {"course_id": 401, "total_watched_seconds": 5880, "completed_sections": [1, 2, 3, 4, 5], "last_event_type": "review"},
    },
]


async def bootstrap_demo_learning_data() -> dict:
    LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
    engine = create_async_engine(SQLITE_DSN, future=True, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await ensure_chat_session_columns(engine)

    async with session_factory() as session:
        await session.execute(delete(ChatSessionReadState))
        await session.execute(delete(ChatMessage))
        await session.execute(delete(ChatSession))
        await session.execute(delete(TutoringFavorite))
        await session.execute(delete(TutoringAnswer))
        await session.execute(delete(TutoringQuestion))
        await session.execute(delete(TutoringSession))
        await session.execute(delete(LearningReply))
        await session.execute(delete(LearningQuestion))
        await session.execute(delete(LearningNote))
        await session.execute(delete(CourseCommentLike))
        await session.execute(delete(CourseComment))
        await session.execute(delete(VideoDanmaku))
        await session.execute(delete(UserInbox))
        await session.execute(delete(PlanStepProgress))
        await session.execute(delete(LearningPlan))
        await session.execute(delete(EvaluationRecord))
        await session.execute(delete(ProfileHistoryModel))
        await session.execute(delete(StudentProfileModel))
        await session.execute(delete(UserProfileSnapshot))
        await session.execute(delete(PersonalizedLearningState))
        await session.commit()

        for index, user in enumerate(DEMO_USERS, start=1):
            profile = StudentProfileModel(
                id=10000 + index,
                user_id=user["user_id"],
                version=1,
                knowledge_base=user["knowledge_base"],
                cognitive_style=user["cognitive_style"],
                learning_progress=user["learning_progress"],
                error_preference=user["error_preference"],
                interest_direction=user["interest_direction"],
                learning_habit=user["learning_habit"],
                tags=user["tags"],
                summary=user["summary"],
                completeness=user["completeness"],
                status=1,
                last_behavior_time=datetime.now(),
            )
            session.add(profile)
            await session.flush()

            session.add(
                ProfileHistoryModel(
                    id=20000 + index,
                    profile_id=profile.id,
                    user_id=user["user_id"],
                    version=1,
                    snapshot_data={
                        "knowledge_base": user["knowledge_base"],
                        "cognitive_style": user["cognitive_style"],
                        "learning_progress": user["learning_progress"],
                        "error_preference": user["error_preference"],
                        "interest_direction": user["interest_direction"],
                        "learning_habit": user["learning_habit"],
                        "tags": user["tags"],
                        "summary": user["summary"],
                    },
                    change_type=1,
                    change_description="初始化演示学习画像",
                    changed_dimensions="knowledge_base,cognitive_style,learning_progress,error_preference,interest_direction,learning_habit",
                )
            )

            session.add(
                UserProfileSnapshot(
                    id=30000 + index,
                    user_id=user["user_id"],
                    version=1,
                    profile_data={
                        "name": user["name"],
                        "summary": user["summary"],
                        "tags": user["tags"],
                        "learning_progress": user["learning_progress"],
                    },
                    source_summary="bootstrap_demo_learning_data",
                )
            )

            session.add(
                PersonalizedLearningState(
                    id=40000 + index,
                    user_id=user["user_id"],
                    course_id=user["state"]["course_id"],
                    total_watched_seconds=user["state"]["total_watched_seconds"],
                    completed_sections=user["state"]["completed_sections"],
                    last_event_type=user["state"]["last_event_type"],
                )
            )

            plan_id = 60000 + index
            plan_payload = build_demo_plan_payload(user, plan_id)
            session.add(
                LearningPlan(
                    id=plan_id,
                    user_id=user["user_id"],
                    course_code="software_engineering_4th",
                    status="generated",
                    summary=plan_payload["summary"],
                    plan_data=plan_payload,
                    created_at=iso_time(days=-2, minutes=-index),
                    updated_at=iso_time(minutes=-index),
                )
            )
            session.add_all(
                [
                    PlanStepProgress(
                        id=61000 + index * 10 + 1,
                        plan_id=plan_id,
                        user_id=user["user_id"],
                        step_id="goal-align",
                        status="completed",
                        last_action="complete",
                        progress_note="已完成目标对齐",
                        created_at=iso_time(days=-2, minutes=-index),
                        updated_at=iso_time(days=-1, minutes=-index),
                    ),
                    PlanStepProgress(
                        id=61000 + index * 10 + 2,
                        plan_id=plan_id,
                        user_id=user["user_id"],
                        step_id="weakness-drill",
                        status="in_progress",
                        last_action="resume",
                        progress_note="正在围绕薄弱项推进",
                        created_at=iso_time(days=-1, minutes=-index),
                        updated_at=iso_time(minutes=-index),
                    ),
                ]
            )

            latest_score = int(user["learning_progress"]["latest_score"])
            weak_a = user["knowledge_base"]["weaknesses"][0]
            weak_b = user["knowledge_base"]["weaknesses"][-1]
            eval_scores = [max(60, latest_score - 8), max(65, latest_score - 3), latest_score]
            eval_types = ["chapter", "stage", "chapter"]
            for eval_offset, score in enumerate(eval_scores, start=1):
                session.add(
                    EvaluationRecord(
                        id=70000 + index * 10 + eval_offset,
                        user_id=user["user_id"],
                        course_code="software_engineering_4th",
                        evaluation_type=eval_types[eval_offset - 1],
                        result_data={
                            "paper_id": 80000 + index * 10 + eval_offset,
                            "evaluation_type": eval_types[eval_offset - 1],
                            "overall_score": score,
                            "mastery_level": "proficient" if score >= 85 else "stable" if score >= 75 else "developing",
                            "report_summary": f"本轮测评显示 {weak_a} 仍需持续强化，但整体掌握正在提升。",
                            "weak_points": [weak_a, weak_b],
                            "knowledge_points": [user["interest_direction"]["topics"][0], weak_a, weak_b],
                        },
                        created_at=iso_time(days=-(4 - eval_offset), minutes=-index),
                        updated_at=iso_time(days=-(4 - eval_offset), minutes=-index),
                    )
                )

            session.add_all(build_inbox_items(user, index))

        im_sessions, im_messages = build_im_seed_payloads()
        session.add_all([ChatSession(**item) for item in im_sessions])
        session.add_all([ChatMessage(**item) for item in im_messages])

        comment_specs = [
            ("series-2", 0, 1002, "这节关于状态边界和上下文拆分讲得很适合直接迁回项目里。", 18),
            ("series-2", 0, 1003, "如果把这一节再配一张结构图，课堂吸收效率会更高。", 11),
            ("series-1", 0, 1001, "设计系统这部分更像在讲产品表达，不只是讲样式规范。", 16),
            ("series-1", 0, 1005, "这块如果结合答辩话术一起讲，产品感会更强。", 9),
            ("course-4", 0, 1004, "图表叙事那段很适合直接变成学习报告里的能力图。", 13),
            ("series-3", 0, 1006, "多智能体这一节最适合接资源生成和联网补充资料的演示。", 21),
            ("series-3", 0, 1008, "如果把资源编排链路一起讲出来，这节课的产品感会更完整。", 8),
            ("course-4", 0, 1009, "这里的图表结构特别适合拿来生成测评报告里的趋势卡。", 12),
            ("series-1", 0, 1007, "如果补一段接口联调视角，会更适合工程展示。", 7),
            ("series-2", 0, 1010, "这一节非常适合衔接到系统治理和组件边界策略。", 10),
        ]
        comment_id_seed = 5000
        like_id_seed = 90000
        for course_key, section_index, user_id, content, likes in comment_specs:
            comment = CourseComment(
                id=comment_id_seed,
                course_key=course_key,
                section_index=section_index,
                user_id=user_id,
                parent_comment_id=None,
                content=content,
                status="active",
                created_at=iso_time(minutes=-comment_id_seed % 37),
                updated_at=iso_time(minutes=-comment_id_seed % 19),
            )
            session.add(comment)
            for offset in range(likes):
                session.add(
                    CourseCommentLike(
                        id=like_id_seed + offset,
                        comment_id=comment_id_seed,
                        user_id=30000 + like_id_seed + offset,
                        status="active",
                        created_at=iso_time(minutes=-(offset + 1)),
                        updated_at=iso_time(minutes=-(offset + 1)),
                    )
                )
            comment_id_seed += 1
            like_id_seed += 100

        danmaku_specs = [
            ("series-2:0", 1002, "这段状态拆分太有用了", "#fb7299", "scroll", 18.2),
            ("series-2:0", 1003, "这里讲得比很多公开视频更清楚", "#60a5fa", "scroll", 34.8),
            ("series-2:0", 1006, "适合直接给 AI 导师接着做讲义", "#34d399", "top", 52.6),
            ("series-1:0", 1005, "这个案例很像活动页产品化过程", "#f59e0b", "scroll", 26.1),
            ("course-4:0", 1004, "这张图如果进报告会很加分", "#a78bfa", "bottom", 41.4),
            ("series-3:0", 1006, "这节最适合直接接联网检索和资料生成", "#22c55e", "scroll", 23.6),
            ("series-3:0", 1008, "资源链路如果一起展示，课堂就更完整了", "#f97316", "bottom", 37.2),
            ("series-1:0", 1007, "这段如果补接口联调视角会更工程化", "#38bdf8", "scroll", 45.3),
            ("course-4:0", 1009, "这个图表结构拿去做测评趋势页正合适", "#ef4444", "scroll", 28.4),
            ("series-2:0", 1010, "组件边界这一段太适合做平台规范沉淀了", "#8b5cf6", "top", 61.8),
        ]
        danmaku_id_seed = 7000
        for video_key, user_id, content, color, mode, start_time in danmaku_specs:
            resolved_course_id = 401
            resolved_section_id = 40111
            if video_key.startswith("series-1"):
                resolved_course_id = 201
                resolved_section_id = 20121
            elif video_key.startswith("series-2"):
                resolved_course_id = 401
                resolved_section_id = 40111
            elif video_key.startswith("series-3"):
                resolved_course_id = 301
                resolved_section_id = 30122
            elif video_key.startswith("course-4"):
                resolved_course_id = 302
                resolved_section_id = 30221
            session.add(
                VideoDanmaku(
                    id=danmaku_id_seed,
                    video_key=video_key,
                    user_id=user_id,
                    course_id=resolved_course_id,
                    section_id=resolved_section_id,
                    content=content,
                    color=color,
                    mode=mode,
                    start_time=start_time,
                    status="active",
                    created_at=iso_time(minutes=-danmaku_id_seed % 23),
                    updated_at=iso_time(minutes=-danmaku_id_seed % 17),
                )
            )
            danmaku_id_seed += 1

        tutoring_session_id = 880001
        tutoring_question_id = 990001
        tutoring_answer_id = 995001
        tutoring_favorite_id = 998001
        tutoring_specs = [
            (
                1001,
                401,
                40111,
                "如何把这一节软件工程内容整理成答辩里能讲清楚的主线？",
                "可以按 问题背景、过程模型、需求设计、实现验证 四段来讲，每段只保留一个最关键例子。",
                True,
            ),
            (
                1002,
                201,
                20121,
                "React 这里讲的状态边界，怎么迁到我们项目首页？",
                "先按模块拆状态，再把高频交互和低频展示分层，最后让 AI 导师只跟当前页面上下文联动。",
                False,
            ),
            (
                1006,
                301,
                30122,
                "如果智能体要自己判断是否联网补资料，应该依据什么？",
                "可以先判断问题是否依赖最新外部信息、当前知识库是否命中、以及是否需要视频或扩展阅读，再决定是否调用联网工具。",
                True,
            ),
            (
                1007,
                102,
                10221,
                "网关和配置中心这一节，怎么讲成一个稳定性闭环？",
                "可以按流量入口、配置分发、故障隔离和联调验证四段讲，最后再落到系统监控上。",
                False,
            ),
            (
                1008,
                101,
                10121,
                "课程资料工作台怎么讲得更像产品，而不是单纯资源堆砌？",
                "先讲用户为什么需要快速判断先学什么，再讲系统如何把资料、路径和答疑串成连续操作流。",
                True,
            ),
            (
                1009,
                302,
                30221,
                "测评报告里哪些信息最值得提到答辩第一页？",
                "优先放最近一次分数、薄弱点变化和下一步动作，避免堆太多解释性文字。",
                False,
            ),
            (
                1010,
                401,
                40131,
                "软件工程这门课怎样更自然地体现多角色协同？",
                "把主讲、助教、AI 导师、资料代理和测评代理分别映射到教学、资源、反馈和复盘四段流程里。",
                True,
            ),
        ]
        for user_id, course_id, section_id, question_text, answer_text, favorited in tutoring_specs:
            session.add(
                TutoringSession(
                    id=tutoring_session_id,
                    user_id=user_id,
                    course_id=course_id,
                    section_id=section_id,
                    session_status=0,
                    question_count=1,
                    start_time=datetime.now(),
                    end_time=None,
                    create_time=datetime.now(),
                    update_time=datetime.now(),
                )
            )
            session.add(
                TutoringQuestion(
                    id=tutoring_question_id,
                    session_id=tutoring_session_id,
                    user_id=user_id,
                    course_id=course_id,
                    section_id=section_id,
                    question_text=question_text,
                    question_images=[],
                    question_type="concept_explanation",
                    knowledge_points=["课程主线", "结构拆解", "资源生成"],
                    difficulty_level=2,
                    question_status=1,
                    has_answer=True,
                    is_escalated=False,
                    create_time=datetime.now(),
                    update_time=datetime.now(),
                )
            )
            session.add(
                TutoringAnswer(
                    id=tutoring_answer_id,
                    question_id=tutoring_question_id,
                    session_id=tutoring_session_id,
                    answer_source=0,
                    answerer_id=None,
                    answer_text=answer_text,
                    answer_diagrams=[],
                    answer_videos=[],
                    reference_sources=[],
                    confidence_score=88.0,
                    generation_time=1280,
                    is_helpful=True,
                    user_rating=5,
                    user_feedback="演示数据初始化",
                    view_count=3,
                    create_time=datetime.now(),
                    update_time=datetime.now(),
                )
            )
            if favorited:
                session.add(
                    TutoringFavorite(
                        id=tutoring_favorite_id,
                        user_id=user_id,
                        question_id=tutoring_question_id,
                        answer_id=tutoring_answer_id,
                        favorite_note="演示收藏",
                        create_time=datetime.now(),
                    )
                )
                tutoring_favorite_id += 1
            tutoring_session_id += 1
            tutoring_question_id += 1
            tutoring_answer_id += 1

        learning_question_id = 930001
        learning_reply_id = 940001
        learning_note_id = 950001
        learning_specs = [
            (
                1001,
                401,
                4011,
                40111,
                "这一节怎么串成答辩主线？",
                "我想把课堂、资料、测评和报告讲成一条连续链路，哪一页最适合先开场？",
                False,
                "建议先讲业务目标，再顺着课堂上下文、资料生成和学习报告往后推。",
                "先说项目目标，再落到多智能体如何协同完成学习闭环。",
                105,
            ),
            (
                1002,
                201,
                2011,
                20121,
                "状态边界怎么迁到首页？",
                "现在首页信息很多，我想知道这节 React 课里哪些拆分方式可以直接迁过去。",
                False,
                "先拆出推荐流、学习进度、AI 导师三个状态面，再做密度控制。",
                "把高频交互和静态信息分层，首页会立刻更清爽。",
                88,
            ),
            (
                1006,
                301,
                3012,
                30122,
                "联网补资料什么时候自动触发？",
                "如果让智能体自己判断要不要联网补充资料，它应该看哪些信号？",
                True,
                "优先判断知识库是否命中，再判断问题是否依赖最新资料或外部案例。",
                "智能体要先判断缺口，再决定要不要调 web search。",
                132,
            ),
            (
                1007,
                102,
                1022,
                10221,
                "网关治理这节最适合拿来讲什么？",
                "我想把微服务这一节讲成稳定性能力，而不只是配置和网关的堆砌。",
                False,
                "先讲流量入口和服务治理，再落到异常处理、日志和联调链路。",
                "网关不是单点功能，而是整条服务入口的稳定性抓手。",
                94,
            ),
            (
                1008,
                101,
                1012,
                10121,
                "资料工作台怎么更像一个连续学习台？",
                "我不想只是展示很多资料，我更想让用户知道先做什么、再做什么。",
                False,
                "把判断、进入、复习、追问这四个动作收成一条线，页面就会更像产品工作台。",
                "资料不是越多越好，而是要帮用户立刻进入下一步。",
                76,
            ),
            (
                1009,
                302,
                3022,
                30221,
                "报告卡片应该先放分数还是先放结论？",
                "我想让测评页更短一点，但又不想丢掉真正有用的信息。",
                False,
                "先放一个核心结论，再用分数和薄弱点去支撑，会比一上来堆指标更清楚。",
                "报告首页只保留最能驱动下一步决策的信息。",
                109,
            ),
            (
                1010,
                401,
                4013,
                40131,
                "这门课怎么体现多角色协作？",
                "如果要在软件工程课程里体现多智能体或多角色协同，最自然的切入是什么？",
                True,
                "可以把主讲、助教、AI 导师、资料代理和评测代理映射到同一学习链路里。",
                "一门课不是单个页面，而是一条由多角色协作完成的学习闭环。",
                148,
            ),
        ]
        for user_id, course_id, chapter_id, section_id, title, description, anonymity, reply_content, note_content, note_moment in learning_specs:
            session.add(
                LearningQuestion(
                    id=learning_question_id,
                    user_id=user_id,
                    course_id=course_id,
                    chapter_id=chapter_id,
                    section_id=section_id,
                    title=title,
                    description=description,
                    anonymity=anonymity,
                    status="active",
                    created_at=iso_time(minutes=-learning_question_id % 41),
                    updated_at=iso_time(minutes=-learning_question_id % 19),
                )
            )
            session.add(
                LearningReply(
                    id=learning_reply_id,
                    question_id=learning_question_id,
                    user_id=user_id,
                    answer_id=None,
                    target_reply_id=None,
                    target_user_id=None,
                    content=reply_content,
                    anonymity=anonymity,
                    liked_times=1 if user_id != 1006 else 2,
                    liked_user_ids=[1001, 1002] if user_id == 1006 else [1006],
                    status="active",
                    created_at=iso_time(minutes=-(learning_reply_id % 29)),
                    updated_at=iso_time(minutes=-(learning_reply_id % 13)),
                )
            )
            session.add(
                LearningNote(
                    id=learning_note_id,
                    user_id=user_id,
                    course_id=course_id,
                    chapter_id=chapter_id,
                    section_id=section_id,
                    content=note_content,
                    note_moment=note_moment,
                    is_private=False,
                    is_gathered=user_id != 1002,
                    status="active",
                    created_at=iso_time(minutes=-(learning_note_id % 23)),
                    updated_at=iso_time(minutes=-(learning_note_id % 11)),
                )
            )
            learning_question_id += 1
            learning_reply_id += 1
            learning_note_id += 1

        await session.commit()

    await engine.dispose()
    return {
        "sqlite_path": str(SQLITE_PATH),
        "seeded_users": len(DEMO_USERS),
        "seeded_im_sessions": len(im_sessions),
        "seeded_im_messages": len(im_messages),
        "seeded_comments": len(comment_specs),
        "seeded_danmaku": len(danmaku_specs),
        "seeded_tutoring_sessions": len(tutoring_specs),
        "seeded_learning_questions": len(learning_specs),
    }


async def main() -> None:
    result = await bootstrap_demo_learning_data()
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
