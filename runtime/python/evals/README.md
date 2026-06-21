# Yanshi eval harness (deterministic)

Golden-set agent-quality regression baseline.

- `cases.jsonl` — golden tasks + deterministic `expect` checks.
- `scorer.py` — pure deterministic scorer (unit-tested in CI).
- `run_evals.py` — runs each case through the real runtime against your CONFIGURED provider.

Run (needs a configured provider; costs provider tokens — NOT run in CI):

    uv run --project runtime/python python -m evals.run_evals

It prints a per-case PASS/FAIL report + pass rate, writes `evals/last_report.json`
(gitignored), and exits non-zero if any case fails or no provider is configured.

## Case format (`cases.jsonl`, one JSON object per line)

```json
{"id": "math_basic", "task": "What is 2+2? Reply with just the number.",
 "expect": {"completed": true, "contains": ["4"]}}
```

A case **passes only if every `expect` check it lists holds** (omit a key to skip that
check). All matching is deterministic — failure is decided by run `status`, never by
guessing from the answer text.

| `expect` key | Type | Check |
| --- | --- | --- |
| `completed` | bool | run `status == "completed"` equals this value |
| `contains` | list[str] | each substring is in `resultSummary` (case-insensitive) |
| `regex` | str | `re.search(regex, resultSummary)` matches |
| `agentUsed` | str | this **prefixed agent id** ran a task — e.g. `"agent_terminal"` |
| `toolUsed` | str | this **bare tool role** ran — e.g. `"terminal"` (one of browser/computer/terminal/file) |

- `id` and `task` are required; `projectId` is optional (default: standalone).
- `contains`/`regex` match against the run's final answer (`resultSummary`), not the raw
  transcript. A completed run with an empty summary fails those checks.
- Note the convention difference: `agentUsed` takes the `agent_`-prefixed id, while
  `toolUsed` takes the bare role name.
- Keep cases stable (prefer loose, deterministic answers) to avoid flaky results.
