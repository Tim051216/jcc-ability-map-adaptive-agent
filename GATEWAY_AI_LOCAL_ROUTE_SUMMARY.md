# Gateway AI Local Route Summary

## Problem

- `a3-gateway` 本地默认依赖 Nacos，导致 `/ai/**` 路由虽然已配置，但无法直接作为本地 Python AI 服务的反向代理使用。
- 启动命令也容易误跑到根聚合工程，影响本地联调效率。

## Root Cause

- 网关模块默认沿用注册中心配置，没有专门面向本地联调的 profile。
- Maven Wrapper 需要从仓库根目录执行并显式指定子模块 `pom.xml`。

## Changes

- 新增 `a3-gateway/src/main/resources/application-local.yml`
  - 禁用 Nacos config/discovery
  - 放行 `/ai/**`
  - 补充本地 Redis 连接配置
- 新增本地启动脚本：
  - `scripts/start-gateway-local.ps1`
- 更新 `AI_SERVICE_LOCAL_SETUP.md`
  - 补充网关联调命令
  - 补充已验证的 `/ai/**` 地址

## Verification

- 启动命令：
  - `.\mvnw.cmd -f a3-gateway\pom.xml spring-boot:run -Dspring-boot.run.profiles=local -DskipTests`
- 路由验证：
  - `GET http://127.0.0.1:10010/ai/v1/admin/ping`
  - `POST http://127.0.0.1:10010/ai/v1/rag/search`

## Note

- 当前 `/ai/**` 本地联调链路已打通。
- 鉴权 SDK 仍会周期性尝试发现 `auth-service` 的 JWK 地址；这不影响已放行的 `/ai/**` 路由访问，但如果后续要做完整登录态联调，仍需要补齐注册中心或 auth 服务。
