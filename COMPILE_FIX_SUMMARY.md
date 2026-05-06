# 编译问题修复说明

## 问题

项目在 JDK 21 环境下执行 `mvn -q -pl tj-learning -am -DskipTests compile` 时失败，报错指向 `JCTree$JCImport` 字段兼容问题。

## 根因

根项目使用的 Lombok 版本较旧，与当前 JDK 21 编译环境兼容性不足，导致注解处理阶段异常。

## 修改

- 将根 `pom.xml` 中的 Lombok 版本升级到 `1.18.36`
- 将 `maven-compiler-plugin` 升级到 `3.11.0`
- 为编译插件显式配置 Lombok 注解处理器

## 验证

- 已执行：`mvn -q -pl tj-learning -am -DskipTests compile`
- 结果：通过
