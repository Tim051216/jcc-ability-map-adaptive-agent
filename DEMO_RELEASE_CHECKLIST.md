# Demo Release Checklist

Use this checklist before the first ECS demo release.

## Environment

- Fastest path:
  - copy `deploy/ecs/env/ai.minimal.env.example` to `deploy/ecs/env/ai.env`
  - copy `deploy/ecs/env/learning.minimal.env.example` to `deploy/ecs/env/learning.env`
  - copy `deploy/ecs/env/gateway.minimal.env.example` to `deploy/ecs/env/gateway.env`
- Fill real values into:
  - `deploy/ecs/env/ai.env`
  - `deploy/ecs/env/learning.env`
  - `deploy/ecs/env/gateway.env`
- Keep `MILVUS_ENABLED=false`
- Confirm PostgreSQL / MySQL / Redis / OSS endpoints are reachable from ECS

## Build

- Run `docker compose up -d --build` from `deploy/ecs`
- Confirm containers stay up after first boot
- Check gateway and AI service health endpoints

## Core demo path

- Open `/`
- Open `/path`
- Generate a learning path
- Open `/resources?courseId=401`
- Generate resources
- Open `/evaluation?courseId=401`
- Generate evaluation questions
- Open `/report?courseId=401`
- Open `/tutor?courseId=401&courseCode=software_engineering_4th`
- Ask one course-name question and one study-advice question

## Expected degraded behavior

- RAG search may return empty hits
- Knowledge ingest should be treated as unavailable
- Video playback signatures may be unavailable if media service is not deployed

## Do not use as the main demo promise

- live Milvus retrieval
- admin knowledge ingest
- full real-media playback
- any route that depends on undeployed Java services
