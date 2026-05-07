# 项目构建说明

## 推荐方式
- Windows：`mvnw.cmd -DskipTests compile`
- Linux/macOS：`./mvnw -DskipTests compile`

## 说明
- 仓库已自带 Maven Wrapper：`mvnw`、`mvnw.cmd`
- 仓库已自带项目级 Maven 配置：`.mvn/settings.xml`
- 使用 `mvnw` 时，会优先走项目内配置的官方 `https` Maven Central`
- 这样即使不同开发者本机 Maven 镜像配置不同，也能尽量保持一致的构建行为

## 备选方式
- 如果必须使用本机 Maven，可执行：`mvn -s .mvn/settings.xml -DskipTests compile`
