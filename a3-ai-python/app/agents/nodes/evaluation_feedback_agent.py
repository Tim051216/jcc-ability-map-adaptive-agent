from app.agents.nodes.assessment_agent import assessment_node
from app.agents.nodes.safety_agent import safety_node
from app.agents.state import LearningAgentState


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


async def evaluation_feedback_node(state: LearningAgentState) -> LearningAgentState:
    state = await assessment_node(state)

    course_name = state.get("course_name") or state.get("course_code") or "当前课程"
    intent = state.get("intent", "qa")
    base_answer = state.get("base_answer", "")
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
        parts = [
            base_answer,
            _build_plan_summary(plan),
            _build_resource_summary(resources),
            _build_evaluation_summary(evaluation),
        ]
        state["final_answer"] = "\n\n".join(part for part in parts if part)
    else:
        state["final_answer"] = base_answer

    state = await safety_node(state)
    trace = state.get("execution_trace", [])
    trace.append("evaluation_feedback")
    state["execution_trace"] = trace
    return state
