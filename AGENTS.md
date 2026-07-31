# A3 Repository Guide for Coding Agents

## First-Clone Startup

When the user asks to install, start, run, verify, or troubleshoot this repository,
read and follow [`AI_START_HERE.md`](./AI_START_HERE.md) before inspecting legacy
or service-specific startup notes. It is the canonical local startup protocol.

On Windows, the normal flow is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-full-local.ps1 -NoOpenPages
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor-local.ps1 -RequireServices
```

Do not bypass version checks, overwrite an existing `.env`, reset databases, or
delete Docker volumes to make startup pass. A successful startup requires the
final service doctor to exit with code `0`.

## Scope

This repository is a multi-service personalized learning system. Keep changes
inside the service that owns the behavior. Do not move shared contracts across
modules without checking their Java, Python, and frontend consumers.

## Main Components

- `a3-ai-python/`: FastAPI service, multi-agent orchestration, RAG, tutoring,
  evaluation, and agent runtime logs.
- `a3-gateway/`: API gateway and external routing.
- `a3-auth/`, `a3-user/`, `a3-learning/`, `a3-resource/`, `a3-assessment/`:
  Spring Boot domain services.
- `a3-student-react-web/`: student-facing React application.
- `a3-admin-web/`: administrator application.
- `harness/`: repeatable agent cases, adapters, evaluations, and traces.
- `k8s/`: Kustomize deployment manifests.

## Verification

Run the narrowest relevant checks first.

```powershell
python -m harness.run
python -m unittest discover -s harness/tests
```

For Python service changes:

```powershell
Set-Location a3-ai-python
python -m pytest app/tests
```

For Java service changes, run Maven from the repository root and select the
affected module with `-pl <module> -am`. For frontend changes, use the package
scripts declared by the affected frontend's `package.json`.

## Agent Harness Rules

- Keep `harness/cases/smoke.jsonl` deterministic and network-free.
- Put model-dependent cases in a separate JSONL file.
- Never write tokens, API keys, passwords, authorization headers, or complete
  private student records to traces.
- Preserve failed traces as CI artifacts when diagnosing regressions.
- Pin the model and prompt version when comparing live evaluation scores.
- Treat a changed score threshold as a behavior change requiring review.

## Safety and Data

- Do not commit `.env` files, generated traces, local databases, runtime logs,
  uploaded student files, or model credentials.
- Do not weaken tutoring safety or hallucination checks to make an evaluation
  pass. Fix the behavior or the case definition.
- Keep authentication enabled outside explicitly local debug workflows.
- Avoid destructive schema or data operations unless the task explicitly
  requires them and a recovery path is documented.

## Change Discipline

- Preserve existing user changes in a dirty worktree.
- Prefer existing service APIs and schemas over parallel implementations.
- Add or update a focused regression case for user-visible agent behavior.
- Update `harness/README.md` when an adapter or case contract changes.
