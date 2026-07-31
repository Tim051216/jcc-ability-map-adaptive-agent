# BiliLearn

基于大模型的个性化学习多智能体系统，面向中国软件杯 A3 赛题场景，围绕“学习画像 -> 学习规划 -> 资源生成 -> AI 导师 -> 测评反馈 -> 复习提醒”构建完整学习闭环。

> 团队成员第一次克隆仓库时，请按 [TEAM_SETUP.md](./TEAM_SETUP.md) 操作。让 AI 帮助启动时，请让它先读取 [AI_START_HERE.md](./AI_START_HERE.md)。

## Project Overview

本仓库不是单一的聊天应用，而是一套由 `Java 学习业务服务 + Python AI 中台 + React 学生端/管理端` 组成的多智能体学习平台。

当前版本已经完成以下核心方向：

- 个性化学生画像：支持画像维度抽取、阶段判断、成长图谱与能力可视化
- 个性化学习路径：支持目标驱动、阶段任务拆解、进度回写与推荐节奏
- 资源生成与补全：支持讲义、导图、练习、PPT、代码实操、补充阅读等资源工作台
- AI 导师：支持课程问答、截图理解、附件提取、多格式文档上下文答疑、最近会话
- 学习效果评估：支持测评、错题、学习报告、答疑证据、资源偏好等闭环反馈
- 复习提醒与消息中心：支持复习任务派发、通知联动与消息收口
- 管理端运营能力：支持用户治理、日志、审核、配置、摘要等后台能力

## Architecture

### 1. Java Business Services

- `a3-learning`
  承载学习路径、学习进度、测评、错题、部分稳定业务闭环接口
- `a3-gateway`
  统一网关，负责转发 AI 相关接口与聚合访问入口
- `a3-message`
  站内消息、通知、收件箱等能力
- `a3-user` / `a3-resource` / `a3-assessment` / `a3-media`
  承载用户、资源、题库、媒体等原有业务基础

### 2. Python AI Runtime

- `a3-ai-python`
  承载学习画像、RAG 检索、智能问答、学习计划、资源生成、智能辅导、视频理解、开放课堂、消息联动等 AI 能力

AI 运行时依赖：

- PostgreSQL
- Redis
- Milvus
- MinIO

### 3. Frontends

- `a3-student-react-web`
  当前默认学生端入口，开发端口 `3002`
- `a3-admin-web`
  当前默认管理端入口，开发端口 `3004`

## Current Demo Scope

当前版本适合直接演示的页面与能力包括：

- 首页总览与学习闭环入口
- 学习画像页 `/profile`
- 学习路径页 `/path`
- 资源中心 `/resources`
- 资源预览与生成资源工作台 `/resources/preview`
- 学习页与互动课堂 `/learn`
- AI 导师 `/tutor` 与消息中心 `/im`
- 学习报告 `/report`
- 测评页 `/evaluation`
- 管理端用户治理与运营页

推荐演示口径：

- `稳定业务链路`
  学习路径、测评、错题、报告、消息等基础能力
- `AI 增强链路`
  画像、RAG、资源生成、AI 导师、附件理解、多模态学习资源生成

## Repository Structure

```text
a3-learning-agent-system/
├─ a3-learning/              # Java 学习业务服务
├─ a3-gateway/               # Java 网关
├─ a3-message/               # 消息/通知服务
├─ a3-ai-python/             # Python AI 中台
├─ a3-student-react-web/     # 学生端前端（默认入口）
├─ a3-admin-web/             # 管理端前端
├─ sql/                      # 初始化与扩展 SQL
├─ scripts/                  # 启动、初始化、演示脚本
└─ deliverables/             # 答辩材料、项目文档、导出产物
```

## Quick Start

安装 Git、Docker Desktop、JDK 17、Node.js 20 和 Python 3.12 后，在 Windows PowerShell 执行：

```powershell
git clone https://github.com/Tim051216/jcc-ability-map-adaptive-agent.git
cd jcc-ability-map-adaptive-agent
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-full-local.ps1 -NoOpenPages
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1 -RequireServices
```

脚本会生成本地配置、安装锁定依赖、启动基础设施与应用，并执行健康检查。完整说明见：

- [AI_START_HERE.md](./AI_START_HERE.md)：供 AI 严格执行的启动与验收协议
- [TEAM_SETUP.md](./TEAM_SETUP.md)：团队成员首次安装说明
- [LOCAL_SETUP.md](./LOCAL_SETUP.md)

## Local Ports

- MySQL: `127.0.0.1:13306`
- Redis: `127.0.0.1:16379`
- RabbitMQ: `127.0.0.1:5672`
- PostgreSQL: `127.0.0.1:15432`
- MinIO API: `http://127.0.0.1:19000`
- Milvus: `127.0.0.1:19530`
- Java Gateway: `http://127.0.0.1:10010`
- Java Learning Service: `http://127.0.0.1:8090`
- Python AI Service: `http://127.0.0.1:18080`
- Student Web: `http://127.0.0.1:3002`
- Admin Web: `http://127.0.0.1:3004`

## Core Documents

- [A3_DEMO_RUNBOOK.md](./A3_DEMO_RUNBOOK.md)
  演示顺序、现场检查与兜底方案
- [A3_ARCHITECTURE.md](./A3_ARCHITECTURE.md)
  当前 Java + Python + Frontend 架构映射
- [A3_DEMO_API.md](./A3_DEMO_API.md)
  适合答辩演示的接口说明
- [A3_DELIVERY_STATUS.md](./A3_DELIVERY_STATUS.md)
  当前交付状态、稳定能力与风险项
- [AI_PERSONALIZED_LEARNING_AND_TUTOR_LOCATIONS.md](./AI_PERSONALIZED_LEARNING_AND_TUTOR_LOCATIONS.md)
  AI 功能分布与页面落点
- [REVIEW_REMINDER_TEST_GUIDE.md](./REVIEW_REMINDER_TEST_GUIDE.md)
  智能复习提醒验证说明

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind, ECharts, Motion, GSAP
- Backend: Spring Boot, MyBatis Plus, Python FastAPI
- AI: RAG, Vector Search, Multi-Agent Workflow, OCR / Attachment Parsing
- Infra: MySQL, Redis, RabbitMQ, PostgreSQL, MinIO, Milvus

## Open Source Notice

本项目是在原有在线学习工程基础上进行赛题化改造与 AI 能力扩展。若用于正式交付或答辩，请同时附带：

- 原项目来源
- 原项目协议
- 团队自主开发与改造说明

参考文档：

- [OPEN_SOURCE_NOTICE.md](./OPEN_SOURCE_NOTICE.md)
