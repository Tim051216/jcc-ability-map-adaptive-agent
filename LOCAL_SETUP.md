# 本地启动说明

## 1. 启动依赖

```powershell
docker compose -f .\docker-compose.local.yml up -d
```

默认端口：

- MySQL：`127.0.0.1:13306`
- Redis：`127.0.0.1:16379`
- RabbitMQ：`127.0.0.1:5672`
- RabbitMQ 管理台：`http://127.0.0.1:15672`，账号密码均为 `guest`

## 2. 初始化数据库

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1
```

如果你要导入到自己的 MySQL：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1 -DbHost 127.0.0.1 -Port 3306 -User root -Password 你的密码
```

## 3. 启动学习服务

```powershell
.\mvnw.cmd -f .\a3-learning\pom.xml -DskipTests spring-boot:run "-Dspring-boot.run.profiles=local"
```

## 4. 说明

- `a3-learning/src/main/resources/application-local.yml` 已默认指向上面的本地 MySQL 和 Redis。
- 当前导入脚本会初始化 `tj_auth`、`tj_course`、`tj_learning`、`tj_media`、`tj_message`、`tj_pay`、`tj_promotion`、`tj_remark`、`tj_search`、`tj_trade`、`tj_user`、`a3_exam`。
- 当前仓库已补齐 `tj_learning.sql` 合并版，不再依赖去上游课件里手动拼表结构。
- 目前仓库内没有发现 `tj_data` 的业务初始化脚本。

## 5. 启动前端

### 管理端

```powershell
cd .\a3-admin-web
npm install

# 默认走本地网关 http://127.0.0.1:10010
npm run dev

# 如果只想单独查看页面，可切到上游公开测试环境
npm run dev:upstream
```

访问地址：`http://127.0.0.1:18081`

### 用户端

```powershell
cd .\a3-portal-web
npm install

# 默认走本地网关 http://127.0.0.1:10010
npm run dev

# 如果只想单独查看页面，可切到上游公开测试环境
npm run dev:upstream
```

访问地址：`http://127.0.0.1:18082`

### 前端联调说明

- 两个前端已经改为 A3 赛题化名称，并默认通过 Vite 本地代理访问接口。
- `npm run dev` 依赖本地网关 `http://127.0.0.1:10010`，如果网关未启动，页面会显示接口错误提示。
- `npm run dev:upstream` 会尝试转发到上游公开测试环境；如果当前网络无法访问外部测试地址，也会出现接口错误，但前端静态资源和页面框架可以正常启动。
- `a3-portal-web` 已补充本地演示登录兜底：当接口暂不可达时，使用默认测试账号 `18810966208 / 123456` 仍可进入用户端首页做界面演示。
