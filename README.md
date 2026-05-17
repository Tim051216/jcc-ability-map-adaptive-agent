# A3 个性化学习多智能体系统

## 项目定位

本项目面向第十五届中国软件杯 A3 赛题《基于大模型的个性化资源生成与学习多智能体系统开发》，在原有在线学习微服务工程基础上完成赛题化改造与 AI 能力扩展。

当前仓库不是“单一技术栈的全新项目”，而是由三部分共同组成：

- `a3-learning` 为本地可独立启动的 Java 学习服务，承载学习路径、学习进度、测评、错题、A3 演示骨架接口等能力
- `a3-ai-python` 为 Python AI 中台，承载画像、问答、RAG、学习计划、资源生成、智能辅导、后台运营摘要等能力
- `a3-student-react-web` 为当前唯一学生端前端，默认本地端口 `3002`
- `a3-portal-web` 为 legacy 学生端前端，仅保留作历史代码参考
- `a3-admin-web` 为当前唯一管理端前端

## 当前建议口径

答辩或演示时，建议明确区分两类能力：

- `稳定本地链路`
  Java 学习服务、学习路径、测评、错题、学生端基础页面、A3 演示骨架接口
- `AI 真链路能力`
  Python AI 服务、RAG 检索、智能问答、学习画像、学习计划、资源生成、智能辅导、后台摘要接口

这样可以避免把“启发式演示骨架”与“真实 AI 调用链”混成同一层口径。

## 目录说明

- `a3-gateway`：Java 网关，默认本地端口 `10010`
- `a3-learning`：Java 学习服务，默认本地端口 `8090`
- `a3-ai-python`：Python AI 服务，默认本地端口 `18080`
- `a3-student-react-web`：学生端前端，默认本地端口 `3002`
- `a3-portal-web`：legacy 学生端前端，不再作为默认入口
- `a3-admin-web`：管理端前端，默认本地端口 `3004`
- `sql/`：MySQL 初始化脚本、A3 扩展 SQL、验证脚本
- `scripts/`：本地启动、数据库初始化、演示验证脚本

## 当前可稳定演示的功能

- 学生端首页、课程列表/详情、学习页基础链路
- Java 学习服务的学习路径接口
- Java 学习服务的测评、报告、错题链路
- `a3-learning` 中的 `/a3/agent-demo/**` 演示骨架接口
- Python AI 服务的学习画像、学习计划、资源生成接口
- Python AI 服务的 RAG 检索、智能问答、知识入库接口
- Python AI 服务的智能辅导、OCR 预览、答疑历史接口
- 管理侧后台摘要、审核、日志、配置、用户状态等接口

详细演示动线见 [A3_DEMO_RUNBOOK.md](/F:/A3-cnsoftbei/a3-learning-agent-system/A3_DEMO_RUNBOOK.md)。

## 快速启动入口

首次接手项目时，建议按下面顺序：

1. 启动依赖容器：`docker compose -f .\docker-compose.local.yml up -d`
2. 初始化 MySQL：`powershell -ExecutionPolicy Bypass -File .\scripts\init-mysql.ps1`
3. 启动 Java 学习服务：`.\mvnw.cmd -f .\a3-learning\pom.xml -DskipTests spring-boot:run "-Dspring-boot.run.profiles=local"`
4. 启动 Java 网关：`powershell -ExecutionPolicy Bypass -File .\scripts\start-gateway-local.ps1`
5. 启动 Python AI 服务：`powershell -ExecutionPolicy Bypass -File .\scripts\start-ai-local.ps1`
6. 启动学生端/管理端前端

完整步骤见 [LOCAL_SETUP.md](/F:/A3-cnsoftbei/a3-learning-agent-system/LOCAL_SETUP.md)。

## 本地默认端口

- MySQL：`127.0.0.1:13306`
- Redis：`127.0.0.1:16379`
- RabbitMQ：`127.0.0.1:5672`
- RabbitMQ 管理台：`http://127.0.0.1:15672`
- PostgreSQL：`127.0.0.1:15432`
- MinIO API：`http://127.0.0.1:19000`
- MinIO Console：`http://127.0.0.1:19001`
- Milvus：`127.0.0.1:19530`
- Java 网关：`http://127.0.0.1:10010`
- Java 学习服务：`http://127.0.0.1:8090`
- Python AI 服务：`http://127.0.0.1:18080`
- 管理端前端：`http://127.0.0.1:3004`
- 学生端前端：`http://127.0.0.1:3002`

## 文档索引

- [LOCAL_SETUP.md](/F:/A3-cnsoftbei/a3-learning-agent-system/LOCAL_SETUP.md)：本地启动与依赖说明
- [A3_DEMO_RUNBOOK.md](/F:/A3-cnsoftbei/a3-learning-agent-system/A3_DEMO_RUNBOOK.md)：答辩演示顺序、检查项与兜底方案
- [A3_DEMO_API.md](/F:/A3-cnsoftbei/a3-learning-agent-system/A3_DEMO_API.md)：当前推荐演示接口与调用口径
- [A3_ARCHITECTURE.md](/F:/A3-cnsoftbei/a3-learning-agent-system/A3_ARCHITECTURE.md)：Java + Python + 前端的当前架构映射
- [A3_DELIVERY_STATUS.md](/F:/A3-cnsoftbei/a3-learning-agent-system/A3_DELIVERY_STATUS.md)：稳定功能、高风险点、未验证项
- [sql/README.md](/F:/A3-cnsoftbei/a3-learning-agent-system/sql/README.md)：数据库初始化说明

## 开源引用说明

当前版本是在开源在线学习项目基础上进行二次分析、重构与赛题化改造。提交最终作品时，建议同步附带：

- 原项目名称与来源地址
- 采用的开源协议
- 团队自主开发与改造部分说明

详细说明见 [OPEN_SOURCE_NOTICE.md](/F:/A3-cnsoftbei/a3-learning-agent-system/OPEN_SOURCE_NOTICE.md)。
