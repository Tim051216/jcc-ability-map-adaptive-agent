# 课程浏览链路接线总结

## Problem

学生端课程列表、推荐、搜索、详情与目录页面仍大量依赖前端本地 demo 数据，本地 A3 模式下缺少可稳定联调的后端课程浏览接口。

## Root Cause

- `a3-ai-python` 里尚未提供课程分类、推荐、搜索、详情、导师、目录等浏览接口。
- `a3-portal-web` 在 `a3local` 模式下仍优先走前端 demo 数据，导致课程浏览链路无法真正验证前后端联调。
- 本地 `18080` 之前跑的是旧的 Anaconda 版 uvicorn，未加载本轮新增路由。

## Changes

- 新增后端课程接口：
  - `a3-ai-python/app/api/v1/course.py`
  - `a3-ai-python/app/services/course_service.py`
  - `a3-ai-python/app/schemas/course.py`
- 在 `a3-ai-python/app/api/router.py` 挂载 `/api/v1/course` 路由。
- 前端新增 A3 课程 API 封装，并让以下文件在 `a3local` 且非 demo 登录时优先走新后端，失败时仍可保留原有 fallback：
  - `a3-portal-web/src/api/ai.js`
  - `a3-portal-web/src/api/class.js`
  - `a3-portal-web/src/api/classDetails.js`
- 新增接口测试：
  - `a3-ai-python/app/tests/test_course_api.py`
- 停掉旧的 `D:\\Anaconda\\python.exe` uvicorn 进程，切换为 `.venv` 下的本地 AI 服务。

## Verification

- `F:\\A3-cnsoftbei\\a3-learning-agent-system\\a3-ai-python\\.venv\\Scripts\\python.exe -m pytest app\\tests\\test_course_api.py app\\tests\\test_admin_api.py app\\tests\\test_admin_service.py app\\tests\\test_admin_export_service.py`
- `npm run build`
- `http://127.0.0.1:18080/health`
- `http://127.0.0.1:18080/api/v1/course/recommend/free`
- 浏览器验收：
  - `#/classList/index` 已显示真实课程分类与课程卡片
  - `#/details/index?id=101` 已显示课程详情页内容
