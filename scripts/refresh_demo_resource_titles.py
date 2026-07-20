from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATHS = [
    ROOT / "a3-ai-python" / "local_data" / "a3_ai_local.db",
    ROOT / "a3-ai-python" / "local_data" / "a3_real.db",
]


TITLE_SETS = {
    "requirements": {
        "lecture_note": "从访谈到规格说明：需求分析课堂手册",
        "mind_map": "需求边界、用例与数据流图速查图",
        "teaching_plan": "需求评审课件草案：场景、模型与验收标准",
        "quiz_set": "需求描述纠错与建模自测题单",
        "practice_set": "需求描述纠错与建模自测题单",
        "extended_reading": "真实项目需求变更案例阅读",
        "coding_lab": "需求条目验收标准拆解任务",
        "visual_illustration": "用户诉求到系统需求转化示意图",
        "ocr_notes": "需求评审白板记录整理",
    },
    "planning": {
        "lecture_note": "立项之前先问什么：可行性分析讲义",
        "mind_map": "技术、经济、运行、法律四维判断图",
        "teaching_plan": "研发策划汇报稿：范围、里程碑与风险",
        "quiz_set": "项目立项判断随堂题",
        "practice_set": "项目立项判断随堂题",
        "extended_reading": "失败立项案例与风险预案阅读",
        "coding_lab": "项目风险清单与优先级排序任务",
        "visual_illustration": "从项目想法到研发计划流程图",
        "ocr_notes": "立项讨论板书记录整理",
    },
    "delivery": {
        "lecture_note": "从需求到交付：设计、测试与管理讲义",
        "mind_map": "模块设计、测试层次与风险控制总览",
        "teaching_plan": "工程交付闭环课件草案",
        "quiz_set": "设计评审与测试策略练习题",
        "practice_set": "设计评审与测试策略练习题",
        "extended_reading": "缺陷复盘与质量保证案例阅读",
        "coding_lab": "接口清单与测试用例补全任务",
        "visual_illustration": "需求、设计、测试追踪关系图",
        "ocr_notes": "设计评审会板书整理",
    },
    "intro": {
        "lecture_note": "软件危机为什么会发生：第一章导学讲义",
        "mind_map": "生命周期与过程模型一页图",
        "teaching_plan": "软件工程导论课件草案",
        "quiz_set": "软件危机与过程模型课堂小测",
        "practice_set": "软件危机与过程模型课堂小测",
        "course_overview": "课程总览：软件工程方法从哪里来",
        "extended_reading": "从延期返工看软件工程方法阅读",
        "coding_lab": "过程模型场景匹配练习任务",
        "visual_illustration": "软件项目从想法到维护阶段图",
        "ocr_notes": "软件危机课堂板书整理",
    },
}

TITLE_VARIANTS = {
    ("requirements", "lecture_note"): [
        "从访谈到规格说明：需求分析课堂手册",
        "需求获取记录与规格说明整理稿",
        "用户故事、用例与验收标准讲义",
        "需求分析课前导读：边界、角色和场景",
    ],
    ("requirements", "mind_map"): [
        "需求边界、用例与数据流图速查图",
        "需求工程四步法结构图",
        "用户诉求到系统功能转换图",
    ],
    ("requirements", "quiz_set"): [
        "需求描述纠错与建模自测题单",
        "用例识别与需求边界随堂测",
        "需求规格说明书审查练习",
    ],
    ("requirements", "coding_lab"): [
        "需求条目验收标准拆解任务",
        "把用户口述改写成功能需求任务",
        "需求优先级与边界标注练习",
    ],
    ("requirements", "extended_reading"): [
        "真实项目需求变更案例阅读",
        "需求蔓延为什么会拖垮项目",
        "从模糊诉求到可验收需求的案例",
    ],
    ("requirements", "course_overview"): [
        "需求工程资料包：访谈、模型与评审",
        "第三章资料索引：需求获取到规格说明",
        "需求分析学习路线与资料入口",
    ],
    ("requirements", "assessment_guide"): [
        "需求评审检查清单",
        "需求分析测评前复习单",
        "需求建模评分要点",
    ],
    ("intro", "lecture_note"): [
        "软件危机为什么会发生：第一章导学讲义",
        "从延期返工看软件工程的由来",
        "软件生命周期与过程模型课堂笔记",
        "软件工程导论：问题、方法与工具",
    ],
    ("intro", "mind_map"): [
        "生命周期与过程模型一页图",
        "软件工程基础概念关系图",
        "软件危机成因与治理路径图",
    ],
    ("intro", "quiz_set"): [
        "软件危机与过程模型课堂小测",
        "生命周期阶段辨析题单",
        "瀑布、原型与迭代模型对比练习",
    ],
    ("intro", "extended_reading"): [
        "从延期返工看软件工程方法阅读",
        "软件危机经典表现案例摘读",
        "为什么软件项目需要工程化管理",
    ],
    ("intro", "coding_lab"): [
        "过程模型场景匹配练习任务",
        "生命周期阶段排序练习",
        "软件项目问题归因小任务",
    ],
    ("intro", "course_overview"): [
        "课程总览：软件工程方法从哪里来",
        "软件工程第一轮学习路线图",
        "课程资料入口：导论、过程与案例",
    ],
    ("intro", "micro_video"): [
        "软件危机 60 秒讲解脚本",
        "生命周期模型短视频分镜",
        "为什么要学软件工程动画稿",
    ],
    ("intro", "subtitle_transcript"): [
        "软件工程导论字幕整理",
        "过程模型视频逐段笔记",
        "软件危机讲解字幕稿",
    ],
    ("delivery", "lecture_note"): [
        "从需求到交付：设计、测试与管理讲义",
        "概要设计、详细设计与测试策略笔记",
        "工程交付闭环课堂手册",
    ],
    ("delivery", "teaching_plan"): [
        "工程交付闭环课件草案",
        "设计评审与测试策略汇报稿",
        "软件质量保证课堂展示稿",
    ],
    ("delivery", "quiz_set"): [
        "设计评审与测试策略练习题",
        "测试层次与质量控制随堂测",
        "项目管理风险识别题单",
    ],
    ("planning", "lecture_note"): [
        "立项之前先问什么：可行性分析讲义",
        "可行性分析与研发策划课堂手册",
        "从项目想法到实施计划导读",
    ],
    ("planning", "quiz_set"): [
        "项目立项判断随堂题",
        "技术经济运行可行性辨析题",
        "研发策划与风险预案练习",
    ],
}

SUMMARY_SETS = {
    "lecture_note": "按真实课堂讲解顺序整理，强调问题背景、章节主线和可复述的关键结论。",
    "mind_map": "把核心概念、阶段关系和交付物放在一张图里，适合课前预览和课后回看。",
    "teaching_plan": "面向课堂汇报和答辩展示的课件草案，包含开场问题、讲解顺序和收束页。",
    "quiz_set": "围绕易混概念和真实场景设计的小测题，用于检查是否真的理解本节内容。",
    "practice_set": "围绕易混概念和真实场景设计的小测题，用于检查是否真的理解本节内容。",
    "extended_reading": "补充真实工程案例和背景材料，避免只背概念、不知道怎么落地。",
    "coding_lab": "把抽象知识点拆成可操作任务，适合课堂演示、作业补充和答辩举例。",
    "visual_illustration": "用于讲义、课件或 AI 答疑页的结构示意图说明，帮助解释流程关系。",
    "ocr_notes": "根据课堂板书场景整理出的结构化笔记，保留老师讲解时的推导顺序。",
    "course_overview": "从课程目标、章节结构和学习路径三个角度整理的入口材料。",
}

SOURCE_HINTS = {
    "requirements": ["第三章", "需求", "用例", "数据流", "requirements"],
    "planning": ["第二章", "可行性", "研发策划", "立项"],
    "delivery": ["第四章", "设计", "测试", "项目管理", "交付"],
}


def infer_topic(title: str, content: str, source_titles: str) -> str:
    haystack = f"{title}\n{content[:2000]}\n{source_titles}".lower()
    for topic, hints in SOURCE_HINTS.items():
        if any(hint.lower() in haystack for hint in hints):
            return topic
    return "intro"


def normalize_resource_type(resource_type: str) -> str:
    return {
        "mindmap": "mind_map",
        "practice_set": "quiz_set",
        "assessment_guide": "quiz_set",
        "course_overview": "course_overview",
        "micro_video": "micro_video",
        "subtitle_transcript": "subtitle_transcript",
    }.get(resource_type, resource_type)


def rename_database(db_path: Path) -> int:
    if not db_path.exists():
        return 0
    connection = sqlite3.connect(db_path)
    try:
        rows = connection.execute(
            """
            select id, course_code, resource_type, title, content_markdown, source_titles
            from generated_resource
            where course_code = 'software_engineering_4th'
            """
        ).fetchall()
        changed = 0
        for resource_id, _course_code, resource_type, title, content, source_titles in rows:
            topic = infer_topic(str(title or ""), str(content or ""), str(source_titles or ""))
            normalized_type = normalize_resource_type(str(resource_type or ""))
            variants = TITLE_VARIANTS.get((topic, normalized_type))
            if variants:
                new_title = variants[int(resource_id) % len(variants)]
            else:
                new_title = TITLE_SETS[topic].get(normalized_type, TITLE_SETS[topic]["lecture_note"])
            new_summary = SUMMARY_SETS.get(str(resource_type or ""), "围绕当前章节整理的补充学习材料。")
            if new_title != title:
                context_raw = connection.execute(
                    "select generation_context from generated_resource where id = ?",
                    (resource_id,),
                ).fetchone()
                try:
                    context = json.loads(context_raw[0] or "{}") if context_raw else {}
                except Exception:
                    context = {}
                context["title_refreshed"] = True
                connection.execute(
                    """
                    update generated_resource
                    set title = ?, summary = ?, generation_context = ?
                    where id = ?
                    """,
                    (new_title, new_summary, json.dumps(context, ensure_ascii=False), resource_id),
                )
                changed += 1
        connection.commit()
        return changed
    finally:
        connection.close()


def main() -> None:
    total = 0
    for db_path in DB_PATHS:
        changed = rename_database(db_path)
        total += changed
        print(f"{db_path}: refreshed {changed} titles")
    print(f"total refreshed: {total}")


if __name__ == "__main__":
    main()
