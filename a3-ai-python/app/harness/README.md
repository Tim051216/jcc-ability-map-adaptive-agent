# A3 Runtime Agent Harness

This package closes the loop around the real `TutoringCoordinator` execution
path. It is not a mock agent and does not replace the application services.

## Execution and observability

Every tutoring run creates one root Run ID. The ID propagates through Python
`ContextVar` state into:

- coordinator and agent spans created by `AgentRuntimeLoggingService`;
- LLM completion and streaming spans created by `LLMClient`;
- MCP tool spans and tool outcomes created by `MCPToolRegistry`;
- stream events, final output, guardrail review, and evaluation results.

Business HTTP requests also create a root run in FastAPI middleware and return
its correlation value in the `X-Agent-Run-Id` response header. Direct
`ChatService` learning-graph calls establish their own root run when no HTTP
context exists.

Traces use append-only JSONL with sequence numbers, parent span IDs, elapsed
time, a runtime configuration fingerprint, and secret redaction.

## Evaluate real agents

From `a3-ai-python/`:

```powershell
python -m app.harness.cli eval `
  --cases ..\harness\cases\tutor_regression.jsonl `
  --report .runtime\harness\report.json
```

The command exits non-zero when the required pass rate is not reached. A
baseline report can also block score regression:

```powershell
python -m app.harness.cli eval `
  --cases ..\harness\cases\tutor_regression.jsonl `
  --baseline .runtime\harness\approved-baseline.json `
  --max-score-regression 0.02
```

Case criteria support required and forbidden answer signals, any-of semantic
signal groups, confidence, citations, expected/forbidden tools, LLM call count,
latency, and a minimum weighted score. Guardrail blocking is always a hard
failure when a Guardrail review is available.

## Replay

Replay restores the original input and creates a child run linked with
`parent_run_id`:

```powershell
python -m app.harness.cli replay `
  --trace .runtime\harness\traces\RUN_ID.jsonl
```

Exact output equality is reported but is not required for stochastic models.
The original acceptance criteria are evaluated again when the source run came
from a suite.

## Continuous improvement

Failed executions are appended to `.runtime/harness/failures.jsonl`. Generate a
deduplicated review queue with:

```powershell
python -m app.harness.cli promote `
  --failures .runtime\harness\failures.jsonl `
  --output .runtime\harness\candidate-cases.jsonl
```

Review candidate cases before moving them into a committed suite. Never allow
failed model output to change golden acceptance criteria automatically.

## Privacy and retention

- Local/dev/test runs capture replay content by default.
- Other environments store hashes and sizes for questions, answers, profiles,
  and conversation context by default.
- Set `A3_HARNESS_CAPTURE_CONTENT=true` only where replay data is approved.
- Set `A3_HARNESS_TRACE_DIR` to change the trace location.
- Set `A3_HARNESS_MAX_TRACE_FILES` to change the default 500-file retention.
- Secret-looking fields are always replaced with `[REDACTED]`.
