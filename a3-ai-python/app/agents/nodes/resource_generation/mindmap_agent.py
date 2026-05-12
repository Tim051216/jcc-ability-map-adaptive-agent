"""
思维导图生成智能体

功能:
1. 分析知识点结构和层次关系
2. 生成 Mermaid 格式的思维导图代码
3. 优化布局和可读性
4. 控制节点数量和深度
"""

from typing import Dict, Any, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.agents.state import LearningAgentState


class MindmapGenerationAgent:
    """思维导图生成智能体"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0.5,  # 降低温度以获得更结构化的输出
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
    
    def _build_system_prompt(self) -> str:
        """构建系统提示词"""
        return """你是一位知识结构分析专家,擅长将复杂的知识点组织成清晰的思维导图。

你的任务是分析给定的知识点,提取其层次结构和关系,生成 Mermaid 格式的思维导图代码。

**Mermaid 思维导图语法**:
```mermaid
mindmap
  root((中心主题))
    分支1
      子节点1-1
      子节点1-2
    分支2
      子节点2-1
        细节2-1-1
        细节2-1-2
      子节点2-2
    分支3
```

**要求**:
1. **结构清晰**: 
   - 中心节点使用 ((...)) 双圆括号
   - 合理划分主要分支 (3-6个)
   - 层级深度控制在 3-4 层
   - 节点总数控制在 15-30 个

2. **内容准确**:
   - 准确提取知识点的核心概念
   - 正确表达概念之间的层次关系
   - 避免遗漏重要知识点

3. **命名规范**:
   - 节点名称简洁明了 (5-15字)
   - 使用专业术语
   - 避免冗长描述

4. **布局优化**:
   - 同级节点数量均衡
   - 避免某个分支过深或过浅
   - 保持视觉平衡

**输出格式**:
只输出 Mermaid 代码,不要包含其他解释文字。代码必须以 ```mermaid 开始,以 ``` 结束。
"""
    
    def _build_user_prompt(
        self,
        knowledge_point: str,
        course_context: Optional[str] = None,
        related_knowledge: Optional[list] = None
    ) -> str:
        """构建用户提示词"""
        prompt = f"请为以下知识点生成思维导图:\n\n**知识点**: {knowledge_point}\n"
        
        if course_context:
            prompt += f"\n**课程背景**: {course_context}\n"
        
        if related_knowledge:
            prompt += f"\n**相关知识点**: {', '.join(related_knowledge)}\n"
            prompt += "\n(请将相关知识点作为分支节点纳入思维导图)\n"
        
        prompt += "\n请生成 Mermaid 格式的思维导图代码。"
        
        return prompt
    
    async def generate_mindmap(
        self,
        knowledge_point: str,
        course_context: Optional[str] = None,
        related_knowledge: Optional[list] = None,
        max_depth: int = 4,
        max_nodes: int = 30
    ) -> Dict[str, Any]:
        """
        生成思维导图
        
        Args:
            knowledge_point: 知识点名称
            course_context: 课程上下文
            related_knowledge: 相关知识点列表
            max_depth: 最大层级深度
            max_nodes: 最大节点数量
            
        Returns:
            包含思维导图代码和元数据的字典
        """
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(knowledge_point, course_context, related_knowledge)
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        # 调用 LLM 生成思维导图
        response = await self.llm.ainvoke(messages)
        mermaid_code = self._extract_mermaid_code(response.content)
        
        # 分析思维导图结构
        analysis = self._analyze_mindmap(mermaid_code)
        
        # 如果超出限制,进行优化
        if analysis["node_count"] > max_nodes or analysis["max_depth"] > max_depth:
            mermaid_code = await self._optimize_mindmap(
                mermaid_code, knowledge_point, max_depth, max_nodes
            )
            analysis = self._analyze_mindmap(mermaid_code)
        
        # 添加样式配置
        style_config = self._generate_style_config()
        
        return {
            "mermaid_code": mermaid_code,
            "node_count": analysis["node_count"],
            "max_depth": analysis["max_depth"],
            "layout_type": "TB",  # Top to Bottom
            "style_config": style_config,
        }
    
    def _extract_mermaid_code(self, content: str) -> str:
        """从 LLM 响应中提取 Mermaid 代码"""
        # 查找 ```mermaid ... ``` 代码块
        if "```mermaid" in content:
            start = content.find("```mermaid") + len("```mermaid")
            end = content.find("```", start)
            if end != -1:
                return content[start:end].strip()
        
        # 如果没有代码块标记,尝试查找 mindmap 关键字
        if "mindmap" in content:
            lines = content.split("\n")
            mermaid_lines = []
            in_mindmap = False
            for line in lines:
                if "mindmap" in line:
                    in_mindmap = True
                if in_mindmap:
                    mermaid_lines.append(line)
            return "\n".join(mermaid_lines).strip()
        
        # 如果都没有,返回原内容
        return content.strip()
    
    def _analyze_mindmap(self, mermaid_code: str) -> Dict[str, Any]:
        """
        分析思维导图结构
        
        Returns:
            包含节点数量、最大深度等信息的字典
        """
        lines = mermaid_code.split("\n")
        node_count = 0
        max_depth = 0
        
        for line in lines:
            line = line.strip()
            if not line or line == "mindmap":
                continue
            
            # 计算缩进级别(每2个空格为一级)
            indent = len(line) - len(line.lstrip())
            depth = indent // 2
            max_depth = max(max_depth, depth)
            
            # 统计节点
            if line.strip():
                node_count += 1
        
        return {
            "node_count": node_count,
            "max_depth": max_depth
        }
    
    async def _optimize_mindmap(
        self,
        mermaid_code: str,
        knowledge_point: str,
        max_depth: int,
        max_nodes: int
    ) -> str:
        """
        优化思维导图,减少节点数量或深度
        """
        optimization_prompt = f"""以下是一个思维导图的 Mermaid 代码,但它的节点数量或深度超出了限制。

**原始代码**:
```mermaid
{mermaid_code}
```

**优化要求**:
- 最大深度: {max_depth} 层
- 最大节点数: {max_nodes} 个
- 保留最核心的概念和关系
- 合并相似的节点
- 删除过于细节的子节点

请生成优化后的 Mermaid 代码。
"""
        
        messages = [
            SystemMessage(content=self._build_system_prompt()),
            HumanMessage(content=optimization_prompt)
        ]
        
        response = await self.llm.ainvoke(messages)
        optimized_code = self._extract_mermaid_code(response.content)
        
        return optimized_code
    
    def _generate_style_config(self) -> Dict[str, Any]:
        """生成样式配置"""
        return {
            "theme": "default",
            "node_style": {
                "root": {
                    "fill": "#4CAF50",
                    "color": "#fff",
                    "font_size": "18px"
                },
                "branch": {
                    "fill": "#2196F3",
                    "color": "#fff",
                    "font_size": "14px"
                },
                "leaf": {
                    "fill": "#FFC107",
                    "color": "#000",
                    "font_size": "12px"
                }
            },
            "edge_style": {
                "stroke": "#666",
                "stroke_width": "2px"
            }
        }


async def mindmap_generation_node(state: LearningAgentState) -> LearningAgentState:
    """
    思维导图生成节点
    
    从状态中获取知识点信息,生成思维导图
    """
    # 获取必要参数
    knowledge_point = state.get("knowledge_point", "")
    course_context = state.get("course_context", "")
    related_knowledge = state.get("related_knowledge", [])
    
    if not knowledge_point:
        state["mindmap_result"] = {
            "success": False,
            "error": "缺少知识点信息"
        }
        return state
    
    # 创建智能体并生成思维导图
    agent = MindmapGenerationAgent()
    
    try:
        result = await agent.generate_mindmap(
            knowledge_point=knowledge_point,
            course_context=course_context,
            related_knowledge=related_knowledge
        )
        
        state["mindmap_result"] = {
            "success": True,
            "data": result
        }
        
        # 记录执行轨迹
        trace = state.get("execution_trace", [])
        trace.append(f"mindmap_generation:success:nodes={result['node_count']},depth={result['max_depth']}")
        state["execution_trace"] = trace
        
    except Exception as e:
        state["mindmap_result"] = {
            "success": False,
            "error": str(e)
        }
        
        # 记录错误
        trace = state.get("execution_trace", [])
        trace.append(f"mindmap_generation:failed:{str(e)}")
        state["execution_trace"] = trace
    
    return state
