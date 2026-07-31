# AI 本地启动协议

本文是给代码助手读取的本地启动标准。目标是在一台全新的 Windows 开发机上，从 GitHub 克隆后启动完整项目，并用健康检查证明环境可用。

## 执行边界

- 在仓库根目录执行命令。
- 使用 Windows PowerShell 5.1 或 PowerShell 7。
- 不提交、打印或改写真实 API Key、Token、Cookie 和密码。
- 不覆盖已有 `.env`。除非用户明确同意，不使用 `-ForceEnv`。
- 不删除 Docker 数据卷，不执行数据库重置，不运行 `git reset --hard`。
- 首次启动只使用下面的标准脚本，不自行拼装各服务命令。

## 环境要求

- Git for Windows
- Docker Desktop，切换到 Linux containers 并启动 Docker daemon
- JDK 17
- Node.js 20 或更高版本
- Python 3.12 或更高版本

版本声明同时位于 `.java-version`、`.nvmrc` 和 `.python-version`。

## 标准执行流程

### 1. 确认仓库与环境

```powershell
git status --short
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1
```

如果 doctor 只报告依赖或本地配置尚未生成，继续第 2 步。如果报告 Git、Docker、JDK、Node.js 或 Python 版本不满足要求，先安装对应软件，不要通过修改检查脚本绕过。

### 2. 生成配置并安装依赖

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

该脚本会保留已有配置，创建安全的本地 `.env`，创建 Python `.venv`，并对两个前端执行 `npm ci`。重复执行是允许的。

### 3. 启动完整项目

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-full-local.ps1 -NoOpenPages
```

该脚本负责启动 Docker 依赖、等待 MySQL 真正就绪、导入数据库、启动 Java 学习服务、Python AI 服务、网关、学生端和管理端。不要同时重复启动相同端口的服务。

### 4. 验证结果

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1 -RequireServices
```

成功标准：命令退出码为 `0`，并且以下地址可访问：

- 学生端：<http://127.0.0.1:3002>
- 管理端：<http://127.0.0.1:3004>
- 网关：<http://127.0.0.1:10010>
- 学习服务：<http://127.0.0.1:8090>
- AI API 文档：<http://127.0.0.1:18080/docs>
- Milvus 健康检查：<http://127.0.0.1:19091/healthz>

## AI 应如何处理失败

1. 保留失败命令、退出码和最后 50 行相关日志。
2. 先运行 `scripts/doctor-local.ps1 -RequireServices` 定位缺失的运行时或端口。
3. 查看仓库根目录对应的 `*-live.log` 和 `*-live.err.log`。
4. 依赖锁文件变化时，运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -ForceDependencies
```

5. 端口被占用时，先识别占用进程及其来源；不得直接结束不属于本项目的进程。
6. Docker 服务异常时，先确认 Docker Desktop 已启动，再运行 `docker compose -f .\docker-compose.local.yml ps`。
7. 修复后重新执行标准启动与验证，不以“某个进程存在”代替健康检查。

## 大模型密钥

安全模板不会包含团队私有密钥，因此不配置密钥也能启动页面、数据库、检索基础设施和本地降级链路。真实大模型与 Embedding 调用需要团队成员通过安全渠道取得配置，并写入本机 `a3-ai-python/.env` 中的 `LLM_*`、`EMBEDDING_*` 等变量。

任何 AI 都不得把该文件、密钥值或带认证信息的日志提交到 Git。

## 进一步资料

- 团队首次安装：[TEAM_SETUP.md](./TEAM_SETUP.md)
- 详细手动排障：[LOCAL_SETUP.md](./LOCAL_SETUP.md)
- 协作规范：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 模块与测试规则：[AGENTS.md](./AGENTS.md)
