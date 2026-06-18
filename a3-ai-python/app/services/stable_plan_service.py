from __future__ import annotations

from app.schemas.plan import (
    LearningPlanResponse,
    LearningPlanStage,
    LearningPlanStep,
    PlanProgressResponse,
    PlanStepProgressItem,
)


class PlanService:
    def build_starter_plan(
        self,
        *,
        user_id: int,
        course_code: str,
        course_id: int | None = None,
        course_name: str | None = None,
    ) -> LearningPlanResponse:
        resolved_course_name = course_name or self._course_label(course_code)
        stages = [
            LearningPlanStage(
                stage_no=1,
                stage_name="目标对齐",
                focus="先确认这一轮最值得优先推进的学习目标",
                objective=f"明确你在 {resolved_course_name} 当前最想先拿下的内容。",
                estimated_days=1,
                status="in_progress",
                recommended_resource_types=["lecture_note", "mind_map"],
                completion_criteria=["确定当前目标", "明确先学哪个知识点"],
            ),
            LearningPlanStage(
                stage_no=2,
                stage_name="专题强化",
                focus="围绕核心知识点完成一轮学习与练习",
                objective="把刚确定的目标推进成一轮可完成的小闭环。",
                estimated_days=2,
                status="pending",
                recommended_resource_types=["quiz_set", "teaching_plan"],
                completion_criteria=["完成一段专注学习", "完成一组相关练习"],
            ),
            LearningPlanStage(
                stage_no=3,
                stage_name="复盘迁移",
                focus="复盘收获，并决定下一步继续补哪里",
                objective="把这一轮学习沉淀为可复用的理解和下一步动作。",
                estimated_days=1,
                status="pending",
                recommended_resource_types=["mind_map", "lecture_note"],
                completion_criteria=["写下一条复盘记录", "确定下一步行动"],
            ),
        ]
        steps = [
            LearningPlanStep(
                step_id="starter-step-1",
                day=1,
                title="确认当前最优先的学习目标",
                objective=f"先选出你在 {resolved_course_name} 这一轮最值得先完成的内容。",
                tasks=[
                    "快速浏览当前页面，找出最需要先解决的知识点。",
                    "用一句话写清楚你接下来要先完成什么。",
                ],
                checkpoint="你能说明这一轮先学什么，以及为什么先学它。",
                stage_no=1,
                stage_name="目标对齐",
                node_type="study_task",
                status="in_progress",
                duration_minutes=20,
                recommended_resource_types=["lecture_note"],
            ),
            LearningPlanStep(
                step_id="starter-step-2",
                day=1,
                title="完成一段聚焦练习",
                objective="借助一份资料或一组练习，把当前知识点往前推进一截。",
                tasks=[
                    "学完一段核心讲解或一份重点资料。",
                    "完成一组小练习或一个检查点。",
                ],
                checkpoint="这一轮结束后，手里已经有一份明确的学习产出。",
                stage_no=2,
                stage_name="专题强化",
                node_type="practice_task",
                status="pending",
                duration_minutes=35,
                recommended_resource_types=["quiz_set", "teaching_plan"],
            ),
            LearningPlanStep(
                step_id="starter-step-3",
                day=1,
                title="写一条复盘，并确定下一步",
                objective="把刚学会的内容沉淀下来，并决定接下来继续补什么。",
                tasks=[
                    "写下这一轮真正搞懂的一点。",
                    "决定下一步是继续练习，还是回头补基础。",
                ],
                checkpoint="你已经留下复盘记录，并做出了下一步决定。",
                stage_no=3,
                stage_name="复盘迁移",
                node_type="review_task",
                status="pending",
                duration_minutes=15,
                recommended_resource_types=["mind_map", "lecture_note"],
            ),
        ]
        return LearningPlanResponse(
            plan_id=60001,
            user_id=user_id,
            course_code=course_code,
            course_id=course_id,
            course_name=resolved_course_name,
            summary=f"已为 {resolved_course_name} 生成一条可直接执行的学习路径。",
            progress_hint="系统会结合你的当前目标、学习进度和画像，继续细化后续安排。",
            next_action="先完成第一个步骤，再继续推进后续强化与复盘。",
            risk_alerts=[],
            path_mode="laddered",
            current_stage=stages[0].focus,
            completion_rate=0.0,
            dynamic_adjustments=["完成首轮任务后，系统会根据你的表现继续调整路径。"],
            recommended_checkpoints=["先完成第一轮学习，再看哪些点还需要继续补。"],
            stages=stages,
            steps=steps,
        )

    async def get_plan(self, plan_id: int) -> LearningPlanResponse | None:
        return self.build_starter_plan(
            user_id=1001,
            course_code="software_engineering_4th",
            course_id=401,
            course_name="软件工程与实践（第4版）",
        ).model_copy(update={"plan_id": plan_id})

    async def get_latest_plan(self, user_id: int, course_code: str) -> LearningPlanResponse | None:
        return self.build_starter_plan(
            user_id=user_id,
            course_code=course_code,
            course_id=401 if course_code == "software_engineering_4th" else None,
            course_name=self._course_label(course_code),
        )

    async def update_step_status(self, plan_id: int, user_id: int, step_id: str, action: str) -> PlanProgressResponse:
        status = "completed" if action == "complete" else "in_progress" if action == "resume" else "paused"
        return PlanProgressResponse(
            plan_id=plan_id,
            user_id=user_id,
            completion_rate=33.0 if status == "completed" else 0.0,
            completed_steps=1 if status == "completed" else 0,
            total_steps=3,
            items=[
                PlanStepProgressItem(
                    step_id=step_id,
                    status=status,
                    progress_note="本地演示环境已更新步骤状态。",
                    last_action=action,
                    updated_at="2026-06-16T09:00:00Z",
                )
            ],
        )

    async def get_plan_progress(self, plan_id: int, user_id: int) -> PlanProgressResponse:
        return PlanProgressResponse(
            plan_id=plan_id,
            user_id=user_id,
            completion_rate=0.0,
            completed_steps=0,
            total_steps=3,
            items=[],
        )

    def _course_label(self, course_code: str) -> str:
        mapping = {
            "software_engineering_4th": "软件工程与实践（第4版）",
            "vue3_engineering": "Vue 3 工程化实战",
            "ml_intro": "机器学习导论",
        }
        return mapping.get(course_code, course_code.replace("_", " ").title())
