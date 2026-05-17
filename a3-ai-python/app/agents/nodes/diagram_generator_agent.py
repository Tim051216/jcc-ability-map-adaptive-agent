"""
图解生成智能体
负责生成逻辑图解（Mermaid 格式）
"""
import asyncio
import json
from typing import Any

from app.core.logging import logger
from app.integrations.llm.client import get_llm_client


class DiagramGeneratorAgent:
    """图解生成智能体"""
    LLM_STEP_TIMEOUT_SECONDS = 6.0

    def __init__(self):
        self.llm_client = get_llm_client()

    async def generate_diagram(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        answer_text: str,
    ) -> dict[str, Any]:
        """
        生成图解
        
        Args:
            question_text: 问题文字
            question_analysis: 问题分析结果
            answer_text: 解答文字
            
        Returns:
            图解结果字典，包含：
            - diagrams: Mermaid 代码列表
            - diagram_types: 图解类型列表
        """
        logger.info("开始生成图解")

        # 1. 判断是否需要图解
        need_diagram = await self._should_generate_diagram(question_text, question_analysis, answer_text)

        if not need_diagram:
            logger.info("问题不需要图解")
            return {"diagrams": [], "diagram_types": []}

        # 2. 确定图解类型
        diagram_type = await self._determine_diagram_type(question_text, question_analysis, answer_text)

        # 3. 生成 Mermaid 代码
        mermaid_code = await self._generate_mermaid_code(
            question_text, answer_text, diagram_type
        )

        # 4. 优化图解
        optimized_code = await self._optimize_diagram(mermaid_code, diagram_type)
        if not optimized_code:
            optimized_code = self._build_fallback_diagram(question_analysis, diagram_type)

        result = {
            "diagrams": [
                {
                    "diagram_type": diagram_type,
                    "title": self._build_diagram_title(question_analysis, diagram_type),
                    "render_engine": "mermaid",
                    "mermaid_code": optimized_code,
                }
            ]
            if optimized_code
            else [],
            "diagram_types": [diagram_type] if optimized_code else [],
        }

        logger.info(f"图解生成完成，类型: {diagram_type}")
        return result

    async def _should_generate_diagram(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        answer_text: str,
    ) -> bool:
        """
        判断是否需要图解
        
        考虑因素：
        - 问题类型（流程、关系、结构等更适合图解）
        - 解答复杂度
        - 是否涉及多个步骤或概念关系
        """
        # 某些问题类型更适合图解
        question_type = question_analysis.get("question_type", "")
        if question_type in ["解题方法", "综合分析", "知识应用"]:
            return True

        # 如果需要推理或计算，可能需要流程图
        if question_analysis.get("requires_reasoning") or question_analysis.get("requires_calculation"):
            return True

        # 如果解答较长且包含多个步骤，可能需要图解
        if len(answer_text) > 500 and ("步骤" in answer_text or "流程" in answer_text):
            return True

        return False

    async def _determine_diagram_type(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        answer_text: str,
    ) -> str:
        """
        确定图解类型
        
        支持的类型：
        - flowchart: 流程图
        - mindmap: 思维导图
        - sequenceDiagram: 时序图
        - classDiagram: 类图
        - graph: 关系图
        """
        prompt = f"""请为以下问题和解答选择最合适的图解类型。

问题：{question_text[:200]}
解答摘要：{answer_text[:300]}

可选图解类型：
1. flowchart - 流程图（适合步骤、算法、决策流程）
2. mindmap - 思维导图（适合概念关系、知识结构）
3. graph - 关系图（适合实体关系、依赖关系）

请只回答类型名称（flowchart/mindmap/graph）："""

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=20,
                ),
                timeout=self.LLM_STEP_TIMEOUT_SECONDS,
            )

            result = response.choices[0].message.content.strip().lower()

            # 提取类型
            if "flowchart" in result:
                return "flowchart"
            elif "mindmap" in result:
                return "mindmap"
            elif "graph" in result:
                return "graph"
            else:
                return "flowchart"  # 默认流程图

        except Exception as e:
            logger.error(f"图解类型确定失败: {e}")
            return "flowchart"

    async def _generate_mermaid_code(
        self,
        question_text: str,
        answer_text: str,
        diagram_type: str,
    ) -> str:
        """
        生成 Mermaid 代码
        """
        # 根据类型构建不同的提示词
        if diagram_type == "flowchart":
            example = """flowchart TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作1]
    B -->|否| D[执行操作2]
    C --> E[结束]
    D --> E"""
            instruction = "生成流程图，展示解题步骤或处理流程"

        elif diagram_type == "mindmap":
            example = """mindmap
  root((核心概念))
    分支1
      子概念1.1
      子概念1.2
    分支2
      子概念2.1
      子概念2.2"""
            instruction = "生成思维导图，展示知识点之间的关系"

        else:  # graph
            example = """graph LR
    A[概念A] --> B[概念B]
    A --> C[概念C]
    B --> D[概念D]
    C --> D"""
            instruction = "生成关系图，展示概念之间的关联"

        prompt = f"""请根据以下问题和解答，生成 Mermaid 图解代码。

问题：{question_text}
解答：{answer_text[:500]}

要求：
1. {instruction}
2. 使用 Mermaid 语法
3. 节点标签简洁明了（中文）
4. 结构清晰，层次分明
5. 不要超过15个节点

示例格式：
{example}

请直接输出 Mermaid 代码（不要包含 ```mermaid 标记）：
"""

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=800,
                ),
                timeout=self.LLM_STEP_TIMEOUT_SECONDS,
            )

            mermaid_code = response.choices[0].message.content.strip()

            # 清理代码（移除可能的 markdown 标记）
            mermaid_code = mermaid_code.replace("```mermaid", "").replace("```", "").strip()

            return mermaid_code

        except Exception as e:
            logger.error(f"Mermaid 代码生成失败: {e}")
            return ""

    async def _optimize_diagram(self, mermaid_code: str, diagram_type: str) -> str:
        """
        优化图解
        
        包括：
        - 布局优化
        - 可读性提升
        - 样式美化
        """
        if not mermaid_code:
            return ""

        # 基本验证：确保代码以正确的类型开头
        valid_starts = ["flowchart", "mindmap", "graph", "sequenceDiagram", "classDiagram"]
        if not any(mermaid_code.startswith(start) for start in valid_starts):
            logger.warning("Mermaid 代码格式可能不正确")
            # 尝试添加类型前缀
            if diagram_type == "flowchart":
                mermaid_code = f"flowchart TD\n{mermaid_code}"
            elif diagram_type == "mindmap":
                mermaid_code = f"mindmap\n{mermaid_code}"
            elif diagram_type == "graph":
                mermaid_code = f"graph LR\n{mermaid_code}"

        # TODO: 可以添加更多优化逻辑
        # - 检查语法错误
        # - 优化节点布局
        # - 添加样式定义

        lines = [line.rstrip() for line in mermaid_code.splitlines() if line.strip()]
        if not lines:
            return ""

        sanitized_lines = [self._sanitize_mermaid_line(line) for line in lines[:24]]
        optimized = "\n".join(sanitized_lines)
        if diagram_type == "flowchart" and "classDef" not in optimized:
            optimized += (
                "\nclassDef key fill:#e0f2fe,stroke:#0284c7,color:#0f172a;"
                "\nclassDef focus fill:#fef3c7,stroke:#d97706,color:#7c2d12;"
            )
        return optimized

    @staticmethod
    def _sanitize_mermaid_line(line: str) -> str:
        sanitized = line.replace("（", "(").replace("）", ")").replace("：", ":").strip()
        sanitized = sanitized.replace("“", '"').replace("”", '"').replace("`", "")
        if "[" in sanitized and "]" in sanitized:
            head, tail = sanitized.split("[", 1)
            label, rest = tail.split("]", 1)
            label = label[:28].replace('"', "").strip()
            sanitized = f"{head}[{label}]{rest}"
        return sanitized

    @staticmethod
    def _build_diagram_title(question_analysis: dict[str, Any], diagram_type: str) -> str:
        concept = str(question_analysis.get("core_concept") or "").strip() or "知识图解"
        suffix = {
            "flowchart": "流程图",
            "mindmap": "思维导图",
            "graph": "关系图",
        }.get(diagram_type, "图解")
        return f"{concept} {suffix}"

    @staticmethod
    def _build_fallback_diagram(question_analysis: dict[str, Any], diagram_type: str) -> str:
        points = [str(x).strip() for x in question_analysis.get("knowledge_points", []) if str(x).strip()][:4]
        core_concept = str(question_analysis.get("core_concept") or "核心问题").strip()
        if diagram_type == "mindmap":
            branches = "\n".join(f"    {point}" for point in points) or "    关键步骤"
            return f"mindmap\n  root(({core_concept[:20]}))\n{branches}"
        if diagram_type == "graph":
            if not points:
                points = ["问题识别", "关键概念", "解题方法"]
            edges = "\n".join(
                f"    A[{core_concept[:20]}] --> N{idx}[{point[:18]}]" for idx, point in enumerate(points, start=1)
            )
            return f"graph LR\n{edges}"
        steps = points or ["理解题意", "定位知识点", "分步作答"]
        flow_lines = ["flowchart TD", "    A[开始] --> B[理解题意]"]
        previous = "B"
        for idx, step in enumerate(steps, start=1):
            node = f"N{idx}"
            flow_lines.append(f"    {previous} --> {node}[{step[:18]}]")
            previous = node
        flow_lines.append(f"    {previous} --> Z[完成总结]")
        return "\n".join(flow_lines)


# 导出函数供 LangGraph 使用
async def diagram_generator_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    图解生成节点（LangGraph 节点函数）
    
    输入状态：
    - question_text: 问题文字
    - question_analysis: 问题分析结果
    - answer_result: 解答结果
    
    输出状态：
    - diagram_result: 图解结果
    """
    agent = DiagramGeneratorAgent()

    question_text = state.get("question_text", "")
    question_analysis = state.get("question_analysis", {})
    answer_result = state.get("answer_result", {})
    answer_text = answer_result.get("answer_text", "")

    diagram_result = await agent.generate_diagram(question_text, question_analysis, answer_text)

    state["diagram_result"] = diagram_result

    # 记录执行轨迹
    trace = state.get("execution_trace", [])
    diagram_count = len(diagram_result.get("diagrams", []))
    trace.append(f"diagram_generator:count={diagram_count}")
    state["execution_trace"] = trace

    return state
