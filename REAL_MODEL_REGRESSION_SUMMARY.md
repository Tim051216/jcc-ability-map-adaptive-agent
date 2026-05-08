# Real Model Regression Summary

## Problem

- 切换到 DashScope 真实模型后，需要确认：
  - 课程知识是否已重新用真实 embedding 入库
  - RAG 检索排序是否正常
  - `/chat`、`/plan`、`/resource` 是否仍可稳定输出
  - 网关 `/ai/**` 下的聊天链路是否稳定

## Root Cause

- 之前知识库中存在哈希向量入库历史数据，切换真实 embedding 后需要重新入库。
- 聊天回答在偶发失败时会静默降级，不利于联调和比赛现场排障。

## Changes

- 重新执行 `ml_intro` 课程知识入库，使用真实 embedding 重建向量数据。
- 重写 `a3-ai-python/app/services/answer_service.py`
  - 清理残留乱码
  - 增加 LLM 失败重试
  - 增加降级日志记录，便于排查偶发问题

## Verification

- `POST http://127.0.0.1:18080/api/v1/admin/knowledge/ml_intro/ingest`
- `POST http://127.0.0.1:18080/api/v1/rag/search`
- `POST http://127.0.0.1:18080/api/v1/chat`
- `POST http://127.0.0.1:18080/api/v1/plan/generate`
- `POST http://127.0.0.1:18080/api/v1/resource/generate`
- `POST http://127.0.0.1:10010/ai/v1/chat`

## Result

- `ml_intro` 已重新入库，Milvus 当前使用真实 embedding。
- 检索 “什么是过拟合” 时，`模型评估与过拟合` 已成为第一命中。
- 本地直连与网关转发下的聊天回答都已返回真实模型生成结果。
- 学习计划和资源生成接口输出正常，可用于 A3 演示链路。
