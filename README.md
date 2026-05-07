# A3 个性化学习多智能体系统

## 项目定位

本项目面向第十五届中国软件杯 A3 赛题《基于大模型的个性化资源生成与学习多智能体系统开发》进行重构与扩展。

当前仓库以在线学习微服务架构为基础，正在逐步演进为面向高校学习场景的多智能体系统，重点围绕以下能力建设：

- 对话式学生画像构建
- 多智能体协同生成学习资源
- 个性化学习路径规划与资源推送
- 学习过程跟踪与效果评估

## 当前改造原则

- 先完成项目对外标识、文档与服务说明的赛题化改造
- 保留现有稳定的模块结构，避免一次性大范围重命名影响可运行性
- 在此基础上逐步补齐学生画像、资源生成、学习路径、多模态内容等核心赛题能力

## 目录说明

- `a3-gateway`：网关服务
- `a3-auth`：认证与权限服务
- `a3-user`：用户中心服务
- `a3-resource`：课程与资源服务
- `a3-learning`：学习过程服务
- `a3-assessment`：题库与测评服务
- `a3-media`：媒资服务
- `a3-recommend`：检索与推荐服务
- `a3-analytics`：数据分析服务

## 开源引用说明

本项目当前版本是在开源在线学习项目基础上进行二次分析、重构与赛题化改造，已对外显标识、项目说明与服务文档进行调整。

使用开源项目、框架或工具时，请在最终提交材料中同步附带以下内容：

- 原项目名称与来源地址
- 采用的开源协议
- 团队自主开发与改造部分说明

详细说明见 [OPEN_SOURCE_NOTICE.md](F:\A3-cnsoftbei\a3-assessment\OPEN_SOURCE_NOTICE.md)。

## 提交前提醒

- 已将 `bootstrap.yml` 中的团队联系人邮箱替换为当前项目邮箱，如需答辩提交请再按团队最终信息确认
- 补充你们最终采用的大模型、智能体框架、知识库方案与部署说明
- 在答辩材料中重点展示画像、资源生成、学习路径与多智能体协作链路

## A3 演示接口

当前已在 `a3-learning` 服务中补充一组赛题演示接口，详细说明见 [A3_DEMO_API.md](F:\A3-cnsoftbei\a3-assessment\A3_DEMO_API.md)。

## A3 架构映射

当前工程与赛题能力之间的模块映射说明见 [A3_ARCHITECTURE.md](F:\A3-cnsoftbei\a3-assessment\A3_ARCHITECTURE.md)。

## 构建方式

- 推荐优先使用 Maven Wrapper，而不是直接使用本机 `mvn`
- Windows：`.\mvnw.cmd -DskipTests compile`
- Linux/macOS：`./mvnw -DskipTests compile`
- 项目内已自带 `.mvn/settings.xml`，`mvnw` 会优先使用官方 `https` Maven Central
- 如果必须使用本机 Maven，建议执行：`mvn -s .mvn/settings.xml -DskipTests compile`

## 为什么推荐 Wrapper

- 可以统一 Maven 版本，减少不同机器的构建差异
- 可以复用项目内仓库配置，降低本机镜像源不一致带来的失败风险
- 新成员拉取仓库后可直接构建，减少环境准备成本
