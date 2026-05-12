"""
解答生成智能体
负责生成文字解答，支持 RAG 检索、个性化调整和知识来源标注
"""
import asyncio
import json
from typing import Any

from app.core.logging import logger
from app.integrations.llm.client import get_llm_client
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService


class AnswerGeneratorAgent:
    """解答生成智能体"""
    LLM_STEP_TIMEOUT_SECONDS = 10.0

    def __init__(self):
        self.llm_client = get_llm_client()
        self.rag_service = RagService()

    async def generate_answer(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
        course_id: int | None = None,
    ) -> dict[str, Any]:
        """
        生成解答
        
        Args:
            question_text: 问题文字
            question_analysis: 问题分析结果
            user_profile: 学生画像
            course_id: 课程ID
            
        Returns:
            解答结果字典，包含：
            - answer_text: 解答文字（Markdown格式）
            - reference_sources: 参考资料来源
            - confidence_score: 置信度分数
        """
        logger.info(f"开始生成解答，问题类型: {question_analysis.get('question_type')}")

        # 1. RAG 检索相关知识
        retrieved_knowledge = await self._retrieve_knowledge(question_text, question_analysis, course_id)

        # 2. 生成解答
        answer_text = await self._generate_answer_text(
            question_text, question_analysis, retrieved_knowledge, user_profile
        )

        # 3. 标注知识来源
        reference_sources = self._extract_reference_sources(retrieved_knowledge)

        # 4. 评估置信度
        confidence_score = await self._evaluate_confidence(
            question_text, answer_text, retrieved_knowledge
        )

        result = {
            "answer_text": answer_text,
            "reference_sources": reference_sources,
            "confidence_score": confidence_score,
        }

        logger.info(f"解答生成完成，置信度: {confidence_score}")
        return result

    async def _retrieve_knowledge(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        course_id: int | None = None,
    ) -> dict[str, Any]:
        """
        RAG 检索相关知识
        
        包括：
        - 检索相关知识
        - 检索相似问题解答
        - 结果排序
        """
        retrieved_chunks = []
        similar_qa_pairs = []

        if course_id:
            try:
                # 检索课程相关知识
                knowledge_result = await self.rag_service.search(
                    RagSearchRequest(
                        course_code=str(course_id),
                        query=question_text,
                        top_k=5,
                    )
                )

                retrieved_chunks = [
                    {
                        "content": hit.content,
                        "score": hit.score,
                        "source": hit.metadata.get("source", ""),
                        "doc_id": hit.doc_id,
                    }
                    for hit in knowledge_result.hits
                ]

                logger.info(f"检索到 {len(retrieved_chunks)} 个相关知识块")

            except Exception as e:
                logger.error(f"知识检索失败: {e}")

        # TODO: 检索相似问题解答（从历史答疑记录中）
        # 这需要建立答疑历史的向量索引

        return {
            "retrieved_chunks": retrieved_chunks,
            "similar_qa_pairs": similar_qa_pairs,
        }

    async def _generate_answer_text(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        retrieved_knowledge: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
    ) -> str:
        """
        生成解答文字
        
        包括：
        - 基于检索结果生成解答
        - Markdown 格式输出
        - 支持 LaTeX 公式
        - 个性化调整
        """
        # 构建上下文
        context_parts = []

        # 添加检索到的知识
        retrieved_chunks = retrieved_knowledge.get("retrieved_chunks", [])
        if retrieved_chunks:
            context_parts.append("参考知识：")
            for i, chunk in enumerate(retrieved_chunks[:3], 1):
                context_parts.append(f"{i}. {chunk['content'][:300]}")

        context = "\n\n".join(context_parts) if context_parts else "无相关参考资料"

        # 构建个性化提示
        personalization = ""
        if user_profile:
            learning_level = user_profile.get("learning_level", "中等")
            learning_style = user_profile.get("learning_style", "平衡型")
            personalization = f"\n\n学生画像：学习水平={learning_level}，学习风格={learning_style}"
            personalization += "\n请根据学生的水平调整解答的详细程度和表达方式。"

        # 构建提示词
        prompt = f"""你是一位专业的学习辅导老师，请为学生解答以下问题。

问题：
{question_text}

问题分析：
- 类型：{question_analysis.get('question_type')}
- 知识点：{', '.join(question_analysis.get('knowledge_points', []))}
- 难度：{question_analysis.get('difficulty_level')}

{context}
{personalization}

请提供详细的解答，要求：
1. 使用 Markdown 格式
2. 如有数学公式，使用 LaTeX 语法（用 $ 或 $$ 包裹）
3. 结构清晰，分步骤说明
4. 语言通俗易懂
5. 如果有代码，使用代码块格式
6. 在解答末尾简要说明关键知识点

解答：
"""

        try:
            response = await asyncio.wait_for(
                self.llm_client.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000,
                ),
                timeout=self.LLM_STEP_TIMEOUT_SECONDS,
            )

            answer_text = response.choices[0].message.content

            # 确保格式正确
            if not answer_text.strip():
                answer_text = "抱歉，我暂时无法为您生成满意的解答。建议您提供更多背景信息或换个方式提问。"

            return answer_text

        except Exception as e:
            logger.error(f"解答生成失败: {e}")
            return self._build_fallback_answer(
                question_text,
                question_analysis,
                retrieved_knowledge,
                user_profile=user_profile,
            )

    def _build_fallback_answer(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        retrieved_knowledge: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
    ) -> str:
        """当 LLM 调用失败时，基于题目分析和检索结果生成一版稳定的兜底解答。"""
        knowledge_points = [str(x) for x in question_analysis.get("knowledge_points", []) if x]
        question_type = str(question_analysis.get("question_type") or "概念理解")
        difficulty = question_analysis.get("difficulty_level") or 2
        retrieved_chunks = retrieved_knowledge.get("retrieved_chunks", []) or []

        lines: list[str] = [
            "## 直接结论",
            f"当前问题更偏向**{question_type}**，难度大致为 **{difficulty} / 3**。",
        ]

        if knowledge_points:
            lines.append(f"它主要关联的知识点有：**{'、'.join(knowledge_points[:5])}**。")
        else:
            lines.append("它主要是在询问一个核心概念或方法的理解与应用。")

        lines.extend(
            [
                "",
                "## 解题思路",
                "1. 先确认题目在问“概念是什么、为什么会出现、应该怎么处理”。",
                "2. 再把题干和已有知识点对应起来，避免只记结论、不理解原因。",
                "3. 如果需要写答案或讲解，优先按“定义 -> 原因 -> 影响 -> 方法”组织。",
            ]
        )

        if retrieved_chunks:
            lines.extend(["", "## 可参考的课程知识"])
            for idx, chunk in enumerate(retrieved_chunks[:3], 1):
                source = chunk.get("source") or f"参考资料 {idx}"
                excerpt = str(chunk.get("content") or "").strip().replace("\r", " ").replace("\n", " ")
                if len(excerpt) > 180:
                    excerpt = excerpt[:180] + "..."
                lines.append(f"- **{source}**：{excerpt}")
        else:
            lines.extend(
                [
                    "",
                    "## 当前可给出的稳定建议",
                    "- 先用自己的话复述这个概念或方法在解决什么问题。",
                    "- 再列出 2 到 3 个典型特征、适用场景或常见误区。",
                    "- 如果题目和课程内容强相关，建议结合课堂讲义中的定义、示意图和例题一起回看。",
                ]
            )

        if user_profile:
            tags = user_profile.get("profile_tags") or []
            if tags:
                lines.extend(["", "## 个性化提醒", f"- 结合当前画像标签：{'、'.join(str(t) for t in tags[:4])}。建议先夯实基础，再做综合迁移。"])

        lines.extend(
            [
                "",
                "## 下一步建议",
                "- 如果你愿意，可以把题目背景、课程章节或你的已知思路补充出来，我可以继续按这个框架细化。",
                "- 当前结果是系统降级生成的稳定版本，建议结合人工升级或再次生成获取更完整答案。",
            ]
        )
        return "\n".join(lines)

    def _extract_reference_sources(self, retrieved_knowledge: dict[str, Any]) -> list[dict[str, Any]]:
        """
        提取并标注参考资料来源
        """
        sources = []

        retrieved_chunks = retrieved_knowledge.get("retrieved_chunks", [])
        for chunk in retrieved_chunks:
            source = {
                "source_type": "course",
                "title": chunk.get("source", "课程资料"),
                "url": None,
                "excerpt": chunk.get("content", "")[:200],
                "relevance_score": chunk.get("score", 0.0),
            }
            sources.append(source)

        return sources

    async def _evaluate_confidence(
        self,
        question_text: str,
        answer_text: str,
        retrieved_knowledge: dict[str, Any],
    ) -> float:
        """
        评估解答置信度
        
        考虑因素：
        - 检索结果的相关性
        - 解答的完整性
        - 知识覆盖度
        """
        # 基础置信度
        base_confidence = 50.0

        # 根据检索结果调整
        retrieved_chunks = retrieved_knowledge.get("retrieved_chunks", [])
        if retrieved_chunks:
            # 有检索结果，根据相关性分数调整
            avg_score = sum(chunk.get("score", 0) for chunk in retrieved_chunks) / len(retrieved_chunks)
            base_confidence += avg_score * 30  # 最多加30分
        else:
            # 没有检索结果，降低置信度
            base_confidence -= 20

        # 根据解答长度调整（太短可能不完整）
        answer_length = len(answer_text)
        if answer_length < 100:
            base_confidence -= 15
        elif answer_length > 500:
            base_confidence += 10

        # 限制在 0-100 范围内
        confidence = max(0.0, min(100.0, base_confidence))

        return round(confidence, 2)


# 导出函数供 LangGraph 使用
async def answer_generator_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    解答生成节点（LangGraph 节点函数）
    
    输入状态：
    - question_text: 问题文字
    - question_analysis: 问题分析结果
    - user_profile: 学生画像
    - course_id: 课程ID
    
    输出状态：
    - answer_result: 解答结果
    """
    agent = AnswerGeneratorAgent()

    question_text = state.get("question_text", "")
    question_analysis = state.get("question_analysis", {})
    user_profile = state.get("user_profile")
    course_id = state.get("course_id")

    answer_result = await agent.generate_answer(
        question_text, question_analysis, user_profile, course_id
    )

    state["answer_result"] = answer_result

    # 记录执行轨迹
    trace = state.get("execution_trace", [])
    trace.append(f"answer_generator:confidence={answer_result.get('confidence_score')}")
    state["execution_trace"] = trace

    return state
