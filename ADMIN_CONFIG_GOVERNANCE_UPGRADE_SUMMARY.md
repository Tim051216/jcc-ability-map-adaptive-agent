# 管理端配置治理增强总结

## Problem
- 系统配置页缺少敏感项聚焦能力，历史记录只能看原始载荷，不方便直接说明配置变更前后差异。
- 管理总览页虽然有配置入口，但看不到最近配置治理动作和关键责任人。

## Root Cause
- 配置接口和页面只覆盖了基础列表/保存能力，缺少治理视角的筛选、摘要和联动展示。
- 总览页没有接入配置历史数据，也没有把审计动作转换成更易读的中文文案。

## Changes
- 后端 `GET /v1/admin/configs` 新增 `sensitive_only` 过滤支持。
- 前端配置页新增：
  - 配置列表“仅敏感”筛选
  - 历史记录“仅敏感”本地筛选
  - 变更前后值分栏展示
  - 敏感值脱敏提示
  - 历史详情抽屉
- 前端管理总览新增：
  - 配置治理概览卡片
  - 最近变更人 / 最近变更时间 / 敏感配置数
  - 最近配置变更列表
  - 审计场景与动作中文化展示

## Verification
- `npm run build`
- `F:\A3-cnsoftbei\a3-learning-agent-system\a3-ai-python\.venv\Scripts\python.exe -m pytest app\tests\test_admin_api.py app\tests\test_admin_service.py app\tests\test_admin_export_service.py`
- 浏览器校验：
  - `#/main/ai-admin` 可见“配置治理概览”“最近变更人”
  - `#/main/ai-admin-configs` 可见“仅敏感”“旧值”“新值”
