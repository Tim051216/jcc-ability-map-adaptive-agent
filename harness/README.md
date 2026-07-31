# A3 Agent Harness

The production runtime implementation lives in
`a3-ai-python/app/harness/`. This top-level package remains a dependency-free
HTTP/offline runner for repository smoke checks. Use the runtime package for
real coordinator execution, full spans, Guardrail evaluation, replay, and the
failure-to-candidate workflow.

This directory provides a reproducible Harness Engineering loop for the A3
learning-agent system:

1. A JSONL case file defines a task and deterministic acceptance criteria.
2. `harness.run` executes each task through the offline adapter or an HTTP adapter.
3. Every task emits a redacted JSONL trace for replay and diagnosis.
4. CI fails when a required signal is missing or a forbidden signal appears.

Run the offline smoke suite from the repository root:

```powershell
python -m harness.run
python -m unittest discover -s harness/tests
```

To exercise the real asynchronous A3 tutoring chain:

```powershell
python -m harness.run --adapter a3-tutor --base-url http://127.0.0.1:18080
```

Run the model-dependent tutoring regression suite explicitly:

```powershell
python -m harness.run --adapter a3-tutor --cases harness/cases/tutor_regression.jsonl
```

Use `--token` when the service is not running in local debug mode. The adapter
submits `/api/v1/tutoring/tasks`, polls the task resource, and evaluates the
final `answer_text`.

For another service, the generic HTTP adapter accepts a JSON string response or an object containing one of
`answer`, `response`, `content`, `text`, or `message`. Secrets are redacted
before traces are written. Generated traces belong in `harness/artifacts/` and
are ignored by git.

```powershell
python -m harness.run --adapter http --endpoint http://127.0.0.1:9000/invoke
```

## Case format

Each non-empty line in a case file is a JSON object:

```json
{
  "id": "tutor-explains-io",
  "prompt": "Explain the input and output of this function.",
  "must_contain": ["input", "output"],
  "must_not_contain": ["I cannot help"]
}
```

Keep the smoke suite deterministic. Put model-dependent cases in a separate
file and run them against a pinned model and prompt configuration.
