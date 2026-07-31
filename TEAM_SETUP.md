# 团队开发环境快速开始

这份说明面向第一次克隆仓库的 Windows 开发者。项目不会提交 `.env`、数据库文件、`node_modules` 或 Python 虚拟环境；初始化脚本会在本机生成它们。

## 1. 安装一次性前置软件

- Git for Windows
- Docker Desktop（使用 Linux containers）
- JDK 17
- Node.js 20 LTS
- Python 3.11 或 3.12

安装后重新打开 PowerShell，确认 Docker Desktop 已启动。

## 2. 克隆并初始化

```powershell
git clone https://github.com/Tim051216/jcc-ability-map-adaptive-agent.git
cd jcc-ability-map-adaptive-agent
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

初始化脚本会：

- 从安全模板生成本地 `.env`，已有配置不会被覆盖；
- 创建 `a3-ai-python/.venv` 并安装 Python 依赖；
- 使用 `package-lock.json` 和 `npm ci` 安装学生端、管理端依赖；
- 检查 Git、Docker、Java、Node 与 Python 是否可用。

## 3. 一键启动

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-full-local.ps1
```

第一次启动需要下载 Docker 镜像和 Maven 依赖，耗时取决于网络。脚本成功返回后访问：

- 学生端：<http://127.0.0.1:3002>
- 管理端：<http://127.0.0.1:3004>
- AI API 文档：<http://127.0.0.1:18080/docs>

默认配置不包含团队私有大模型密钥，因此页面和本地降级链路可运行，但真实大模型回答需要在 `a3-ai-python/.env` 中配置团队自己的 `LLM_*` 与 `EMBEDDING_*`。不要提交该文件。

## 4. 出现问题时

检查安装与配置：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1
```

启动后检查所有端口：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1 -RequireServices
```

服务日志位于仓库根目录的 `*-live.log`，这些文件已被 Git 忽略。

常用修复：

```powershell
# 依赖或 lock 文件变化后强制重装
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -ForceDependencies

# 仅重建本地配置（会覆盖当前 .env，执行前自行备份密钥）
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -ForceEnv
```

## 5. 团队协作约定

开发前执行 `git pull --rebase`，从 `main` 新建功能分支；不要提交 `.env`、数据库目录、日志、构建产物和个人 IDE 配置。提交 PR 前至少运行：

```powershell
cd a3-student-react-web
npm run lint
npm run build

cd ..\a3-ai-python
.\.venv\Scripts\python.exe -m pytest -q
```

更完整的协作规范见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
