# Minimal Demo Chain

This document describes the smallest realistic demo chain for the current repo when:

- ECS runs only:
  - `a3-gateway`
  - `a3-learning`
  - `a3-ai-python`
  - `a3-student-web`
  - `nginx`
- managed services run in Alibaba Cloud:
  - MySQL
  - PostgreSQL
  - Redis
  - OSS
- `Milvus` is disabled with `MILVUS_ENABLED=false`

## Service dependency summary

### Required for the main demo

- `a3-student-web`
- `nginx`
- `a3-gateway`
- `a3-ai-python`
- `a3-learning`
- PostgreSQL
- Redis
- MySQL
- OSS
- LLM / embedding API

### Optional but recommended only if you need the feature

- `a3-user-service`
  - Used by some profile and tutoring enrichment paths
  - Current Python code already falls back when this service is unavailable
- `a3-resource-service`
  - Needed only if you want gateway routes like `/cs/**` backed by real Java course data
  - Current Python course pages mostly use built-in fixture data instead
- `a3-media-service`
  - Needed for real section play signatures
  - Without it, course playback info degrades gracefully
- `a3-auth-service`
  - Not required for the current demo token flow
  - Python already supports built-in demo bearer tokens like `student-demo`

## What works well in the current minimal chain

- Home / overview
- Learning path generation
- Resource center
- Favorites / collection
- Evaluation and study report
- AI tutor
- Most profile and chat flows

These flows are mainly driven by `a3-ai-python`, `a3-learning`, local fixture course metadata, and external model APIs.

## What degrades in the current minimal chain

### No Milvus

- `/ai/api/v1/rag/search` returns empty hits
- admin knowledge ingest returns `503`
- tutoring and chat still work, but without vector retrieval support

### No media service

- section play signature requests can fail
- course detail pages still open, but playback may show unavailable state

### No user service

- user profile enrichment uses fallback payloads
- chat / profile generation still work, but with less real user context

### No resource service

- gateway `/cs/**` routes are not backed by a real Java course center
- current student demo is still mostly okay because Python course fixtures already cover overview and learning pages

## Recommended demo pages

For the most stable contest demo, prioritize:

1. `/`
2. `/path`
3. `/resources?courseId=401`
4. `/evaluation?courseId=401`
5. `/report?courseId=401`
6. `/tutor?courseId=401&courseCode=software_engineering_4th`

## Pages with higher integration risk

- `/learn`
  - Depends on lesson progress and media playback integration
  - Can still render, but playback/signature behavior is more fragile without extra Java services

## Recommended deployment decision

For the first ECS launch:

- Keep `MILVUS_ENABLED=false`
- Do not promise live RAG retrieval in the demo
- Use AI tutor, learning path, resource generation, evaluation, and study report as the main story
- Treat media playback as optional unless you also deploy the media-related Java chain
