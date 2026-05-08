# AI Model Provider Setup

## Goal

将 `a3-ai-python` 从示例地址切换到真实可用的 LLM 与 Embedding 服务，并验证：

- `GET /api/v1/admin/llm/ping`
- `GET /api/v1/admin/embedding/ping`
- `POST /api/v1/rag/search`
- `POST /api/v1/chat`

## 1. 配置位置

编辑文件：

- `a3-ai-python/.env`

## 2. LLM 配置

当前代码支持 OpenAI 兼容的 `chat/completions` 协议。

示例：

```env
LLM_PROVIDER=openai_compat
LLM_MODEL=your-chat-model
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://your-provider.example.com/v1
LLM_TIMEOUT_SECONDS=30
```

如果你的服务是讯飞或其他厂商，但网关兼容 OpenAI 协议，也可以继续使用：

```env
LLM_PROVIDER=xfyun
```

当前实现里 `xfyun` 会复用同一套 OpenAI 兼容调用逻辑。

## 3. Embedding 配置

当前代码支持 OpenAI 兼容的 `embeddings` 协议。

示例：

```env
EMBEDDING_PROVIDER=openai_compat
EMBEDDING_MODEL=your-embedding-model
EMBEDDING_API_KEY=your-api-key
EMBEDDING_BASE_URL=https://your-provider.example.com/v1
EMBEDDING_TIMEOUT_SECONDS=30
```

## 4. Milvus 维度必须一致

`MILVUS_DIMENSION` 必须与真实 embedding 模型输出维度一致。

例如：

- 如果 embedding 模型输出 `1024` 维，则 `MILVUS_DIMENSION=1024`
- 如果 embedding 模型输出 `1536` 维，则 `MILVUS_DIMENSION=1536`

如果维度不一致：

- `GET /api/v1/admin/embedding/ping` 会返回 `unavailable`
- 入库/检索会退回本地哈希向量，不会真正用上远程 embedding

## 5. 切换后建议执行

如果你修改了 `MILVUS_DIMENSION` 或真实 embedding 模型：

1. 重启 `a3-ai-python`
2. 重新执行知识入库

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:18080/api/v1/admin/knowledge/ml_intro/ingest
```

## 6. 验证命令

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:18080/api/v1/admin/embedding/ping
```

通过网关验证：

```powershell
Invoke-RestMethod -Method Get http://127.0.0.1:10010/ai/v1/admin/llm/ping
Invoke-RestMethod -Method Get http://127.0.0.1:10010/ai/v1/admin/embedding/ping
```
