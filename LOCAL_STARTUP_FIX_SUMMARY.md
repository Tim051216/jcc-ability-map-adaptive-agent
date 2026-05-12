# 本地启动修复总结

## 问题

- 仓库原本缺少可直接使用的 `tj_learning` 初始化脚本。
- `a3-learning` 本地启动依赖外部 Nacos 配置，缺少本地数据库与 Redis 配置。
- 启动过程中还暴露出线程池参数错误，以及 `springfox` 与当前 Spring Boot 路径匹配策略不兼容的问题。

## 根因

- 上游公开项目把 `tj_learning` 的真实表结构分散在课件 SQL 中，根目录 `sql/tj_learning.sql` 为空。
- 当前仓库没有内置本地依赖环境与初始化入口。
- `LearningRecordDelayTaskHandler` 的线程池构造参数写反了。
- `springfox 3.0.0` 在当前环境下需要显式切回 `ant_path_matcher`。

## 修改

- 新增 `sql/tj_learning.sql` 合并版，并补充 `sql/README.md`。
- 新增 `scripts/normalize-sql.ps1`，将多份上游 SQL 整理为可直接导入的 schema-first 版本。
- 新增 `docker-compose.local.yml`，提供本地 MySQL/Redis。
- 在 `docker-compose.local.yml` 中补充本地 RabbitMQ。
- 新增 `scripts/init-mysql.ps1`，默认初始化 `tj_learning`。
- 新增 `a3-learning/src/main/resources/application-local.yml`，补齐本地 `datasource`、`redis` 和 `pathmatch` 配置。
- 在 `application-local.yml` 中补齐本地 `rabbitmq` 配置。
- 修复 `a3-learning/src/main/java/com/cnsoftbei/a3/learning/utils/LearningRecordDelayTaskHandler.java` 中线程池参数。
- 新增 `LOCAL_SETUP.md` 和重写 `OPEN_SOURCE_NOTICE.md`。

## 验证

- `docker compose -f docker-compose.local.yml up -d`
- `docker compose -f docker-compose.local.yml up -d rabbitmq`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1`
- `docker exec a3-mysql mysql -uroot -pa3mysql123 -e "SHOW TABLES FROM tj_learning;"`
- `mvnw.cmd -f a3-learning\pom.xml -DskipTests spring-boot:run -Dspring-boot.run.profiles=local`
- `http://127.0.0.1:8090/doc.html` 返回 `200`
- 当前 `local` 配置已可直接生效，不再依赖额外的 `-Dspring.cloud.*=false` JVM 参数。
