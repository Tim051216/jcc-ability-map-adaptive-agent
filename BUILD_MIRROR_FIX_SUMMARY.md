# Maven 镜像修复说明

## problem
- 整仓执行 `mvn -q -DskipTests compile` 时，`a3-media` 依赖链偶发解析失败。
- 失败点表现为 `alimaven` 拉取 `org.jacoco:org.jacoco.build:0.8.7` 不稳定。

## root cause
- Maven 安装级全局配置将 `central` 映射到了 `http://maven.aliyun.com/...`。
- 该 HTTP 镜像源稳定性较差，导致中央仓库依赖校验/拉取偶发失败。

## changes
- 新增用户级 Maven 配置 `C:\Users\Administrator\.m2\settings.xml`，先在当前机器上恢复稳定构建。
- 为仓库生成 `mvnw`、`mvnw.cmd` 和 `.mvn/wrapper/*`，让其他机器不依赖本机 Maven 安装方式。
- 新增项目级 `.mvn/settings.xml` 与 `.mvn/maven.config`，让 `mvnw` 默认优先使用官方 `https://repo.maven.apache.org/maven2`。
- 保留原本本地仓库路径 `D:\develop\apache-maven-3.9.4\mvn_repo`，避免重复下载。

## verification
- `mvn help:effective-settings -DshowPasswords=false`
- `mvn -U -q -DskipTests compile`
- `mvnw.cmd -q -DskipTests compile`
