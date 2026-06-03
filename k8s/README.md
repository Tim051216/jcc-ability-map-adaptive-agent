# Kubernetes 预备说明

本目录提供了一套用于后续上线的最小 Kubernetes 起步配置。

当前覆盖范围：

- 核心基础设施：MySQL、Redis、PostgreSQL、RabbitMQ、MinIO、Etcd、Milvus
- 核心应用链路：`a3-auth-service`、`a3-learning-service`、`a3-ai-python`、`a3-gateway`
- 可选前端入口：`a3-student-web`
- 统一通过 `a3-gateway` 暴露 Ingress 入口

## 设计原则

- 这是一层`上线预备配置`，不是完整的生产平台方案。
- 通过专门的 `k8s` Spring Profile，把本地 `127.0.0.1` 依赖替换为集群内服务 DNS。
- 清单暂时保持为普通 YAML，并补充了 `kustomize` 入口，方便后续平滑演进到 Helm。
- `a3-user-service` 和 `a3-course-service` 目前仍作为外部或内部依赖被引用，但暂未在此目录中部署。

## 镜像约定

建议使用以下镜像命名：

- `ghcr.io/<your-org>/a3-auth-service:<tag>`
- `ghcr.io/<your-org>/a3-learning-service:<tag>`
- `ghcr.io/<your-org>/a3-ai-python:<tag>`
- `ghcr.io/<your-org>/a3-gateway:<tag>`
- `ghcr.io/<your-org>/a3-student-web:<tag>`

Java 服务可复用仓库根目录的 [Dockerfile](/F:/A3-cnsoftbei/a3-learning-agent-system/Dockerfile)。
AI 服务和学生端前端分别使用各自的 Dockerfile：

- [a3-ai-python/Dockerfile](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/Dockerfile)
- [a3-student-react-web/Dockerfile](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-student-react-web/Dockerfile)

## 应用方式

基础清单：

```powershell
kubectl apply -k .\k8s
```

生产风格覆盖层：

```powershell
kubectl apply -k .\k8s\overlays\prod
```

## 目录结构

- `k8s/`：源清单与根级 `kustomization` 入口
- `k8s/base`：供覆盖层复用的基础配置
- `k8s/overlays/prod`：偏生产环境的副本数、资源限制和 Ingress Host 补丁

## GitHub Actions

仓库当前包含：

- `.github/workflows/build-and-push-images.yml`
- `.github/workflows/deploy-k8s-prod.yml`
- `.github/workflows/k8s-manifest-check.yml`

这些工作流主要负责：

- 构建并推送 `auth / learning / ai / gateway / student-web` 镜像到 GHCR
- 通过手动触发的 GitHub Actions 部署 prod overlay
- 渲染 base 与 prod 两套 `kustomize` 输出
- 在 PR 阶段检查 k8s 清单是否仍可正常渲染

真实推送镜像前，建议至少确认：

- `vars.VITE_AI_BASE_URL` 可选，默认值为 `/ai/api/v1`
- 工作流令牌具备 `packages: write` 权限

真实部署前，建议至少配置：

- `secrets.KUBE_CONFIG`：目标集群的 kubeconfig 内容
- GitHub `production` 环境：用于部署审批和密钥隔离

手动部署流程建议为：

1. 在 `main` 或发布标签上执行 `Build And Push Images`
2. 记录本次准备部署的镜像标签，例如 `sha-*`
3. 执行 `Deploy K8s Prod`
4. 先以 `dry_run=true` 验证，再使用 `dry_run=false` 正式部署

## 正式上线前仍需补齐

- 替换 `secrets-template.yaml` 中的示例密钥
- 将镜像标签从 `latest` 切换为不可变版本
- 根据集群实际容量补充资源限制
- 将存储调整为真实可用的 StorageClass
- 补充 user/course 服务清单，或改为接入现有服务
- 为 Ingress 增加 HTTPS/TLS
- 持续完善 CI 镜像构建与部署自动化
