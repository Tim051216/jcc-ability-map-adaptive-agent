"""
题目生成智能体
负责根据知识点和难度层级生成高质量的测评题目
支持基础/进阶/拔高三层题目生成,并进行质量控制和难度评估
"""
import json
from typing import Any

from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client


class QuestionGeneratorAgent:
    """题目生成智能体"""

    def __init__(self):
        self.llm_client = get_llm_client()

    async def generate_questions(
        self,
        knowledge_point: str,
        difficulty_level: int,
        question_type: int,
        count: int = 1,
        course_context: str = "",
    ) -> list[dict[str, Any]]:
        """
        生成题目
        
        Args:
            knowledge_point: 知识点
            difficulty_level: 难度层级 (1-基础, 2-进阶, 3-拔高)
            question_type: 题目类型 (1-单选, 2-多选, 3-判断, 4-填空, 5-简答, 6-编程)
            count: 生成题目数量
            course_context: 课程上下文信息
            
        Returns:
            生成的题目列表
        """
        difficulty_map = {1: "基础", 2: "进阶", 3: "拔高"}
        type_map = {
            1: "单选题",
            2: "多选题",
            3: "判断题",
            4: "填空题",
            5: "简答题",
            6: "编程题",
        }

        difficulty_desc = difficulty_map.get(difficulty_level, "基础")
        type_desc = type_map.get(question_type, "单选题")

        prompt = self._build_generation_prompt(
            knowledge_point=knowledge_point,
            difficulty_desc=difficulty_desc,
            type_desc=type_desc,
            count=count,
            course_context=course_context,
        )

        try:
            response = await self.llm_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2000,
            )

            content = response.get("content", "")
            questions = self._parse_questions(content, question_type, difficulty_level)

            # 质量评估
            for question in questions:
                question["quality_score"] = await self._assess_quality(question)

            logger.info(
                f"生成 {len(questions)} 道题目: 知识点={knowledge_point}, 难度={difficulty_desc}, 类型={type_desc}"
            )

            return questions

        except Exception as e:
            logger.error(f"题目生成失败: {e}")
            return []

    def _build_generation_prompt(
        self,
        knowledge_point: str,
        difficulty_desc: str,
        type_desc: str,
        count: int,
        course_context: str,
    ) -> str:
        """构建题目生成提示词"""

        difficulty_guidelines = {
            "基础": """
- 考查基本概念和定义
- 题目直接明确,无需复杂推理
- 答案在教材中可以直接找到
- 适合初学者理解和掌握
            """,
            "进阶": """
- 考查知识点的应用和理解
- 需要一定的分析和推理能力
- 可能涉及多个知识点的综合
- 适合有一定基础的学习者
            """,
            "拔高": """
- 考查深层次理解和创新应用
- 需要较强的综合分析能力
- 可能涉及实际问题的解决
- 适合进阶学习者挑战
            """,
        }

        type_guidelines = {
            "单选题": "提供4个选项(A/B/C/D),只有一个正确答案",
            "多选题": "提供4-5个选项,有2个或以上正确答案",
            "判断题": "提供一个陈述,判断正确或错误",
            "填空题": "在题目中留出空白,要求填入正确答案",
            "简答题": "要求用简短文字回答问题,考查理解和表达能力",
            "编程题": "要求编写代码解决问题,考查编程能力",
        }

        context_section = f"\n\n课程背景:\n{course_context}" if course_context else ""

        prompt = f"""你是一位专业的教育测评专家,请根据以下要求生成高质量的测评题目。

知识点: {knowledge_point}
难度层级: {difficulty_desc}
题目类型: {type_desc}
生成数量: {count} 道{context_section}

难度要求:
{difficulty_guidelines.get(difficulty_desc, "")}

题型要求:
{type_guidelines.get(type_desc, "")}

请生成 {count} 道符合要求的题目,并以 JSON 格式返回,格式如下:

```json
[
  {{
    "question_content": "题目内容",
    "question_options": [{{"key": "A", "value": "选项A"}}, {{"key": "B", "value": "选项B"}}, ...],  // 仅选择题和判断题需要
    "correct_answer": "正确答案",
    "answer_analysis": "答案解析,说明为什么这是正确答案",
    "knowledge_point": "{knowledge_point}",
    "difficulty_reasoning": "难度设计说明"
  }}
]
```

要求:
1. 题目内容清晰准确,无歧义
2. 选项设计合理,干扰项有一定迷惑性
3. 答案解析详细,帮助学习者理解
4. 严格符合指定的难度层级
5. 题目具有教育价值和实用性
"""

        return prompt

    def _parse_questions(
        self, content: str, question_type: int, difficulty_level: int
    ) -> list[dict[str, Any]]:
        """解析 LLM 返回的题目内容"""
        try:
            # 尝试提取 JSON 内容
            start_idx = content.find("[")
            end_idx = content.rfind("]") + 1

            if start_idx == -1 or end_idx == 0:
                logger.warning("未找到 JSON 格式的题目数据")
                return []

            json_str = content[start_idx:end_idx]
            questions = json.loads(json_str)

            # 补充字段
            for question in questions:
                question["question_type"] = question_type
                question["difficulty_level"] = difficulty_level

            return questions

        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}")
            return []
        except Exception as e:
            logger.error(f"题目解析失败: {e}")
            return []

    async def _assess_quality(self, question: dict[str, Any]) -> float:
        """
        评估题目质量
        
        评估维度:
        1. 题目清晰度 (0-0.3)
        2. 选项合理性 (0-0.3)
        3. 答案准确性 (0-0.2)
        4. 解析完整性 (0-0.2)
        
        Returns:
            质量分数 (0-1)
        """
        score = 0.0

        # 1. 题目清晰度
        content = question.get("question_content", "")
        if len(content) >= 10 and len(content) <= 500:
            score += 0.3
        elif len(content) > 0:
            score += 0.15

        # 2. 选项合理性 (仅适用于选择题)
        options = question.get("question_options", [])
        if question.get("question_type") in [1, 2, 3]:  # 选择题和判断题
            if len(options) >= 2:
                score += 0.3
            elif len(options) > 0:
                score += 0.15
        else:
            score += 0.3  # 非选择题不考核此项

        # 3. 答案准确性
        answer = question.get("correct_answer", "")
        if len(answer) > 0:
            score += 0.2

        # 4. 解析完整性
        analysis = question.get("answer_analysis", "")
        if len(analysis) >= 20:
            score += 0.2
        elif len(analysis) > 0:
            score += 0.1

        return round(score, 2)

    async def generate_layered_questions(
        self,
        knowledge_points: list[str],
        course_context: str = "",
    ) -> dict[str, list[dict[str, Any]]]:
        """
        生成分层题目 (基础/进阶/拔高)
        
        Args:
            knowledge_points: 知识点列表
            course_context: 课程上下文
            
        Returns:
            分层题目字典 {difficulty_level: [questions]}
        """
        layered_questions = {"basic": [], "intermediate": [], "advanced": []}

        for kp in knowledge_points:
            # 基础层 - 单选题
            basic_questions = await self.generate_questions(
                knowledge_point=kp,
                difficulty_level=1,
                question_type=1,
                count=2,
                course_context=course_context,
            )
            layered_questions["basic"].extend(basic_questions)

            # 进阶层 - 多选题或填空题
            intermediate_questions = await self.generate_questions(
                knowledge_point=kp,
                difficulty_level=2,
                question_type=2,
                count=1,
                course_context=course_context,
            )
            layered_questions["intermediate"].extend(intermediate_questions)

            # 拔高层 - 简答题
            advanced_questions = await self.generate_questions(
                knowledge_point=kp,
                difficulty_level=3,
                question_type=5,
                count=1,
                course_context=course_context,
            )
            layered_questions["advanced"].extend(advanced_questions)

        logger.info(
            f"生成分层题目: 基础 {len(layered_questions['basic'])} 道, "
            f"进阶 {len(layered_questions['intermediate'])} 道, "
            f"拔高 {len(layered_questions['advanced'])} 道"
        )

        return layered_questions


async def question_generator_node(state: LearningAgentState) -> LearningAgentState:
    """
    题目生成节点
    从状态中读取题目生成需求,调用智能体生成题目
    """
    agent = QuestionGeneratorAgent()

    # 从状态中获取参数
    knowledge_points = state.get("knowledge_points", [])
    difficulty_level = state.get("difficulty_level", 1)
    question_type = state.get("question_type", 1)
    question_count = state.get("question_count", 5)
    course_context = state.get("course_context", "")
    generate_layered = state.get("generate_layered", False)

    try:
        if generate_layered:
            # 生成分层题目
            layered_questions = await agent.generate_layered_questions(
                knowledge_points=knowledge_points,
                course_context=course_context,
            )
            state["layered_questions"] = layered_questions
            state["generated_questions"] = (
                layered_questions["basic"]
                + layered_questions["intermediate"]
                + layered_questions["advanced"]
            )
        else:
            # 生成指定难度的题目
            questions = []
            for kp in knowledge_points:
                kp_questions = await agent.generate_questions(
                    knowledge_point=kp,
                    difficulty_level=difficulty_level,
                    question_type=question_type,
                    count=question_count // len(knowledge_points) or 1,
                    course_context=course_context,
                )
                questions.extend(kp_questions)

            state["generated_questions"] = questions

        # 更新执行轨迹
        trace = state.get("execution_trace", [])
        trace.append("question_generator")
        state["execution_trace"] = trace

    except Exception as e:
        logger.error(f"题目生成节点执行失败: {e}")
        state["error"] = str(e)

    return state
