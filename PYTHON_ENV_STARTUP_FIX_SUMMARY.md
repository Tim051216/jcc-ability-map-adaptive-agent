# Python 启动环境处理摘要

## 问题
- 本地启动 AI 服务时，容易误用 Anaconda Python，导致 `18080` 端口被错误进程占用。

## 根因
- 终端存在 Conda `base` 自动激活习惯，且项目启动命令如果写成裸 `python` 或 `uvicorn`，会依赖系统环境变量解析。

## 变更
- 已将 [a3-ai-python/README.md](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/README.md:54) 的本地启动命令改为显式使用项目 `.venv`
- 系统级 Conda 自动激活配置未保留，避免改动你的全局环境习惯

## 验证
- `cmd /c where python`
- [a3-ai-python/README.md](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/README.md:54) 中确认启动命令已固定为 `.venv`
