# 五个核心智能体方案说明

## 调整目标

为避免项目在答辩和架构表达上出现“过度智能体化”的问题，当前已将主学习链路收敛为 **5 个核心智能体**。  
原先的部分路由、汇总、兜底逻辑不再对外强调为独立智能体，而是下沉为核心智能体内部流程节点。

## 五个核心智能体

### 1. 学习画像智能体

- 代码入口：`a3-ai-python/app/agents/nodes/profile_agent.py`
- 对外职责：
  - 拉取用户基础信息
  - 构建学习画像上下文
  - 为后续规划、资源、评估提供个性化输入

### 2. 知识检索与答疑智能体

- 代码入口：`a3-ai-python/app/agents/nodes/knowledge_tutoring_agent.py`
- 内部整合：
  - `router_agent`
  - `retriever_agent`
  - `AnswerService`
- 对外职责：
  - 识别当前学习场景
  - 执行 RAG 检索
  - 生成基础问答结果

### 3. 学习规划智能体

- 代码入口：`a3-ai-python/app/agents/nodes/learning_planning_agent.py`
- 内部整合：
  - `planner_agent`
- 对外职责：
  - 根据用户目标、画像和课程上下文生成个性化学习路径

### 4. 资源生成智能体

- 代码入口：`a3-ai-python/app/agents/nodes/resource_generation_agent.py`
- 内部整合：
  - `resource_agent`
  - 资源协调器及讲义、题库、导图、代码示例等子能力
- 对外职责：
  - 生成或推荐个性化学习资源

### 5. 测评反馈智能体

- 代码入口：`a3-ai-python/app/agents/nodes/evaluation_feedback_agent.py`
- 内部整合：
  - `assessment_agent`
  - `safety_agent`
  - 最终答复汇总逻辑
- 对外职责：
  - 生成学习效果评估
  - 汇总问答、规划、资源结果
  - 输出最终安全兜底后的回复

## 当前主链路

当前主学习图入口位于：

- `a3-ai-python/app/agents/graph.py`

执行顺序为：

1. 学习画像智能体
2. 知识检索与答疑智能体
3. 学习规划智能体
4. 资源生成智能体
5. 测评反馈智能体

## 调整收益

- 对外架构表达更清晰，更符合 A3 赛题“多智能体协同”而不是“堆叠智能体数量”的要求
- 保留原有实现能力，避免大范围重写
- 主链路更适合答辩展示与 PPT 绘图
- 便于后续继续把内部节点和核心智能体区分开管理
