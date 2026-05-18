# GitHub Push Checklist

Use this checklist before pushing the repo to GitHub.

## Secrets

- Rotate any cloud credentials that were ever committed locally.
- Do not push local `.env` files.
- Do not push filled `deploy/ecs/env/*.env` files.
- Keep only sanitized `*.example` templates in git.

## Files to verify

- `a3-message/a3-message-service/src/main/resources/bootstrap.yml`
- `a3-media/src/main/resources/bootstrap.yml`
- `a3-ai-python/.env`
- `deploy/ecs/env/*.env`

## Recommended checks

```powershell
git status --short
rg -n "(sk-|LTAI|AKIA|accessSecret|secretKey|PASSWORD=|API_KEY=)" .
```

## What should be in GitHub

- source code
- Dockerfiles
- `deploy/ecs/`
- sanitized env examples
- deployment docs

## What should stay out of GitHub

- real keys
- local logs
- local databases
- `node_modules`
- `.venv`
- generated preview files
