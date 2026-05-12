"""
题库生成智能体

功能:
1. 生成分层练习题(基础、进阶、拔高)
2. 支持多种题型(单选、多选、判断、填空、简答、编程)
3. 质量控制和难度评估
4. 知识点覆盖检查
"""

from typing import Dict, Any, Optional, List
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
import json

from app.core.config import settings
from app.agents.state import LearningAgentState


class QuestionBankGenerationAgent:
    """题库生成智能体"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0.8,  # 提高温度以增加题目多样性
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
    
    def _build_system_prompt(self, difficulty_level: int, question_type: str) -> str:
        """构建系统提示词"""
        difficulty_desc = {
            1: "基础层 - 考查基本概念理解和简单应用",
            2: "进阶层 - 考查综合运用和问题分析能力",
            3: "拔高层 - 考查深度思考和创新应用能力"
        }
        
        type_desc = {
            "single_choice": "单项选择题 - 4个选项,只有1个正确答案",
            "multiple_choice": "多项选择题 - 4-5个选项,有2个或以上正确答案",
            "true_false": "判断题 - 判断陈述是否正确",
            "fill_blank": "填空题 - 在句子中填入关键词或短语",
            "short_answer": "简答题 - 用简短文字回答问题",
            "programming": "编程题 - 编写代码解决问题"
        }
        
        base_prompt = f"""你是一位专业的教育测评专家,擅长设计高质量的练习题目。

**当前任务**: 生成 {difficulty_desc.get(difficulty_level, '')} 的 {type_desc.get(question_type, '')}

**题目质量标准**:
1. **准确性**: 题目表述准确,答案正确无误
2. **针对性**: 紧扣知识点,考查核心概念
3. **区分度**: 能够区分不同水平的学生
4. **无歧义**: 题目表述清晰,不产生歧义
5. **实用性**: 贴近实际应用场景

**输出格式** (JSON):
```json
{{
  "question_content": "题目内容",
  "options": {{"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"}},  // 仅选择题需要
  "correct_answer": "正确答案",
  "answer_analysis": "答案解析,说明为什么这是正确答案",
  "knowledge_points": ["知识点1", "知识点2"],
  "difficulty_score": 0.6  // 0-1之间,表示难度系数
}}
```
"""
        
        # 根据题型添加特定要求
        if question_type == "single_choice":
            base_prompt += "\n\n**选择题要求**: 选项设计要有迷惑性,错误选项应该是常见错误或易混淆概念。"
        elif question_type == "multiple_choice":
            base_prompt += "\n\n**多选题要求**: 正确答案2-3个,错误选项要有一定迷惑性,避免明显错误。"
        elif question_type == "programming":
            base_prompt += "\n\n**编程题要求**: 提供清晰的问题描述、输入输出示例、测试用例,答案包含完整可运行代码。"
        
        return base_prompt
    
    def _build_user_prompt(
        self,
        knowledge_point: str,
        difficulty_level: int,
        question_type: str,
        existing_questions: Optional[List[str]] = None
    ) -> str:
        """构建用户提示词"""
        prompt = f"请为以下知识点生成题目:\n\n**知识点**: {knowledge_point}\n"
        prompt += f"**难度层级**: {difficulty_level} (1-基础, 2-进阶, 3-拔高)\n"
        prompt += f"**题型**: {question_type}\n"
        
        if existing_questions:
            prompt += f"\n**已有题目** (请避免重复):\n"
            for i, q in enumerate(existing_questions[:3], 1):  # 只显示前3个
                prompt += f"{i}. {q}\n"
        
        prompt += "\n请生成1道符合要求的题目,以 JSON 格式输出。"
        
        return prompt
    
    async def generate_question(
        self,
        knowledge_point: str,
        difficulty_level: int,
        question_type: str,
        existing_questions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        生成单个题目
        
        Args:
            knowledge_point: 知识点名称
            difficulty_level: 难度层级 (1-基础, 2-进阶, 3-拔高)
            question_type: 题型
            existing_questions: 已有题目列表(用于避免重复)
            
        Returns:
            题目数据字典
        """
        system_prompt = self._build_system_prompt(difficulty_level, question_type)
        user_prompt = self._build_user_prompt(knowledge_point, difficulty_level, question_type, existing_questions)
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        # 调用 LLM 生成题目
        response = await self.llm.ainvoke(messages)
        
        # 解析 JSON 响应
        question_data = self._parse_question_response(response.content)
        
        # 添加元数据
        question_data["question_type"] = question_type
        question_data["difficulty_level"] = difficulty_level
        
        return question_data
    
    def _parse_question_response(self, content: str) -> Dict[str, Any]:
        """解析 LLM 响应中的 JSON 数据"""
        try:
            # 尝试直接解析 JSON
            if content.strip().startswith("{"):
                return json.loads(content)
            
            # 查找 JSON 代码块
            if "```json" in content:
                start = content.find("```json") + len("```json")
                end = content.find("```", start)
                if end != -1:
                    json_str = content[start:end].strip()
                    return json.loads(json_str)
            
            # 查找 { ... } 结构
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1:
                json_str = content[start:end+1]
                return json.loads(json_str)
            
            # 如果都失败,返回默认结构
            return {
                "question_content": content,
                "correct_answer": "",
                "answer_analysis": "",
                "knowledge_points": [],
                "difficulty_score": 0.5
            }
        except json.JSONDecodeError:
            # JSON 解析失败,返回默认结构
            return {
                "question_content": content,
                "correct_answer": "",
                "answer_analysis": "",
                "knowledge_points": [],
                "difficulty_score": 0.5
            }
    
    async def generate_question_bank(
        self,
        knowledge_point: str,
        basic_count: int = 5,
        advanced_count: int = 3,
        expert_count: int = 2
    ) -> Dict[str, Any]:
        """
        生成完整题库
        
        Args:
            knowledge_point: 知识点名称
            basic_count: 基础层题目数量
            advanced_count: 进阶层题目数量
            expert_count: 拔高层题目数量
            
        Returns:
            包含所有题目的题库数据
        """
        all_questions = []
        existing_questions = []
        
        # 题型分布
        question_types = ["single_choice", "multiple_choice", "true_false", "fill_blank", "short_answer"]
        
        # 生成基础层题目
        for i in range(basic_count):
            q_type = question_types[i % len(question_types)]
            question = await self.generate_question(
                knowledge_point=knowledge_point,
                difficulty_level=1,
                question_type=q_type,
                existing_questions=existing_questions
            )
            all_questions.append(question)
            existing_questions.append(question["question_content"])
        
        # 生成进阶层题目
        for i in range(advanced_count):
            q_type = question_types[i % len(question_types)]
            question = await self.generate_question(
                knowledge_point=knowledge_point,
                difficulty_level=2,
                question_type=q_type,
                existing_questions=existing_questions
            )
            all_questions.append(question)
            existing_questions.append(question["question_content"])
        
        # 生成拔高层题目
        for i in range(expert_count):
            # 拔高层更多使用简答题和编程题
            q_type = ["short_answer", "programming"][i % 2]
            question = await self.generate_question(
                knowledge_point=knowledge_point,
                difficulty_level=3,
                question_type=q_type,
                existing_questions=existing_questions
            )
            all_questions.append(question)
            existing_questions.append(question["question_content"])
        
        # 统计题型分布
        question_type_stats = {}
        for q in all_questions:
            q_type = q["question_type"]
            question_type_stats[q_type] = question_type_stats.get(q_type, 0) + 1
        
        # 统计知识点覆盖
        knowledge_coverage = {}
        for q in all_questions:
            for kp in q.get("knowledge_points", []):
                knowledge_coverage[kp] = knowledge_coverage.get(kp, 0) + 1
        
        return {
            "questions": all_questions,
            "total_questions": len(all_questions),
            "basic_questions": basic_count,
            "advanced_questions": advanced_count,
            "expert_questions": expert_count,
            "question_types": question_type_stats,
            "knowledge_coverage": knowledge_coverage
        }


async def question_bank_generation_node(state: LearningAgentState) -> LearningAgentState:
    """
    题库生成节点
    
    从状态中获取知识点信息,生成分层练习题库
    """
    # 获取必要参数
    knowledge_point = state.get("knowledge_point", "")
    basic_count = state.get("basic_question_count", 5)
    advanced_count = state.get("advanced_question_count", 3)
    expert_count = state.get("expert_question_count", 2)
    
    if not knowledge_point:
        state["question_bank_result"] = {
            "success": False,
            "error": "缺少知识点信息"
        }
        return state
    
    # 创建智能体并生成题库
    agent = QuestionBankGenerationAgent()
    
    try:
        result = await agent.generate_question_bank(
            knowledge_point=knowledge_point,
            basic_count=basic_count,
            advanced_count=advanced_count,
            expert_count=expert_count
        )
        
        state["question_bank_result"] = {
            "success": True,
            "data": result
        }
        
        # 记录执行轨迹
        trace = state.get("execution_trace", [])
        trace.append(f"question_bank_generation:success:total={result['total_questions']}")
        state["execution_trace"] = trace
        
    except Exception as e:
        state["question_bank_result"] = {
            "success": False,
            "error": str(e)
        }
        
        # 记录错误
        trace = state.get("execution_trace", [])
        trace.append(f"question_bank_generation:failed:{str(e)}")
        state["execution_trace"] = trace
    
    return state
