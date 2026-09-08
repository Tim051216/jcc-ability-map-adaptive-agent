"""Seed clearly labelled demo trial feedback into the local SQLite database.

This script is for frontend integration only. It never deletes rows and never
creates data that can be presented as real contest-user evidence.
"""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.db.models.job_trial_feedback import JobTrialFeedback  # noqa: E402
from app.db.session import ensure_sqlite_schema, sqlite_session_factory  # noqa: E402

DEMO_FEEDBACK = (
    {
        "user_id": 9901,
        "course_id": 401,
        "participant_role": "student",
        "identity_description": "演示数据：软件技术专业学生",
        "trial_task": "完成岗位诊断并执行一条学习建议",
        "strengths": "步骤清晰，能看到当前薄弱项。",
        "problems": "首次进入时不清楚从哪里开始。",
        "improvement_suggestions": "突出显示开始诊断按钮。",
        "overall_rating": 4,
        "consent_to_quote": False,
    },
    {
        "user_id": 9902,
        "course_id": 401,
        "participant_role": "teacher",
        "identity_description": "演示数据：专业教师",
        "trial_task": "查看班级岗位能力分析并调整一项教学建议",
        "strengths": "能力变化和建议动作关联直观。",
        "problems": "班级筛选项还不够明显。",
        "improvement_suggestions": "增加按专业和班级的筛选入口。",
        "overall_rating": 5,
        "consent_to_quote": False,
    },
    {
        "user_id": 9903,
        "course_id": 401,
        "participant_role": "enterprise_mentor",
        "identity_description": "演示数据：企业导师",
        "trial_task": "从岗位要求进入能力诊断并查看学习路径",
        "strengths": "岗位要求到训练任务的链路完整。",
        "problems": "部分岗位术语需要补充说明。",
        "improvement_suggestions": "为岗位术语增加简短解释和示例。",
        "overall_rating": 4,
        "consent_to_quote": False,
    },
)


async def seed() -> int:
    await ensure_sqlite_schema()
    inserted = 0
    async with sqlite_session_factory() as session:
        for values in DEMO_FEEDBACK:
            exists = await session.scalar(
                select(JobTrialFeedback.id).where(
                    JobTrialFeedback.user_id == values["user_id"],
                    JobTrialFeedback.course_id == values["course_id"],
                    JobTrialFeedback.identity_description == values["identity_description"],
                )
            )
            if exists is not None:
                continue
            session.add(JobTrialFeedback(**values))
            inserted += 1
        await session.commit()
    return inserted


async def main() -> None:
    inserted = await seed()
    print(f"Inserted {inserted} demo feedback row(s); existing rows were left unchanged.")
    print("Query examples:")
    print("  GET /api/v1/student-portal/job-learning/trial-feedback?user_id=9901&course_id=401")
    print("  GET /api/v1/student-portal/job-learning/trial-feedback?user_id=9902&course_id=401")
    print("These rows are demo data, not real user feedback or contest evidence.")


if __name__ == "__main__":
    asyncio.run(main())
