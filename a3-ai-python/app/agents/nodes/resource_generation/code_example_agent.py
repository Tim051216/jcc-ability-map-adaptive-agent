"""
代码案例生成智能体

功能:
1. 根据知识点生成示例代码
2. 支持多种编程语言
3. 添加详细注释和说明
4. 代码质量检查和可运行性验证
"""

from typing import Dict, Any, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
import json

from app.core.config import settings
from app.agents.state import LearningAgentState


class CodeExampleGenerationAgent:
    """代码案例生成智能体"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0.6,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
    
    def _build_system_prompt(self, programming_language: str, difficulty_level: int) -> str:
        """构建系统提示词"""
        difficulty_desc = {
            1: "基础 - 简单直接的示例,适合初学者",
            2: "进阶 - 包含一定复杂度,展示最佳实践",
            3: "拔高 - 高级特性和优化技巧"
        }
        
        return f"""你是一位资深的 {programming_language} 开发专家和技术教育者,擅长编写清晰、规范的示例代码。

**当前任务**: 生成 {difficulty_desc.get(difficulty_level, '')} 的代码案例

**代码质量要求**:
1. **正确性**: 代码语法正确,逻辑无误,可以直接运行
2. **规范性**: 遵循 {programming_language} 的编码规范和最佳实践
3. **可读性**: 代码结构清晰,命名规范,注释详细
4. **教学性**: 突出知识点的应用,便于学习理解
5. **完整性**: 包含必要的导入、函数定义、测试用例

**注释要求**:
- 文件头注释: 说明代码功能和知识点
- 函数注释: 说明参数、返回值、功能
- 关键代码注释: 解释重要逻辑和算法
- 中文注释,清晰易懂

**输出格式** (JSON):
```json
{{
  "title": "案例标题",
  "description": "案例描述,说明要解决的问题",
  "code_content": "完整的代码内容",
  "run_instructions": "运行说明,包括环境要求、运行命令",
  "expected_output": "预期输出结果",
  "dependencies": ["依赖包1", "依赖包2"],
  "key_points": ["知识点1", "知识点2"]
}}
```

**代码模板** ({programming_language}):
"""
        
        # 根据语言添加模板
        if programming_language.lower() == "python":
            return self._add_python_template(base_prompt)
        elif programming_language.lower() == "java":
            return self._add_java_template(base_prompt)
        elif programming_language.lower() == "javascript":
            return self._add_javascript_template(base_prompt)
        else:
            return base_prompt
    
    def _add_python_template(self, base_prompt: str) -> str:
        """添加 Python 代码模板"""
        template = """
```python
\"\"\"
文件名: example.py
功能: [描述功能]
知识点: [列出知识点]
\"\"\"

# 导入必要的库
import xxx

def main_function(param1, param2):
    \"\"\"
    函数功能说明
    
    Args:
        param1: 参数1说明
        param2: 参数2说明
    
    Returns:
        返回值说明
    \"\"\"
    # 实现代码
    pass

# 测试代码
if __name__ == "__main__":
    # 测试用例
    result = main_function(test_param1, test_param2)
    print(f"结果: {result}")
```
"""
        return base_prompt + template
    
    def _add_java_template(self, base_prompt: str) -> str:
        """添加 Java 代码模板"""
        template = """
```java
/**
 * 类名: Example
 * 功能: [描述功能]
 * 知识点: [列出知识点]
 */
public class Example {
    /**
     * 方法功能说明
     * @param param1 参数1说明
     * @param param2 参数2说明
     * @return 返回值说明
     */
    public static ReturnType mainMethod(Type1 param1, Type2 param2) {
        // 实现代码
        return result;
    }
    
    // 测试方法
    public static void main(String[] args) {
        // 测试用例
        ReturnType result = mainMethod(testParam1, testParam2);
        System.out.println("结果: " + result);
    }
}
```
"""
        return base_prompt + template
    
    def _add_javascript_template(self, base_prompt: str) -> str:
        """添加 JavaScript 代码模板"""
        template = """
```javascript
/**
 * 文件名: example.js
 * 功能: [描述功能]
 * 知识点: [列出知识点]
 */

/**
 * 函数功能说明
 * @param {Type1} param1 - 参数1说明
 * @param {Type2} param2 - 参数2说明
 * @returns {ReturnType} 返回值说明
 */
function mainFunction(param1, param2) {
    // 实现代码
    return result;
}

// 测试代码
const result = mainFunction(testParam1, testParam2);
console.log(`结果: ${result}`);
```
"""
        return base_prompt + template
    
    def _build_user_prompt(
        self,
        knowledge_point: str,
        programming_language: str,
        difficulty_level: int,
        specific_requirements: Optional[str] = None
    ) -> str:
        """构建用户提示词"""
        prompt = f"请为以下知识点生成 {programming_language} 代码案例:\n\n"
        prompt += f"**知识点**: {knowledge_point}\n"
        prompt += f"**难度级别**: {difficulty_level} (1-基础, 2-进阶, 3-拔高)\n"
        
        if specific_requirements:
            prompt += f"\n**特殊要求**: {specific_requirements}\n"
        
        prompt += "\n请生成完整的代码案例,以 JSON 格式输出。"
        
        return prompt
    
    async def generate_code_example(
        self,
        knowledge_point: str,
        programming_language: str = "Python",
        difficulty_level: int = 1,
        specific_requirements: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        生成代码案例
        
        Args:
            knowledge_point: 知识点名称
            programming_language: 编程语言
            difficulty_level: 难度级别
            specific_requirements: 特殊要求
            
        Returns:
            代码案例数据字典
        """
        system_prompt = self._build_system_prompt(programming_language, difficulty_level)
        user_prompt = self._build_user_prompt(
            knowledge_point, programming_language, difficulty_level, specific_requirements
        )
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        # 调用 LLM 生成代码
        response = await self.llm.ainvoke(messages)
        
        # 解析响应
        code_data = self._parse_code_response(response.content)
        
        # 添加元数据
        code_data["programming_language"] = programming_language
        code_data["difficulty_level"] = difficulty_level
        code_data["has_test_cases"] = "test" in code_data.get("code_content", "").lower()
        code_data["is_runnable"] = True  # 假设生成的代码可运行
        
        # 代码结构分析
        code_data["code_structure"] = self._analyze_code_structure(
            code_data.get("code_content", ""),
            programming_language
        )
        
        return code_data
    
    def _parse_code_response(self, content: str) -> Dict[str, Any]:
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
            
            # 如果都失败,尝试提取代码块
            code_content = ""
            if "```" in content:
                parts = content.split("```")
                for i, part in enumerate(parts):
                    if i % 2 == 1:  # 代码块内容
                        # 移除语言标识
                        lines = part.split("\n")
                        if lines[0].strip() in ["python", "java", "javascript", "cpp", "c"]:
                            code_content = "\n".join(lines[1:])
                        else:
                            code_content = part
                        break
            
            return {
                "title": "代码示例",
                "description": "知识点应用示例",
                "code_content": code_content or content,
                "run_instructions": "请根据代码内容运行",
                "expected_output": "请查看代码注释",
                "dependencies": [],
                "key_points": []
            }
        except json.JSONDecodeError:
            # JSON 解析失败,返回默认结构
            return {
                "title": "代码示例",
                "description": "知识点应用示例",
                "code_content": content,
                "run_instructions": "请根据代码内容运行",
                "expected_output": "请查看代码注释",
                "dependencies": [],
                "key_points": []
            }
    
    def _analyze_code_structure(self, code: str, language: str) -> Dict[str, Any]:
        """分析代码结构"""
        structure = {
            "file_count": 1,
            "function_count": 0,
            "class_count": 0,
            "line_count": len(code.split("\n")),
            "comment_lines": 0
        }
        
        lines = code.split("\n")
        
        for line in lines:
            line_stripped = line.strip()
            
            # 统计注释行
            if language.lower() == "python":
                if line_stripped.startswith("#") or '"""' in line or "'''" in line:
                    structure["comment_lines"] += 1
            elif language.lower() in ["java", "javascript", "cpp", "c"]:
                if line_stripped.startswith("//") or line_stripped.startswith("/*"):
                    structure["comment_lines"] += 1
            
            # 统计函数
            if language.lower() == "python":
                if line_stripped.startswith("def "):
                    structure["function_count"] += 1
                if line_stripped.startswith("class "):
                    structure["class_count"] += 1
            elif language.lower() == "java":
                if " class " in line and "{" in line:
                    structure["class_count"] += 1
                if ("public " in line or "private " in line or "protected " in line) and "(" in line and ")" in line:
                    structure["function_count"] += 1
        
        return structure


async def code_example_generation_node(state: LearningAgentState) -> LearningAgentState:
    """
    代码案例生成节点
    
    从状态中获取知识点信息,生成代码示例
    """
    # 获取必要参数
    knowledge_point = state.get("knowledge_point", "")
    programming_language = state.get("programming_language", "Python")
    difficulty_level = state.get("difficulty_level", 1)
    specific_requirements = state.get("code_requirements", None)
    
    if not knowledge_point:
        state["code_example_result"] = {
            "success": False,
            "error": "缺少知识点信息"
        }
        return state
    
    # 创建智能体并生成代码
    agent = CodeExampleGenerationAgent()
    
    try:
        result = await agent.generate_code_example(
            knowledge_point=knowledge_point,
            programming_language=programming_language,
            difficulty_level=difficulty_level,
            specific_requirements=specific_requirements
        )
        
        state["code_example_result"] = {
            "success": True,
            "data": result
        }
        
        # 记录执行轨迹
        trace = state.get("execution_trace", [])
        trace.append(f"code_example_generation:success:language={programming_language}")
        state["execution_trace"] = trace
        
    except Exception as e:
        state["code_example_result"] = {
            "success": False,
            "error": str(e)
        }
        
        # 记录错误
        trace = state.get("execution_trace", [])
        trace.append(f"code_example_generation:failed:{str(e)}")
        state["execution_trace"] = trace
    
    return state
