# AI Service Runtime Fix Summary

## Problem

- `a3-ai-python` 中部分核心服务文件被乱码和半截字符串污染，存在语法风险，影响聊天、学习计划、资源生成和 LLM 探活接口。
- 本地示例知识库 `ml_intro` 的 Markdown 内容本身也是坏编码，导致入库后检索和聊天结果出现中文乱码。

## Root Cause

- 前一次编辑过程中，部分 Python 文件和文档出现编码异常与不完整字符串。
- 本地知识库样例文件不是正常 UTF-8 中文内容，污染了 PostgreSQL 和 Milvus 中的新入库数据。

## Changes

- 重写并修复以下文件中的乱码和异常字符串：
  - `a3-ai-python/app/integrations/llm/xfyun.py`
  - `a3-ai-python/app/services/answer_service.py`
  - `a3-ai-python/app/api/v1/admin.py`
  - `a3-ai-python/app/services/plan_service.py`
  - `a3-ai-python/app/services/resource_service.py`
  - `a3-ai-python/app/services/rag_service.py`
- 清理并重写 `AI_SERVICE_LOCAL_SETUP.md`，恢复可读中文说明。
- 重写本地知识库样例：
  - `a3-ai-python/knowledge_base/ml_intro/00_overview.md`
  - `a3-ai-python/knowledge_base/ml_intro/01_supervised_learning.md`
  - `a3-ai-python/knowledge_base/ml_intro/02_model_evaluation.md`
  - `a3-ai-python/knowledge_base/ml_intro/03_feature_engineering.md`
- 重新启动本地 AI 服务并重新执行 `ml_intro` 知识入库。

## Verification

- `a3-ai-python/.venv/Scripts/python -m compileall a3-ai-python/app`
- `GET http://127.0.0.1:18080/health`
- `POST http://127.0.0.1:18080/api/v1/admin/knowledge/ml_intro/ingest`
- `POST http://127.0.0.1:18080/api/v1/rag/search`
- `POST http://127.0.0.1:18080/api/v1/chat`
- `GET http://127.0.0.1:18080/api/v1/admin/llm/ping`

备注：
- Python 直连接口已验证通过。
- `/api/v1/admin/llm/ping` 当前返回 `unavailable` 属于预期，因为 `.env` 里的 `LLM_BASE_URL` 仍是示例地址 `https://example.com`。
- Java 网关 `http://127.0.0.1:10010` 当前未运行，因此 `/ai/**` 路由本轮未完成联调验证。
