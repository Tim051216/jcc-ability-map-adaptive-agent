# ECS 部署预备说明

本目录提供当前 A3 仓库的一套轻量级 ECS 部署方案。

目标形态：

- `a3-learning` 部署到 ECS
- `a3-gateway` 部署到 ECS
- `a3-ai-python` 部署到 ECS
- `a3-student-web` 部署到 ECS
- `nginx` 作为公网统一入口部署到 ECS
- MySQL / Redis / PostgreSQL / OSS 由 ECS 外部托管

## 包含内容

- `docker-compose.yml`：单机形态的 ECS 部署编排
- `nginx.conf`：学生端与 API 路由的反向代理配置
- `env/*.example`：脱敏后的环境变量模板
- `env/*.minimal.env.example`：首次低成本演示所需的最小模板
- `a3-learning` 与 `a3-gateway` 的生产环境 Spring Profile
- `a3-learning` 与 `a3-gateway` 的 Dockerfile
- `MINIMAL_DEMO_CHAIN.md`：首轮低成本 ECS 演示中相对稳妥的页面与能力范围

## 首次部署前

1. 如果目标是最短路径跑通首轮演示，可先复制最小环境变量模板：

```powershell
Copy-Item .\deploy\ecs\env\ai.minimal.env.example .\deploy\ecs\env\ai.env
Copy-Item .\deploy\ecs\env\learning.minimal.env.example .\deploy\ecs\env\learning.env
Copy-Item .\deploy\ecs\env\gateway.minimal.env.example .\deploy\ecs\env\gateway.env
```

如果希望配置更完整，也可以改用普通的 `*.env.example` 模板。

2. 只填写首次启动真正会卡住的关键配置：

```powershell
notepad .\deploy\ecs\env\ai.env
notepad .\deploy\ecs\env\learning.env
notepad .\deploy\ecs\env\gateway.env
```

首次启动至少需要补齐：

- MySQL / PostgreSQL / Redis 的连接地址
- OSS 凭证与 Bucket
- LLM / Embedding 模型凭证
- `JAVA_INTERNAL_TOKEN`

3. 构建并启动：

```powershell
cd .\deploy\ecs
docker compose up -d --build
```

## 当前重要限制

- 当前这套 ECS 方案按 `MILVUS_ENABLED=false` 的场景设计。
- 在该模式下，RAG 检索与知识入库会被有意降级：
  - `/ai/api/v1/rag/search` 返回空命中
  - 管理端知识入库接口返回 `503`
  - 聊天与智能辅导仍可运行，但不具备向量检索增强能力
- `a3-learning` 与 `a3-gateway` 的部分路由仍会引用 `auth-service`、`user-service`、`course-service` 等上游服务。如果你的演示链路需要这些接口，则必须：
  - 一并部署对应服务，或
  - 在最终发布前收缩路由范围或调整鉴权方案

## 建议公网入口

- `http://<ecs-ip>/`：学生端前端
- `http://<ecs-ip>/ai/...`：`gateway -> ai-python`
- `http://<ecs-ip>/ls/...`：`gateway -> learning`

## 建议下一步

在这套部署准备合入后，先做一次不包含真实密钥的干净 GitHub 推送，再基于本目录执行首次 ECS 演练。
