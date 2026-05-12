# 内容审核链路交付记录

## problem
- 管理端“内容审核”页面只有基础展示，缺少批量审核、历史记录等关键能力。
- 本地 `18080` 端口运行的是旧版后端，`/api/v1/admin/reviews` 等接口未暴露。
- 切到当前后端代码后，审核相关数据表尚未迁移，接口返回 500。

## root_cause
- 前端审核页尚未完成与批量审核、历史接口的联动实现。
- 本地运行进程不是当前仓库版本，导致前端代理命中了旧服务。
- 数据库缺少 `content review / system config / admin user control` 等新增表结构。

## changes
- 重写 `a3-portal-web/src/pages/adminReview/index.vue`，补齐筛选、统计、批量审核、历史抽屉等交互。
- 扩展 `a3-portal-web/src/api/ai.js`，新增审核历史、批量通过、批量驳回接口。
- 将 `18080` 后端切换到当前仓库 `a3-ai-python/.venv` 启动的 `uvicorn` 实例。
- 执行 `alembic upgrade head`，补齐审核与管理后台相关表结构。
- 写入并修正本地审核演示数据，验证页面中文内容正常展示。

## verification
- `npm run build`
- `F:\A3-cnsoftbei\a3-learning-agent-system\a3-ai-python\.venv\Scripts\python.exe -m pytest app\tests\test_admin_api.py`
- `GET http://127.0.0.1:18080/api/v1/admin/reviews`
- 浏览器验收 `http://localhost:18082/#/main/ai-admin-review`
