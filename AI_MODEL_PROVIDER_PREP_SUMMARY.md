# AI Model Provider Prep Summary

## Problem

- `a3-ai-python` 之前只能通过 `llm/ping` 间接判断大模型是否可用，缺少对 embedding 服务的显式探活。
- 本地 `.env` 仍指向示例地址，容易让联调结果看起来像“真实模型异常”，但本质上只是未配置。
- 真实 embedding 接入时还存在一个隐患：Milvus 维度与模型输出维度不一致时，问题不容易第一时间暴露。

## Root Cause

- 早期重点放在 RAG 骨架与链路打通，模型侧的可观测性和接入说明还不完整。
- 本地环境默认值没有明确区分“未配置真实服务”和“服务调用失败”。

## Changes

- 重写 `a3-ai-python/app/services/embedding_service.py`
  - 新增 embedding 远程调用探活
  - 增加维度一致性校验
  - 保留本地哈希向量降级能力
- 扩展 `a3-ai-python/app/api/v1/admin.py`
  - 新增 `GET /api/v1/admin/embedding/ping`
- 清理 `a3-ai-python/app/rag/ingest/pipelines.py` 中残留乱码文案
- 扩展配置项：
  - `EMBEDDING_TIMEOUT_SECONDS`
- 更新示例配置：
  - `a3-ai-python/.env.example`
- 整理接入说明：
  - `AI_MODEL_PROVIDER_SETUP.md`
- 调整本地实际配置 `a3-ai-python/.env`
  - 默认不再指向 `example.com`
  - 默认明确使用 `hash` embedding 降级模式

## Verification

- `a3-ai-python/.venv/Scripts/python -m compileall a3-ai-python/app`
- `GET http://127.0.0.1:18080/api/v1/admin/embedding/ping`
- `GET http://127.0.0.1:18080/api/v1/admin/llm/ping`
- `GET http://127.0.0.1:10010/ai/v1/admin/embedding/ping`
- `POST http://127.0.0.1:18080/api/v1/rag/search`

## Current Status

- 当前 `LLM` 状态：`unavailable`
  - 原因：本地尚未填写真实 `LLM_BASE_URL` / `LLM_API_KEY`
- 当前 `Embedding` 状态：`fallback`
  - 原因：本地明确使用哈希向量，尚未接入真实 embedding 服务
