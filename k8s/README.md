# Kubernetes Prep

This directory provides a minimal Kubernetes starting point for future online deployment.

Current scope:

- Core infrastructure: MySQL, Redis, PostgreSQL, RabbitMQ, MinIO, Etcd, Milvus
- Core app chain: `a3-auth-service`, `a3-learning-service`, `a3-ai-python`, `a3-gateway`
- Optional frontend entry: `a3-student-web`
- Ingress entry routed through `a3-gateway`

## Design choices

- This is a **prep layer**, not a full production platform.
- Service DNS names replace local `127.0.0.1` dependencies through dedicated `k8s` Spring profiles.
- Manifests are intentionally plain YAML and now also expose a `kustomize` entry so they are easy to evolve into Helm later.
- `a3-user-service` and `a3-course-service` are referenced as external/internal dependencies but are **not** deployed here yet.

## Image expectations

Suggested image names:

- `ghcr.io/<your-org>/a3-auth-service:<tag>`
- `ghcr.io/<your-org>/a3-learning-service:<tag>`
- `ghcr.io/<your-org>/a3-ai-python:<tag>`
- `ghcr.io/<your-org>/a3-gateway:<tag>`
- `ghcr.io/<your-org>/a3-student-web:<tag>`

Java services can reuse the repo root [`Dockerfile`](/F:/A3-cnsoftbei/a3-learning-agent-system/Dockerfile).
The AI service and student frontend now also have dedicated Dockerfiles:

- [a3-ai-python/Dockerfile](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-ai-python/Dockerfile)
- [a3-student-react-web/Dockerfile](/F:/A3-cnsoftbei/a3-learning-agent-system/a3-student-react-web/Dockerfile)

## Apply order

Base apply:

```powershell
kubectl apply -k .\k8s
```

Production-style overlay:

```powershell
kubectl apply -k .\k8s\overlays\prod
```

## Structure

- `k8s/`: source manifests and a root kustomization entry
- `k8s/base`: explicit base for overlays
- `k8s/overlays/prod`: production-oriented replicas, resource limits, and ingress host patch

## GitHub Actions

The repo now includes:

- `.github/workflows/build-and-push-images.yml`
- `.github/workflows/deploy-k8s-prod.yml`
- `.github/workflows/k8s-manifest-check.yml`

What they do:

- Build and push `auth / learning / ai / gateway / student-web` images to GHCR
- Deploy the prod overlay through a manual GitHub Actions run
- Render base and prod `kustomize` outputs
- Check that the k8s manifests stay renderable during PRs

Required repository settings for real image publishing:

- `vars.VITE_AI_BASE_URL` optional, defaults to `/ai/api/v1`
- `packages: write` permission on the workflow token

Required secrets/settings for real deployment:

- `secrets.KUBE_CONFIG`: kubeconfig content for the target cluster
- GitHub `production` environment recommended for deployment approval and secret isolation

Manual deployment flow:

1. Run `Build And Push Images` on `main` or a release tag
2. Copy the image tag you want to deploy, such as a `sha-*` tag
3. Run `Deploy K8s Prod`
4. Start with `dry_run=true`, then rerun with `dry_run=false`

## Before real production

- Replace the example secrets in `secrets-template.yaml`
- Switch image tags from `latest` to immutable versions
- Add resource limits tuned to your cluster
- Move storage to your real storage class
- Add user/course service manifests or point to existing services
- Add HTTPS/TLS on the Ingress
- Add CI image build and deployment automation
