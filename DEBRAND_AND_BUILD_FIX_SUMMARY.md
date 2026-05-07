# 去原项目化与编译修复说明

## problem
- 深度去原项目化后，`a3-common` 编译失败，导致 `a3-learning` 联编中断。
- 仓库内还残留少量原项目标识，主要是测试包名和注释。

## root cause
- 根 `pom.xml` 仅在 `pluginManagement` 中声明了 `maven-compiler-plugin`，Lombok 注解处理器没有真正生效。
- `A3TemporalConverter` 的类名与文件名不一致。
- `a3-learning` 测试代码仍保留在旧测试包下，并带有旧项目注释。

## changes
- 在根 `pom.xml` 中正式启用 `maven-compiler-plugin`，补齐 Lombok 注解处理器生效链路。
- 将 `a3-common` 的 `TjTemporalConverter.java` 重命名为 `A3TemporalConverter.java`。
- 将 `a3-learning` 测试包迁移到统一的 A3 包命名下。
- 清理 `MPTest` 中残留的旧项目注释。
- 复查源码与配置，排除 `target` 目录后未再发现 `com.tianji`、`tj-*`、`tj.`、`天机` 等残留标识。

## verification
- `mvn -q -pl a3-learning -am -DskipTests compile`
- `mvn -q -pl a3-learning -am test-compile`
- 源码扫描无残留原项目标识
- `mvn -q -DskipTests compile` 失败于外部依赖镜像解析：`a3-media` 拉取 `org.jacoco:org.jacoco.build:0.8.7` 时被 `alimaven` 仓库阻塞，属于环境依赖问题，不是本次改名改包导致
