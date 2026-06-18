# 中国软件杯 A3 赛题对齐说明

## 文档目的

本文档用于对齐本项目与“基于大模型的个性化资源生成与学习多智能体系统”赛题要求，明确：

- 当前已完成能力
- 正在补齐能力
- 开源组件来源与协议
- 与科大讯飞优先、防幻觉、多智能体、多模态、工程化相关的落地方案

## 对齐原则

- 讯飞工具优先：模型、ASR、OCR、内容安全优先兼容或接入科大讯飞生态
- 开源合规：优先使用 `MIT`、`Apache 2.0`、`PostgreSQL` 等宽松协议
- 防幻觉：采用 `RAG + 引用回溯 + 安全校验 + 规则兜底`
- 多智能体协同：拆分画像、答疑、规划、资源生成、评估反馈等独立 Agent
- 产品化交付：前后端以真实数据、真实链路、可验证结果为准，不使用演示性质假流程作为最终交付

## 核心能力对齐清单

### 1. 多智能体协同

- 当前状态：`已完成基础版本，已升级主工作流编排`
- 项目位置：
  - [graph.py](F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/app/agents/graph.py)
  - [state.py](F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/app/agents/state.py)
- 已落地能力：
  - 学生画像 Agent
  - 知识答疑 / 检索 Agent
  - 学习路径规划 Agent
  - 资源生成 Agent
  - 评估反馈 Agent
- 当前说明：
  - 已从简单线性串行流，升级为基于状态条件分流的 LangGraph 主流程
  - 已支持从 `画像分析 -> 答疑检索 -> 路径规划 -> 资源生成 -> 效果评估` 的条件化编排
  - 已支持评估分数不足时触发一次回环重规划，形成闭环

### 2. LangChain + LangGraph（工业级工作流编排）

- 地址：
  - [LangChain](https://github.com/langchain-ai/langchain)
  - [LangGraph](https://github.com/langchain-ai/langgraph)
- 协议：`MIT`
- 适配场景：
  - 复杂流水线任务
  - RAG 知识库联动
  - 长流程资源生成
  - 学习路径动态规划
- 接入价值：
  - LangChain 统一封装 Prompt、模型、工具调用接口，便于优先对接讯飞大模型 API
  - LangGraph 基于状态图进行工作流编排，适合赛题要求的闭环型教学智能体流程
  - 可与向量数据库、知识检索、评估反馈模块联动，降低幻觉并增强可追溯性
- 本项目完成情况：
  - `已完成依赖接入`
  - `已完成画像对话图与主学习图接入`
  - `已完成主流程从线性流向条件路由闭环流升级`
  - `已完成基于评估结果的单次回环重规划`
- 当前代码落点：
  - [graph.py](F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/app/agents/graph.py)
  - [conversation_graph.py](F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/app/agents/nodes/profile_conversation/conversation_graph.py)
- 结论：
  - 这一部分现在可以认定为 `已完成主干落地`
  - 后续可继续增强为更细粒度分支，例如资源生成失败重试、多模型降级、异步任务拆分，但不影响当前赛题主链路成立

### 3. RAG 知识库与防幻觉

- 当前状态：`已完成基础版`
- 已落地能力：
  - 按课程维度建立知识库集合
  - 课程文本切片与向量化
  - 检索接口与上下文回答
  - embedding 接口不可用时的稳定降级
  - `/ai/v1/rag/search` 检索接口
- 防幻觉策略：
  - 检索增强生成
  - 引用片段回传
  - 无上下文时保守回答
  - 安全节点做最终输出校验

### 4. 个性化资源生成

- 当前状态：`已完成可用链路`
- 已支持资源类型：
  - 讲义
  - 导图
  - 练习
  - 课件草案
  - 扩展阅读 / 实验类资源
- 当前说明：
  - 前端 `/learn` 已接入真实资源生成结果回填
  - 后端已输出结构化中文内容，不再使用英文演示型占位文案作为主结果
  - `生成 PPT` 已支持真实 `.pptx` 导出
  - `生成讲义` 已优先走后端 `docx` 下载链路，前端保留兼容降级导出
  - `生成导图` 已优先支持后端结构化 `json` 下载，前端保留图形化预览与本地降级导出
  - `生成练习` 已优先走后端 `docx` 下载链路，前端保留在线作答与本地降级导出
  - 这部分现在可按 `已可演示、已可使用、已具备正式导出链路` 认定，后续仍可继续增强到 `.xmind` / 专用题库模板

### 5. 学习评估与反馈

- 当前状态：`已完成基础版`
- 已落地能力：
  - 结合画像、学习路径、资源使用情况生成评估
  - 输出总分、掌握等级、建议摘要
  - 评估低分时回流学习规划节点

## 开源组件与合规标注

### 必选主干

- `LangChain`，来源：`langchain-ai/langchain`，协议：`MIT`
- `LangGraph`，来源：`langchain-ai/langgraph`，协议：`MIT`
- `FastAPI`，来源：`tiangolo/fastapi`，协议：`Apache 2.0`
- `python-docx`，来源：`python-openxml/python-docx`，协议：`MIT`
- `python-pptx`，来源：`scanny/python-pptx`，协议：`MIT`
- `Tailwind CSS`，来源：`tailwindlabs/tailwindcss`，协议：`MIT`

### 知识库 / 检索

- `Milvus`，协议：`Apache 2.0`
- `Chroma`，协议：`Apache 2.0`
- `FAISS`，协议：`MIT`

### 可选增强

- `AutoGen`，来源：`microsoft/autogen`，协议：`MIT`
- `OpenMAIC`，来源：`清华 THUNLP 开源互动课堂方案`，协议：`Apache 2.0`
- `AgentScope`，来源：`alibaba/agent_scope`，协议：`Apache 2.0`
- `PaddleOCR`，协议：`Apache 2.0`

## 与讯飞生态结合建议

- 模型层：优先切换或兼容讯飞星火模型接口
- 语音层：优先接入讯飞 ASR 做课程音视频转写
- 图文层：优先接入讯飞 OCR 或兼容 OCR 服务
- 安全层：优先接入讯飞内容安全服务

## 创新加分项落地

### OpenMAIC 风格互动课堂层

- 当前状态：`已完成项目内落地`
- 代码位置：
  - [open_classroom.py](F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/app/api/v1/open_classroom.py)
  - [open_classroom_service.py](F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/app/services/open_classroom_service.py)
  - [open_classroom.py](F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/app/schemas/open_classroom.py)
- 已落地能力：
  - AI 教师主讲卡片
  - AI 助教追问与澄清脚本
  - AI 测评器随堂题生成
  - PPT 课件提纲草案
  - 互动课堂多轮脚本输出
- 说明：
  - 当前采用“在现有多智能体服务内实现 OpenMAIC 风格教育互动层”的方式完成落地
  - 重点交付的是赛题真正需要的互动课堂能力，而不是仅在文档中引用外部框架名称
  - 该层可与现有 LangGraph 主流程、资源生成、评估反馈模块继续联动，作为上层演示与创新加分入口

## 当前结论

围绕你指定的 `(2) LangChain + LangGraph（工业级工作流编排）`，项目此前属于“有依赖、有节点、但主图未完全闭环”的 `部分完成` 状态；本次已将主工作流升级为 `条件路由 + 评估回环` 的 LangGraph 编排，现可按赛题口径认定为 `主干已完成`。
