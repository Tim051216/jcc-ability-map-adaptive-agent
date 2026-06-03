from __future__ import annotations

import asyncio
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


DSN = "postgresql+asyncpg://a3_ai:a3_ai_123@127.0.0.1:15432/a3_ai"


QUESTION_UPDATES: dict[int, dict[str, object]] = {
    1866337774713501317: {
        "question_text": "请说明软件工程中相近概念的区别，并结合课程案例解释它们的实际作用。",
        "knowledge_points": ["软件工程", "概念辨析", "课程答疑"],
        "question_type": "概念理解",
    },
    1866336940662175796: {
        "question_text": "请结合软件工程课程内容，分析两个相近概念的联系、区别与落地场景。",
        "knowledge_points": ["软件工程", "概念辨析", "案例分析"],
        "question_type": "概念理解",
    },
    1864849096718788490: {
        "question_text": "请解释批处理任务中串行执行与并行执行的区别，以及各自适用场景。",
        "knowledge_points": ["批处理任务", "串行执行", "并行执行"],
        "question_type": "概念理解",
    },
    1864848331790393928: {
        "question_text": "请解释 Worker 线程与主线程的职责分工，以及多线程处理的优势。",
        "knowledge_points": ["Worker线程", "主线程", "并发处理"],
        "question_type": "概念理解",
    },
    1864848276148068422: {
        "question_text": "请解释需求分析阶段最核心的工作内容。",
        "knowledge_points": ["需求分析"],
        "question_type": "概念理解",
    },
    1864847935460626322: {
        "question_text": "请说明需求分析与概要设计的区别，并给出一个项目中的例子。",
        "knowledge_points": ["需求分析", "概要设计"],
        "question_type": "概念理解",
    },
    1864847935158643644: {
        "question_text": "请从目标、产出物和参与角色三个方面，对比需求分析与概要设计。",
        "knowledge_points": ["需求分析", "概要设计", "系统设计"],
        "question_type": "概念理解",
    },
    1864847935086676928: {
        "question_text": "请结合课程项目，说明需求分析与概要设计分别解决什么问题。",
        "knowledge_points": ["需求分析", "概要设计", "课程项目"],
        "question_type": "概念理解",
    },
    1864812087537984450: {
        "question_text": "请解释接口测试与单元测试的区别，并说明各自的验证重点。",
        "knowledge_points": ["接口测试", "单元测试"],
        "question_type": "概念理解",
    },
    1864811877025003468: {
        "question_text": "请说明黑盒测试与白盒测试的区别，以及它们在项目中的配合方式。",
        "knowledge_points": ["黑盒测试", "白盒测试"],
        "question_type": "概念理解",
    },
    1864811800741913574: {
        "question_text": "请比较黑盒测试与白盒测试的适用阶段。",
        "knowledge_points": ["黑盒测试", "白盒测试"],
        "question_type": "概念理解",
    },
}


ANSWER_TOPIC_REPLACEMENTS: dict[int, list[tuple[str, str]]] = {
    1864849096718788490: [("mix、after、batch", "批处理任务、串行执行、并行执行")],
    1864848331790393928: [("mix、worker", "Worker线程、主线程")],
    1864847935460626322: [
        ("???????????,??????????", "需求分析、概要设计"),
        ("????????????", "需求分析、概要设计"),
    ],
    1864847935158643644: [
        ("???????????,??????????", "需求分析、概要设计"),
        ("????????????", "需求分析、概要设计"),
    ],
    1864847935086676928: [
        ("???????????,??????????", "需求分析、概要设计"),
        ("????????????", "需求分析、概要设计"),
    ],
    1864812087537984450: [
        ("??????????????", "接口测试、单元测试"),
        ("????????????", "接口测试、单元测试"),
    ],
    1864811877025003468: [
        ("???????????????,????????", "黑盒测试、白盒测试"),
        ("????????????", "黑盒测试、白盒测试"),
    ],
}


async def cleanup() -> None:
    engine = create_async_engine(DSN)
    async with engine.begin() as conn:
        for question_id, payload in QUESTION_UPDATES.items():
            await conn.execute(
                text(
                    """
                    UPDATE tutoring_question
                    SET question_text = :question_text,
                        knowledge_points = CAST(:knowledge_points AS json),
                        question_type = :question_type,
                        update_time = NOW()
                    WHERE id = :question_id
                    """
                ),
                {
                    "question_id": question_id,
                    "question_text": payload["question_text"],
                    "knowledge_points": json.dumps(payload["knowledge_points"], ensure_ascii=False),
                    "question_type": payload["question_type"],
                },
            )

        for question_id, replacements in ANSWER_TOPIC_REPLACEMENTS.items():
            result = await conn.execute(
                text(
                    """
                    SELECT id, answer_text
                    FROM tutoring_answer
                    WHERE question_id = :question_id
                    ORDER BY create_time DESC
                    LIMIT 1
                    """
                ),
                {"question_id": question_id},
            )
            row = result.first()
            if row is None:
                continue

            answer_id, answer_text = row
            updated_text = answer_text or ""
            for old, new in replacements:
                updated_text = updated_text.replace(old, new)

            await conn.execute(
                text(
                    """
                    UPDATE tutoring_answer
                    SET answer_text = :answer_text,
                        update_time = NOW()
                    WHERE id = :answer_id
                    """
                ),
                {"answer_id": answer_id, "answer_text": updated_text},
            )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(cleanup())
