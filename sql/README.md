# 数据库初始化说明

## 来源

- 上游公开仓库：`https://github.com/shuhongfan/tjxt`
- 说明：上游根目录 `sql/tj_learning.sql` 是空文件，`tj_learning` 的真实表结构分散在课件资料 SQL 中，本仓库已重新整理为可直接导入的合并版。

## 当前收录

- `tj_auth.sql`
- `tj_course.sql`
- `tj_learning.sql`
- `tj_media.sql`
- `tj_message.sql`
- `tj_pay.sql`
- `tj_promotion.sql`
- `tj_search.sql`
- `tj_trade.sql`
- `tj_user.sql`
- `tj_remark.sql`
- `a3_exam.sql`

以上文件均已整理为“可直接导入”的 schema-first 版本：

- 保留建库、建表、索引等关键结构
- 去掉上游因编码异常导致的脏注释和脏初始化数据
- 适合本地启动、联调和继续二次开发

## 快速使用

1. 启动本地依赖：
   `docker compose -f docker-compose.local.yml up -d`
2. 导入数据库：
   `powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1`
3. 如需连接到你自己的 MySQL，可覆盖参数：
   `powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1 -DbHost 127.0.0.1 -Port 3306 -User root -Password 你的密码`

## 说明

- 当前导入脚本会批量初始化当前仓库已整理的业务库。
- 目前仓库里没有发现 `tj_data` 的业务初始化脚本。
- `a3_exam.sql` 来自上游 `tj_exam.sql`，这里按当前项目实际库名改为导入到 `a3_exam`。
