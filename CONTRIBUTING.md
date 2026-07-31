# 团队协作规范

## 分支与提交

1. 保持 `main` 始终可构建，不直接在 `main` 上开发。
2. 使用 `feature/<name>`、`fix/<name>` 或 `docs/<name>` 分支。
3. 一个提交只处理一个清晰问题，提交信息使用 `feat:`、`fix:`、`test:`、`docs:`、`chore:` 前缀。
4. 通过 Pull Request 合并，并等待 GitHub Actions 检查通过。

## 配置与密钥

- 只提交 `.env.example` 或 `.env.local.example`，不提交真实 `.env`。
- 不把 API Key、数据库密码、Cookie、Token 写进源码、截图、日志或测试数据。
- 新增必需环境变量时，同步修改配置模板和 `TEAM_SETUP.md`。

## 依赖变更

- 前端依赖变更必须同时提交对应的 `package-lock.json`，团队统一使用 `npm ci`。
- Python 依赖统一声明在 `a3-ai-python/pyproject.toml`。
- Java 依赖通过 Maven `pom.xml` 管理，禁止提交 `target/` 和本地 Maven 缓存。

## 提交前检查

按改动范围运行对应检查：

```powershell
# 本地环境
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1

# 学生端和管理端
cd a3-student-react-web
npm run lint
npm run build
cd ..\a3-admin-web
npm run lint
npm run build

# AI 服务
cd ..\a3-ai-python
.\.venv\Scripts\python.exe -m pytest -q

# Java 核心模块
cd ..
.\mvnw.cmd -pl a3-learning,a3-gateway -am test
```

## 数据库变更

- Python 数据结构变更必须新增 Alembic migration，不能修改已经共享的历史 migration。
- Java/MySQL 初始化结构变化需同步更新 `sql/` 下对应脚本，并保证 `scripts/init-mysql.ps1` 可重复执行。
- 不提交 Docker 数据卷目录；测试数据应使用可审查、可重复执行的 seed 脚本。
