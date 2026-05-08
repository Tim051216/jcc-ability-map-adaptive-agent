# DashScope Model Enable Summary

## Problem

- `a3-ai-python` 本地环境仍未接入真实 LLM 与 Embedding 服务，RAG 检索依赖哈希向量降级模式，无法体现比赛成品效果。

## Root Cause

- `.env` 中尚未填写真实的 OpenAI 兼容模型服务地址与密钥。

## Changes

- 更新 `a3-ai-python/.env`
  - `LLM_PROVIDER=openai_compat`
  - `LLM_MODEL=qwen3.6-plus`
  - `LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
  - `EMBEDDING_PROVIDER=openai_compat`
  - `EMBEDDING_MODEL=text-embedding-v4`
  - `EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- 重启本地 `a3-ai-python` 服务使配置生效。

## Verification

- `GET http://127.0.0.1:18080/api/v1/admin/llm/ping`
- `GET http://127.0.0.1:18080/api/v1/admin/embedding/ping`
- `POST http://127.0.0.1:18080/api/v1/rag/search`
- `GET http://127.0.0.1:10010/ai/v1/admin/llm/ping`
- `GET http://127.0.0.1:10010/ai/v1/admin/embedding/ping`

## Result

- `LLM ping`：`ok`
- `Embedding ping`：`ok`
- 网关 `/ai/**` 转发后的模型探活也已验证通过
