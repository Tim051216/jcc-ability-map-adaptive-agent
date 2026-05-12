# 数据库初始化说明

## 1. 当前用途

`sql/` 目录同时承载两类内容：

- `基础业务库初始化`
  供 Java 学习服务和原有业务模块本地启动使用
- `A3 扩展与演示数据`
  供学习路径、测评、资源、辅导等 A3 场景验证使用

## 2. 基础初始化文件

`scripts\init-mysql.ps1` 当前会导入：

- `tj_auth.sql`
- `tj_course.sql`
- `tj_learning.sql`
- `tj_media.sql`
- `tj_message.sql`
- `tj_pay.sql`
- `tj_promotion.sql`
- `tj_remark.sql`
- `tj_search.sql`
- `tj_trade.sql`
- `tj_user.sql`
- `a3_exam.sql`

对应数据库：

- `tj_auth`
- `tj_course`
- `tj_learning`
- `tj_media`
- `tj_message`
- `tj_pay`
- `tj_promotion`
- `tj_remark`
- `tj_search`
- `tj_trade`
- `tj_user`
- `a3_exam`

## 3. 快速初始化

先启动 MySQL：

```powershell
docker compose -f .\docker-compose.local.yml up -d mysql
```

再执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1
```

如需自定义连接：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1 -DbHost 127.0.0.1 -Port 3306 -User root -Password 你的密码
```

## 4. A3 演示补充数据

与学习路径/测评演示相关的补充文件主要包括：

- `tj_learning_evaluation_demo.sql`
- `tj_learning_evaluation_demo_ascii.sql`
- `tj_learning_evaluation_init.sql`
- `tj_learning_path.sql`
- `tj_learning_profile.sql`
- `tj_learning_resource.sql`
- `tj_tutoring.sql`

其中：

- `scripts\start-learning-evaluation-local.ps1` 默认会导入 `tj_learning_evaluation_demo_ascii.sql`
- 该脚本适合用于补充测评、报告、错题演示数据

## 5. 辅助校验文件

- `verify_learning_path.sql`
- `test_create_tables.sql`
- `test_data_insertion.sql`
- `validate_syntax.py`
- `test_mysql_execution.py`
- `VERIFICATION_REPORT.md`
- `TASK_COMPLETION_SUMMARY.md`

这些文件更适合作为验证和排查材料，不属于首次启动的必跑步骤。

## 6. 当前注意事项

- `scripts\init-mysql.ps1` 依赖本机可调用 `mysql` 命令
- 当前仓库没有 `tj_data` 初始化脚本
- `tj_learning.sql` 已整理为可直接导入版，不再依赖上游课件零散 SQL 手工拼接
