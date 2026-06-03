"""
Diagram generator agent for tutoring answers.
Generates lightweight Mermaid diagrams only when the user explicitly needs visual structure.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.logging import logger


class DiagramGeneratorAgent:
    """Generate Mermaid diagrams for tutoring answers without extra LLM latency."""

    async def generate_diagram(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        answer_text: str,
    ) -> dict[str, Any]:
        logger.info("diagram_generator.start")

        if not self._should_generate_diagram(question_text, answer_text):
            logger.info("diagram_generator.skip")
            return {"diagrams": [], "diagram_types": []}

        diagram_type = self._determine_diagram_type(question_text, answer_text)
        mermaid_code = self._build_fallback_diagram(question_analysis, diagram_type)
        title = self._build_diagram_title(question_analysis, diagram_type)

        logger.info("diagram_generator.completed", diagram_type=diagram_type, diagram_count=1)
        return {
            "diagrams": [
                {
                    "diagram_type": diagram_type,
                    "title": title,
                    "render_engine": "mermaid",
                    "mermaid_code": mermaid_code,
                }
            ],
            "diagram_types": [diagram_type],
        }

    @staticmethod
    def _should_generate_diagram(question_text: str, answer_text: str) -> bool:
        prompt = f"{question_text}\n{answer_text}".lower()
        explicit_markers = (
            "流程图",
            "思维导图",
            "图解",
            "画图",
            "结构图",
            "关系图",
            "时序图",
            "用图",
        )
        return any(marker in prompt for marker in explicit_markers)

    @staticmethod
    def _determine_diagram_type(question_text: str, answer_text: str) -> str:
        prompt = f"{question_text}\n{answer_text}"
        if any(marker in prompt for marker in ("思维导图", "脑图")):
            return "mindmap"
        if any(marker in prompt for marker in ("关系图", "结构图", "依赖")):
            return "graph"
        return "flowchart"

    @staticmethod
    def _build_diagram_title(question_analysis: dict[str, Any], diagram_type: str) -> str:
        concept = str(question_analysis.get("core_concept") or "").strip() or "知识图解"
        suffix = {
            "flowchart": "流程图",
            "mindmap": "思维导图",
            "graph": "关系图",
        }.get(diagram_type, "图解")
        return f"{concept[:20]} {suffix}"

    @staticmethod
    def _safe_label(text: str, max_len: int = 18) -> str:
        cleaned = re.sub(r"\s+", " ", text or "").strip().replace('"', "")
        return cleaned[:max_len] or "关键点"

    def _build_fallback_diagram(self, question_analysis: dict[str, Any], diagram_type: str) -> str:
        points = [
            self._safe_label(str(x))
            for x in (question_analysis.get("knowledge_points") or [])
            if str(x).strip()
        ][:4]
        core_concept = self._safe_label(str(question_analysis.get("core_concept") or "核心问题"), 20)

        if diagram_type == "mindmap":
            branches = "\n".join(f"    {point}" for point in (points or ["定义", "特点", "应用"]))
            return f"mindmap\n  root(({core_concept}))\n{branches}"

        if diagram_type == "graph":
            points = points or ["定义", "关键区别", "应用场景"]
            edges = "\n".join(
                f"    A[{core_concept}] --> N{idx}[{point}]"
                for idx, point in enumerate(points, start=1)
            )
            return f"graph LR\n{edges}"

        steps = points or ["理解问题", "抓住关键点", "形成答案"]
        flow_lines = ["flowchart TD", f"    A[{core_concept}] --> B[{steps[0]}]"]
        previous = "B"
        for idx, step in enumerate(steps[1:], start=1):
            node = f"N{idx}"
            flow_lines.append(f"    {previous} --> {node}[{step}]")
            previous = node
        flow_lines.append(f"    {previous} --> Z[完成理解]")
        return "\n".join(flow_lines)


async def diagram_generator_node(state: dict[str, Any]) -> dict[str, Any]:
    """LangGraph node wrapper for diagram generation."""

    agent = DiagramGeneratorAgent()

    question_text = state.get("question_text", "")
    question_analysis = state.get("question_analysis", {})
    answer_result = state.get("answer_result", {})
    answer_text = answer_result.get("answer_text", "")

    diagram_result = await agent.generate_diagram(
        question_text,
        question_analysis,
        answer_text,
    )

    state["diagram_result"] = diagram_result

    trace = state.get("execution_trace", [])
    trace.append(f"diagram_generator:count={len(diagram_result.get('diagrams', []))}")
    state["execution_trace"] = trace

    return state
