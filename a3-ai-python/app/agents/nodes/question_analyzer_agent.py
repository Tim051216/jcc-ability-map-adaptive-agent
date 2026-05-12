"""
问题分析智能体
负责理解、分类和扩展学生提出的问题
"""
import asyncio
import json
import re
from typing import Any

from app.core.logging import logger
from app.integrations.llm.client import get_llm_client
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService


class QuestionAnalyzerAgent:
    """问题分析智能体"""
    LLM_STEP_TIMEOUT_SECONDS = 8.0

    def __init__(self):
        self.llm_client = get_llm_client()
        self.rag_service = RagService()

    async def analyze_question(
        self,
        question_text: str,
        question_images: list[str] | None = None,
        course_id: int | None = None,
    ) -> dict[str, Any]:
        """
        分析问题
        
        Args:
            question_text: 问题文字内容
            question_images: 问题图片URL列表
            course_id: 关联课程ID
            
        Returns:
            分析结果字典，包含：
            - question_type: 问题类型
            - knowledge_points: 知识点列表
            - difficulty_level: 难度等级
            - intent: 问题意图
            - expanded_context: 扩展的背景信息
            - similar_questions: 相似问题列表
        """
        logger.info(f"开始分析问题，文字长度: {len(question_text)}, 图片数量: {len(question_images or [])}")

        # 1. 问题理解
        understanding = await self._understand_question(question_text, question_images)

        # 2. 问题分类
        classification = await self._classify_question(question_text, understanding)

        # 3. 问题扩展
        expansion = await self._expand_question(question_text, classification, course_id)

        # 合并结果
        result = {
            **understanding,
            **classification,
            **expansion,
        }

        logger.info(f"问题分析完成: 类型={result.get('question_type')}, 难度={result.get('difficulty_level')}")
        return result

    async def _understand_question(
        self, question_text: str, question_images: list[str] | None = None
    ) -> dict[str, Any]:
        """
        理解问题内容
        
        包括：
        - 文字问题解析
        - 图片问题识别（OCR + 多模态模型）
        - 问题意图识别
        """
        # 构建提示词
        prompt = f"""请分析以下学生提出的问题，理解其核心意图和需求。

问题内容：
{question_text}

请以JSON格式返回分析结果：
{{
    "intent": "问题意图（如：概念理解、解题方法、代码调试、知识应用等）",
    "core_concept": "核心概念或主题",
    "specific_confusion": "具体困惑点",
    "has_code": true/false,
    "has_formula": true/false,
    "language": "zh/en"
}}
"""

        # 如果有图片，添加图片分析提示
        if question_images:
            prompt += f"\n\n注意：问题包含 {len(question_images)} 张图片，可能包含公式、代码、图表等内容。"

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                ),
                timeout=self.LLM_STEP_TIMEOUT_SECONDS,
            )

            content = response.choices[0].message.content
            # 尝试解析JSON
            try:
                result = json.loads(content)
            except json.JSONDecodeError:
                # 如果不是纯JSON，尝试提取JSON部分
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = {
                        "intent": "未知",
                        "core_concept": question_text[:50],
                        "specific_confusion": "需要进一步分析",
                        "has_code": False,
                        "has_formula": False,
                        "language": "zh",
                    }

            return result

        except Exception as e:
            logger.error(f"问题理解失败: {e}")
            return self._heuristic_understanding(question_text, question_images)

    async def _classify_question(
        self, question_text: str, understanding: dict[str, Any]
    ) -> dict[str, Any]:
        """
        分类问题
        
        包括：
        - 知识点识别
        - 问题类型分类
        - 难度评估
        """
        prompt = f"""请对以下问题进行分类和难度评估。

问题内容：
{question_text}

问题意图：{understanding.get('intent')}
核心概念：{understanding.get('core_concept')}

请以JSON格式返回分类结果：
{{
    "question_type": "问题类型（概念理解/解题方法/代码调试/知识应用/综合分析）",
    "knowledge_points": ["知识点1", "知识点2", "知识点3"],
    "difficulty_level": 1-3（1=简单，2=中等，3=困难）,
    "subject_area": "学科领域（如：数学、编程、物理等）",
    "requires_calculation": true/false,
    "requires_reasoning": true/false
}}
"""

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                ),
                timeout=self.LLM_STEP_TIMEOUT_SECONDS,
            )

            content = response.choices[0].message.content
            try:
                result = json.loads(content)
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = {
                        "question_type": "概念理解",
                        "knowledge_points": [understanding.get('core_concept', '未知')],
                        "difficulty_level": 2,
                        "subject_area": "未知",
                        "requires_calculation": False,
                        "requires_reasoning": True,
                    }

            return result

        except Exception as e:
            logger.error(f"问题分类失败: {e}")
            return self._heuristic_classification(question_text, understanding)

    async def _expand_question(
        self, question_text: str, classification: dict[str, Any], course_id: int | None = None
    ) -> dict[str, Any]:
        """
        扩展问题
        
        包括：
        - 补充背景信息
        - 关联知识点
        - 相似问题检索
        """
        result = {
            "expanded_context": "",
            "related_concepts": [],
            "similar_questions": [],
        }

        # 1. 补充背景信息
        knowledge_points = classification.get("knowledge_points", [])
        if knowledge_points:
            context_prompt = f"""请为以下知识点提供简要的背景信息和关联概念：

知识点：{', '.join(knowledge_points)}

请以JSON格式返回：
{{
    "background": "背景信息（2-3句话）",
    "related_concepts": ["相关概念1", "相关概念2", "相关概念3"]
}}
"""

            try:
                response = await asyncio.wait_for(
                    self.llm_client.chat_completion(
                        messages=[{"role": "user", "content": context_prompt}],
                        temperature=0.5,
                    ),
                    timeout=self.LLM_STEP_TIMEOUT_SECONDS,
                )

                content = response.choices[0].message.content
                try:
                    context_data = json.loads(content)
                    result["expanded_context"] = context_data.get("background", "")
                    result["related_concepts"] = context_data.get("related_concepts", [])
                except json.JSONDecodeError:
                    pass

            except Exception as e:
                logger.error(f"背景信息扩展失败: {e}")
                result.update(self._heuristic_expansion(classification))

        # 2. 检索相似问题（如果有课程ID）
        if course_id:
            try:
                # 使用 RAG 检索相似问题
                search_result = await self.rag_service.search(
                    RagSearchRequest(
                        course_code=str(course_id),
                        query=question_text,
                        top_k=3,
                    )
                )

                result["similar_questions"] = [
                    {
                        "question": hit.content[:100],
                        "relevance": hit.score,
                        "source": hit.metadata.get("source", ""),
                    }
                    for hit in search_result.hits
                ]

            except Exception as e:
                logger.error(f"相似问题检索失败: {e}")

        return result

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        parts = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_-]{2,}", text or "")
        seen: set[str] = set()
        out: list[str] = []
        for part in parts:
            if part in seen:
                continue
            seen.add(part)
            out.append(part)
            if len(out) >= 5:
                break
        return out

    def _heuristic_understanding(
        self, question_text: str, question_images: list[str] | None = None
    ) -> dict[str, Any]:
        keywords = self._extract_keywords(question_text)
        has_code = any(token in question_text for token in ("def ", "class ", "public ", "Exception", "{", "}"))
        has_formula = any(token in question_text for token in ("=", "+", "-", "*", "/", "公式", "求", "证明"))
        intent = "代码调试" if has_code else "概念理解"
        if any(word in question_text for word in ("怎么", "如何", "步骤", "方法")):
            intent = "解题方法"
        return {
            "intent": intent,
            "core_concept": (keywords[0] if keywords else question_text[:30]) or "未知",
            "specific_confusion": "需要围绕题干中的核心概念和提问方式进一步说明",
            "has_code": has_code,
            "has_formula": has_formula,
            "language": "zh",
            "image_count": len(question_images or []),
        }

    def _heuristic_classification(
        self, question_text: str, understanding: dict[str, Any]
    ) -> dict[str, Any]:
        keywords = self._extract_keywords(question_text)
        question_type = "代码调试" if understanding.get("has_code") else "概念理解"
        if any(word in question_text for word in ("如何", "怎么", "步骤", "方法")):
            question_type = "解题方法"
        difficulty = 3 if len(question_text) > 80 else 2
        return {
            "question_type": question_type,
            "knowledge_points": keywords or [understanding.get("core_concept", "未知")],
            "difficulty_level": difficulty,
            "subject_area": "编程" if understanding.get("has_code") else "通用课程",
            "requires_calculation": bool(understanding.get("has_formula")),
            "requires_reasoning": True,
        }

    @staticmethod
    def _heuristic_expansion(classification: dict[str, Any]) -> dict[str, Any]:
        points = [str(x) for x in classification.get("knowledge_points", []) if x]
        return {
            "expanded_context": (
                f"当前问题可以先围绕 {'、'.join(points[:3])} 建立基础理解，再补充场景和易错点。"
                if points
                else "当前问题建议先从定义、特点和应用场景三个角度理解。"
            ),
            "related_concepts": points[1:4],
            "similar_questions": [],
        }


# 导出函数供 LangGraph 使用
async def question_analyzer_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    问题分析节点（LangGraph 节点函数）
    
    输入状态：
    - question_text: 问题文字
    - question_images: 问题图片列表
    - course_id: 课程ID
    
    输出状态：
    - question_analysis: 分析结果
    """
    agent = QuestionAnalyzerAgent()

    question_text = state.get("question_text", "")
    question_images = state.get("question_images")
    course_id = state.get("course_id")

    analysis = await agent.analyze_question(question_text, question_images, course_id)

    state["question_analysis"] = analysis

    # 记录执行轨迹
    trace = state.get("execution_trace", [])
    trace.append(f"question_analyzer:type={analysis.get('question_type')}")
    state["execution_trace"] = trace

    return state
