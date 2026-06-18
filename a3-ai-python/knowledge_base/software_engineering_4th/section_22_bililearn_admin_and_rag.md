# BiliLearn 管理端与知识库入库说明

## 管理端主要负责什么

管理端不是学生学习页面的简单镜像，而是平台治理与运营入口。主要职责包括：

- 查看系统运行状态
- 管理课程、资料与消息
- 触发知识库入库
- 查看用户治理与平台数据

## 知识库放在哪里

Python AI 中台本地知识库目录在：

- `a3-ai-python/knowledge_base`

当前项目里常见课程知识库包括：

- `knowledge_base/ml_intro`
- `knowledge_base/software_engineering_4th`

## 知识库如何被加载

本地 Markdown 知识库会被 `CourseKnowledgeLoader` 加载。规则大致是：

- 每个课程一个目录
- `00_overview.md` 作为课程总览
- 其他 `.md` 文件作为知识章节
- 章节内容会被切成若干检索块供 RAG 使用

## 项目使用文档为什么也适合放进知识库

因为 AI 导师不仅要回答课程概念，也经常会被问到：

- 这个项目怎么用
- 每个页面干什么
- 为什么会有两个端口
- 为什么 AI 服务不可用
- 管理端和学生端有什么区别

这些都属于“系统使用知识”，很适合和课程资料一起作为 RAG 检索源。

## 如何触发知识入库

常见入库接口是：

```text
POST /api/v1/admin/knowledge/{course_code}/ingest
```

通过网关访问时通常是：

```text
POST /ai/v1/admin/knowledge/{course_code}/ingest
```

例如：

- `ml_intro`
- `software_engineering_4th`

## RAG 检索接口是什么

常见检索接口是：

```text
POST /api/v1/rag/search
```

或通过网关：

```text
POST /ai/v1/rag/search
```

## 入库资料应该怎么写更适合 AI 导师

为了让 AI 导师回答更稳，文档建议遵循这些原则：

- 一篇文档只讲一个主题
- 标题要明确
- 多用问答式小节
- 用步骤和场景描述代替大段泛讲
- 写清楚页面、端口、接口和文件位置

## 哪些问题优先命中这组文档

以下问题优先参考本组“项目使用文档”知识库：

- 项目怎么启动
- 学生端和管理端分别做什么
- 每个页面的定位是什么
- 为什么端口会冲突
- AI 导师为什么这么设计
- 资源页、画像页、IM 页怎么理解
