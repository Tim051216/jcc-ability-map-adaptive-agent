# ECS Deployment Prep

This directory is the lightweight ECS deployment track for the current A3 repo.

Target shape:

- `a3-learning` on ECS
- `a3-gateway` on ECS
- `a3-ai-python` on ECS
- `a3-student-web` on ECS
- `nginx` on ECS as the public entry
- MySQL / Redis / PostgreSQL / OSS managed outside ECS

## What is included

- `docker-compose.yml`: single-machine ECS deployment
- `nginx.conf`: reverse proxy for the student web and API routes
- `env/*.example`: sanitized environment templates
- `env/*.minimal.env.example`: shortest first-demo env templates
- `a3-learning` and `a3-gateway` production Spring profiles
- Dockerfiles for `a3-learning` and `a3-gateway`
- `MINIMAL_DEMO_CHAIN.md`: which pages/features are safe in the first low-cost ECS release

## Before first deploy

1. For the shortest first-demo setup, copy the minimal env files:

```powershell
Copy-Item .\deploy\ecs\env\ai.minimal.env.example .\deploy\ecs\env\ai.env
Copy-Item .\deploy\ecs\env\learning.minimal.env.example .\deploy\ecs\env\learning.env
Copy-Item .\deploy\ecs\env\gateway.minimal.env.example .\deploy\ecs\env\gateway.env
```

If you prefer the fuller templates, you can still use the regular `*.env.example` files instead.

2. Fill only the real values that block first boot:

```powershell
notepad .\deploy\ecs\env\ai.env
notepad .\deploy\ecs\env\learning.env
notepad .\deploy\ecs\env\gateway.env
```

Required values for first boot:

- MySQL / PostgreSQL / Redis endpoints
- OSS credentials and bucket
- LLM / embedding credentials
- `JAVA_INTERNAL_TOKEN`

3. Build and start:

```powershell
cd .\deploy\ecs
docker compose up -d --build
```

## Important limitations right now

- This ECS track supports `MILVUS_ENABLED=false`.
- In that mode, RAG search and knowledge ingest are intentionally degraded:
  - `/ai/api/v1/rag/search` returns empty hits
  - admin knowledge ingest returns `503`
  - chat and tutoring flows still run, but without vector retrieval support
- `a3-learning` and `a3-gateway` still reference optional upstream services such as `auth-service`, `user-service`, and `course-service` for some routes. If those routes are needed in your demo, you must either:
  - deploy those services too, or
  - adjust the route/auth scope before the final release.

## Suggested public entry

- `http://<ecs-ip>/` -> student web
- `http://<ecs-ip>/ai/...` -> gateway -> ai-python
- `http://<ecs-ip>/ls/...` -> gateway -> learning

## Suggested next step

After this repo prep is merged, create a clean GitHub push with no real secrets and then do the first ECS dry run from this directory.
