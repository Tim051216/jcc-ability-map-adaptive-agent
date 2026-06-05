from app.core.constants import PROFILE_DIMENSIONS, RESOURCE_TYPES
from app.schemas.java_models import JavaUserProfile


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def build_profile_payload(
    *,
    user_id: int,
    course_code: str | None,
    learning_goal: str | None,
    dialogue: list[str],
    user_profile: JavaUserProfile | None = None,
) -> dict:
    dialogue_text = " ".join(item.strip() for item in dialogue if item).lower()
    raw_text = " ".join(item.strip() for item in dialogue if item)

    grade = (user_profile.grade or "") if user_profile else ""
    major = (user_profile.major or "") if user_profile else ""
    college = (user_profile.college or "") if user_profile else ""

    if _contains_any(dialogue_text, ["基础", "入门", "不会", "刚学"]):
        foundation_label = "基础起步"
        foundation_score = 45
    elif _contains_any(dialogue_text, ["项目", "优化", "泛化", "调参", "评估"]):
        foundation_label = "进阶提升"
        foundation_score = 72
    else:
        foundation_label = "中等基础"
        foundation_score = 60

    if _contains_any(dialogue_text, ["例子", "图", "可视化", "演示"]):
        cognitive_label = "案例图解型"
    elif _contains_any(dialogue_text, ["步骤", "计划", "分阶段", "路线"]):
        cognitive_label = "结构规划型"
    else:
        cognitive_label = "互动探索型"

    if _contains_any(dialogue_text, ["3天", "三天", "冲刺", "尽快", "比赛"]):
        progress_label = "冲刺推进"
    elif _contains_any(dialogue_text, ["复习", "巩固", "查漏补缺"]):
        progress_label = "复习巩固"
    else:
        progress_label = "持续学习"

    weak_focus = []
    if _contains_any(dialogue_text, ["过拟合", "泛化", "评估"]):
        weak_focus.append("模型评估与过拟合")
    if _contains_any(dialogue_text, ["特征", "预处理"]):
        weak_focus.append("特征工程")
    if not weak_focus and course_code:
        weak_focus.append(f"{course_code} 核心知识点")

    interest_tags = []
    if course_code:
        interest_tags.append(course_code)
    if learning_goal:
        interest_tags.append(learning_goal)
    if major:
        interest_tags.append(major)

    preferred_resources = ["lecture_note", "practice_set"]
    if _contains_any(dialogue_text, ["代码", "实操", "实验"]):
        preferred_resources.append("coding_lab")
    if _contains_any(dialogue_text, ["图", "导图"]):
        preferred_resources.append("mindmap")

    habit_tags = []
    if _contains_any(dialogue_text, ["每天", "计划", "打卡"]):
        habit_tags.append("节奏驱动")
    if _contains_any(dialogue_text, ["练习", "刷题", "题"]):
        habit_tags.append("练习强化")
    if _contains_any(dialogue_text, ["讲义", "资料", "笔记"]):
        habit_tags.append("笔记沉淀")
    if not habit_tags:
        habit_tags.append("对话触发")

    dimensions = {
        "knowledge_foundation": {
            "label": "知识基础",
            "current_level": foundation_label,
            "score": foundation_score,
            "analysis": f"结合专业 {major or '未提供'}、年级 {grade or '未提供'} 与当前对话内容推断的知识基础水平。",
            "evidence": [item for item in [major, grade, raw_text[:80] if raw_text else None] if item],
            "study_advice": "先明确当前课程的核心定义、概念边界和基础例题，再进入更复杂的推理与迁移。",
        },
        "cognitive_style": {
            "label": "认知风格",
            "current_level": cognitive_label,
            "score": 78,
            "analysis": "根据提问方式判断更偏向案例图解、分步规划还是互动探索式学习。",
            "evidence": [raw_text[:100]] if raw_text else ["默认采用对话驱动分析"],
            "study_advice": "后续资源优先按该认知风格生成，减少理解阻力。",
        },
        "learning_progress": {
            "label": "学习进度",
            "current_level": progress_label,
            "score": 58,
            "analysis": "根据任务时限、复习倾向和当前目标判断处于冲刺、复习或持续学习阶段。",
            "evidence": [learning_goal] if learning_goal else [raw_text[:60] if raw_text else "当前未提供明确阶段目标"],
            "study_advice": "建议用阶段任务和节点打卡来约束学习推进，后续路径规划将以此作为节奏依据。",
        },
        "weak_point_preference": {
            "label": "易错点偏好",
            "current_level": "待重点关注",
            "score": 56,
            "analysis": "通过当前需求和课程主题识别优先补强的薄弱知识点。",
            "evidence": weak_focus,
            "study_advice": "后续优先推送围绕薄弱点的讲义、练习和评估题。",
        },
        "interest_orientation": {
            "label": "兴趣取向",
            "current_level": "专业关联型",
            "score": 70,
            "analysis": "结合专业背景、课程代码和学习目标识别当前兴趣方向。",
            "evidence": interest_tags or ["待补充兴趣偏好"],
            "study_advice": "后续资源将优先围绕当前课程与目标，减少无关信息干扰。",
        },
        "learning_habit": {
            "label": "学习习惯",
            "current_level": "任务驱动",
            "score": 68,
            "analysis": "根据对话中的计划、练习与资料偏好推断学习习惯。",
            "evidence": habit_tags,
            "study_advice": "建议通过固定节奏的任务卡、错题回顾和资源收藏形成稳定学习闭环。",
        },
    }

    return {
        "user_id": user_id,
        "profile_version": 2,
        "summary": "已基于六维学习画像完成对用户当前学习状态的结构化分析，可直接驱动资源生成、路径规划与效果评估闭环。",
        "dimension_order": PROFILE_DIMENSIONS,
        "dimensions": dimensions,
        "profile_tags": [tag for tag in [major, college, grade, *weak_focus, *interest_tags] if tag][:10],
        "recommended_resource_types": [item for item in RESOURCE_TYPES if item in preferred_resources],
        "source_summary": "对话输入 + 用户基础信息 + 课程上下文",
    }
