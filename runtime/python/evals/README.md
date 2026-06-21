# Yanshi eval harness (deterministic)

Golden-set agent-quality regression baseline.

- `cases.jsonl` — golden tasks + deterministic `expect` checks.
- `scorer.py` — pure deterministic scorer (unit-tested in CI).
- `run_evals.py` — runs each case through the real runtime against your CONFIGURED provider.

Run (needs a configured provider; costs provider tokens — NOT run in CI):

    uv run --project runtime/python python -m evals.run_evals

It prints a per-case PASS/FAIL report + pass rate, writes `evals/last_report.json`
(gitignored), and exits non-zero if any case fails or no provider is configured.
