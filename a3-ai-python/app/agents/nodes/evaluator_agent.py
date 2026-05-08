from app.agents.state import LearningAgentState
from app.services.answer_service import AnswerService


def _build_plan_summary(plan: dict) -> str:
    steps = plan.get("steps", [])
    if not steps:
        return ""
    lines = ["学习路径建议："]
    for step in steps[:3]:
        lines.append(f"- 第 {step.get('day')} 天：{step.get('title')}")
    return "\n".join(lines)


def _build_resource_summary(resources: list[dict]) -> str:
    if not resources:
        return ""
    lines = ["推荐资源："]
    for resource in resources[:3]:
        lines.append(f"- {resource.get('title')}")
    return "\n".join(lines)


def _build_evaluation_summary(evaluation: dict) -> str:
    if not evaluation:
        return ""
    lines = [
        f"学习评估：总分 {evaluation.get('overall_score', '--')}，掌握等级 {evaluation.get('mastery_level', '--')}",
    ]
    if evaluation.get("report_summary"):
        lines.append(evaluation["report_summary"])
    for suggestion in (evaluation.get("suggestions") or [])[:2]:
        lines.append(f"- {suggestion}")
    return "\n".join(lines)


async def evaluator_node(state: LearningAgentState) -> LearningAgentState:
    course_name = state.get("course_name") or state.get("course_code") or "当前课程"
    intent = state.get("intent", "qa")
    hits = state.get("retrieved_chunks", [])
    plan = state.get("plan", {})
    resources = state.get("resources", [])
    evaluation = state.get("evaluation", {})

    if intent == "study_plan":
        parts = [
            plan.get("summary", f"已为 {course_name} 生成学习路径。"),
            _build_plan_summary(plan),
            _build_evaluation_summary(evaluation),
        ]
        state["final_answer"] = "\n\n".join(part for part in parts if part)
    elif intent == "resource_generation":
        parts = [
            f"已围绕 {course_name} 生成学习资源建议。",
            _build_resource_summary(resources),
        ]
        state["final_answer"] = "\n\n".join(part for part in parts if part)
    elif intent == "comprehensive":
        answer = await AnswerService().answer_with_context(
            question=state.get("user_input", ""),
            course_name=course_name,
            context_chunks=hits,
        )
        parts = [
            answer,
            _build_plan_summary(plan),
            _build_resource_summary(resources),
            _build_evaluation_summary(evaluation),
        ]
        state["final_answer"] = "\n\n".join(part for part in parts if part)
    else:
        state["final_answer"] = await AnswerService().answer_with_context(
            question=state.get("user_input", ""),
            course_name=course_name,
            context_chunks=hits,
        )

    trace = state.get("execution_trace", [])
    trace.append("evaluator")
    state["execution_trace"] = trace
    return state
