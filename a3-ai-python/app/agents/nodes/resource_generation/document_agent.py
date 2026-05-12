"""
文档生成智能体

功能:
1. 基于知识点生成课程讲解文档
2. 支持 Markdown 格式和 LaTeX 公式
3. 根据学生画像调整难度和风格
4. 质量控制和内容验证
"""

from typing import Dict, Any, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.agents.state import LearningAgentState


class DocumentGenerationAgent:
    """文档生成智能体"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0.7,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
    
    def _build_system_prompt(self, student_profile: Optional[Dict[str, Any]] = None) -> str:
        """构建系统提示词"""
        base_prompt = """你是一位专业的教学内容生成专家,擅长创建清晰、结构化的课程讲解文档。

你的任务是根据给定的知识点生成高质量的课程讲解文档,要求:

1. **内容结构**:
   - 使用 Markdown 格式
   - 包含标题、子标题、正文、示例
   - 逻辑清晰,层次分明

2. **内容要求**:
   - 准确性: 确保知识点准确无误
   - 完整性: 覆盖知识点的核心概念、原理、应用
   - 可读性: 语言通俗易懂,避免过于晦涩

3. **格式支持**:
   - 支持 LaTeX 数学公式 (使用 $...$ 或 $$...$$)
   - 支持代码块 (使用 ```语言名```)
   - 支持图表说明 (使用 Markdown 图片语法)

4. **文档结构模板**:
```markdown
# [知识点名称]

## 概述
[简要介绍该知识点的定义和重要性]

## 核心概念
[详细解释核心概念]

## 原理说明
[阐述基本原理和机制]

## 示例演示
[提供具体示例帮助理解]

## 实际应用
[说明在实际场景中的应用]

## 常见误区
[指出学习中容易出现的错误]

## 总结
[总结要点]

## 扩展阅读
[推荐相关资源]
```
"""
        
        # 根据学生画像调整
        if student_profile:
            difficulty_level = student_profile.get("difficulty_level", 1)
            learning_style = student_profile.get("cognitive_style", "")
            
            if difficulty_level == 1:  # 基础
                base_prompt += "\n\n**难度调整**: 当前学生处于基础阶段,请使用简单易懂的语言,多举例子,避免复杂术语。"
            elif difficulty_level == 2:  # 进阶
                base_prompt += "\n\n**难度调整**: 当前学生处于进阶阶段,可以使用专业术语,深入讲解原理,提供进阶示例。"
            elif difficulty_level == 3:  # 拔高
                base_prompt += "\n\n**难度调整**: 当前学生处于拔高阶段,请深入探讨高级概念,提供复杂案例,引导深度思考。"
            
            if "视觉" in learning_style or "图形" in learning_style:
                base_prompt += "\n\n**风格调整**: 学生偏好视觉学习,请多使用图表、流程图说明,使用 Mermaid 图表语法。"
            elif "逻辑" in learning_style or "推理" in learning_style:
                base_prompt += "\n\n**风格调整**: 学生偏好逻辑推理,请注重因果关系,使用演绎推理方式讲解。"
        
        return base_prompt
    
    def _build_user_prompt(
        self,
        knowledge_point: str,
        course_context: Optional[str] = None,
        related_knowledge: Optional[list] = None
    ) -> str:
        """构建用户提示词"""
        prompt = f"请为以下知识点生成课程讲解文档:\n\n**知识点**: {knowledge_point}\n"
        
        if course_context:
            prompt += f"\n**课程背景**: {course_context}\n"
        
        if related_knowledge:
            prompt += f"\n**相关知识点**: {', '.join(related_knowledge)}\n"
        
        prompt += "\n请按照上述要求生成完整的 Markdown 格式文档。"
        
        return prompt
    
    async def generate_document(
        self,
        knowledge_point: str,
        student_profile: Optional[Dict[str, Any]] = None,
        course_context: Optional[str] = None,
        related_knowledge: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        生成文档
        
        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像
            course_context: 课程上下文
            related_knowledge: 相关知识点列表
            
        Returns:
            包含文档内容和元数据的字典
        """
        system_prompt = self._build_system_prompt(student_profile)
        user_prompt = self._build_user_prompt(knowledge_point, course_context, related_knowledge)
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        # 调用 LLM 生成文档
        response = await self.llm.ainvoke(messages)
        content_markdown = response.content
        
        # 分析文档特征
        has_formula = "$" in content_markdown or "$$" in content_markdown
        has_code = "```" in content_markdown
        has_image = "![" in content_markdown
        word_count = len(content_markdown)
        
        # 提取大纲
        outline = self._extract_outline(content_markdown)
        
        # 质量评分
        quality_score = self._calculate_quality_score(content_markdown, outline)
        
        return {
            "content_markdown": content_markdown,
            "word_count": word_count,
            "has_formula": has_formula,
            "has_code": has_code,
            "has_image": has_image,
            "outline": outline,
            "quality_score": quality_score,
        }
    
    def _extract_outline(self, markdown_content: str) -> list:
        """提取文档大纲"""
        outline = []
        lines = markdown_content.split("\n")
        
        for line in lines:
            line = line.strip()
            if line.startswith("#"):
                # 提取标题级别和内容
                level = len(line.split()[0])  # 计算 # 的数量
                title = line.lstrip("#").strip()
                outline.append({
                    "level": level,
                    "title": title
                })
        
        return outline
    
    def _calculate_quality_score(self, content: str, outline: list) -> float:
        """
        计算文档质量评分
        
        评分维度:
        1. 结构完整性 (30%): 是否包含必要的章节
        2. 内容丰富度 (30%): 字数、示例数量
        3. 格式规范性 (20%): Markdown 格式是否正确
        4. 可读性 (20%): 段落长度、层次清晰度
        """
        score = 0.0
        
        # 1. 结构完整性 (30分)
        required_sections = ["概述", "核心概念", "原理", "示例", "总结"]
        section_titles = [item["title"] for item in outline]
        matched_sections = sum(1 for req in required_sections if any(req in title for title in section_titles))
        structure_score = (matched_sections / len(required_sections)) * 30
        score += structure_score
        
        # 2. 内容丰富度 (30分)
        word_count = len(content)
        if word_count >= 2000:
            richness_score = 30
        elif word_count >= 1000:
            richness_score = 20
        elif word_count >= 500:
            richness_score = 10
        else:
            richness_score = 5
        score += richness_score
        
        # 3. 格式规范性 (20分)
        format_score = 0
        if "```" in content:  # 包含代码块
            format_score += 5
        if "$" in content or "$$" in content:  # 包含公式
            format_score += 5
        if len(outline) >= 5:  # 标题层次丰富
            format_score += 10
        score += format_score
        
        # 4. 可读性 (20分)
        paragraphs = [p for p in content.split("\n\n") if p.strip()]
        avg_paragraph_length = sum(len(p) for p in paragraphs) / max(len(paragraphs), 1)
        if 100 <= avg_paragraph_length <= 500:  # 段落长度适中
            readability_score = 20
        elif 50 <= avg_paragraph_length <= 800:
            readability_score = 15
        else:
            readability_score = 10
        score += readability_score
        
        # 归一化到 0-1
        return round(score / 100, 2)


async def document_generation_node(state: LearningAgentState) -> LearningAgentState:
    """
    文档生成节点
    
    从状态中获取知识点信息,生成课程讲解文档
    """
    # 获取必要参数
    knowledge_point = state.get("knowledge_point", "")
    student_profile = state.get("student_profile", {})
    course_context = state.get("course_context", "")
    related_knowledge = state.get("related_knowledge", [])
    
    if not knowledge_point:
        state["document_result"] = {
            "success": False,
            "error": "缺少知识点信息"
        }
        return state
    
    # 创建智能体并生成文档
    agent = DocumentGenerationAgent()
    
    try:
        result = await agent.generate_document(
            knowledge_point=knowledge_point,
            student_profile=student_profile,
            course_context=course_context,
            related_knowledge=related_knowledge
        )
        
        state["document_result"] = {
            "success": True,
            "data": result
        }
        
        # 记录执行轨迹
        trace = state.get("execution_trace", [])
        trace.append(f"document_generation:success:quality={result['quality_score']}")
        state["execution_trace"] = trace
        
    except Exception as e:
        state["document_result"] = {
            "success": False,
            "error": str(e)
        }
        
        # 记录错误
        trace = state.get("execution_trace", [])
        trace.append(f"document_generation:failed:{str(e)}")
        state["execution_trace"] = trace
    
    return state
