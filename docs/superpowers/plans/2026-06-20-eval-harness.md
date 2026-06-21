# Eval / Golden-set Harness (deterministic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic agent-quality regression harness: a golden-set of tasks + a pure scorer (unit-tested in CI) + a manual runner that executes each case through the real synchronous runtime against the configured provider.

**Architecture:** `runtime/python/evals/` holds the golden-set (`cases.jsonl`), a pure `scorer.py` (no IO), and `run_evals.py` (drives runs, gathers results, scores, reports). The scorer is unit-tested in CI; the runner is manual (needs a configured provider + tokens) and exits honestly when no provider is configured — that honest-exit path is itself CI-tested.

**Tech Stack:** Python 3.12 stdlib + FastAPI `TestClient` (in-process, no network), pytest. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-20-eval-harness-design.md`.
- **Deterministic scoring only.** A case passes iff ALL provided `expect` checks hold: `completed` (status == "completed"), every `contains` substring present (case-insensitive), `regex` matches (`re.search`), `agentUsed`/`toolUsed` present in the run's recorded set. Failure is decided by `status`, never by keyword-guessing the answer.
- **No faked scores.** If the provider is not configured, the runner reports that and exits non-zero — it does NOT run cases or invent results.
- **The eval RUN never runs in CI** (no provider/tokens). Only the scorer + the runner's no-provider path are unit-tested in CI.
- The scorer is a **pure function** (no IO, no globals). The runner reuses the existing synchronous-runtime setup: `create_app(RuntimeSettings(data_dir=…, runtime_version="eval", synchronous_runs=True, api_token="eval-token"))` + `TestClient` with the bearer header (mirrors `make_client` in `tests/test_runtime.py`).
- Real storage class `Storage(database_path, runtime_version)`. pytest: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider`.
- Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `evals/` package — scorer + golden-set (CI-tested core)

**Files:**
- Create: `runtime/python/evals/__init__.py` (empty)
- Create: `runtime/python/evals/scorer.py`
- Create: `runtime/python/evals/cases.jsonl`
- Create: `runtime/python/evals/README.md`
- Modify: `runtime/python/pyproject.toml` (`[tool.pytest.ini_options]` → `pythonpath = ["."]` so `import evals.scorer` works in tests)
- Modify: `.gitignore` (ignore `runtime/python/evals/last_report.json`)
- Test: `runtime/python/tests/test_eval_scorer.py`

**Interfaces:**
- Produces:
  - `evals.scorer.RunResult(status: str, result_summary: str, agents_used: list[str] = [], tools_used: list[str] = [])` (dataclass)
  - `evals.scorer.CaseResult(case_id: str, passed: bool, reasons: list[str] = [])` (dataclass)
  - `evals.scorer.score_case(case_id: str, expect: dict, result: RunResult) -> CaseResult`

- [ ] **Step 1: Write the failing scorer tests** `runtime/python/tests/test_eval_scorer.py`:

```python
from evals.scorer import CaseResult, RunResult, score_case


def _ok(summary="Paris", status="completed", agents=None, tools=None) -> RunResult:
    return RunResult(status=status, result_summary=summary, agents_used=agents or [], tools_used=tools or [])


def test_empty_expect_passes() -> None:
    assert score_case("c", {}, _ok()).passed is True


def test_completed_check() -> None:
    assert score_case("c", {"completed": True}, _ok(status="completed")).passed is True
    r = score_case("c", {"completed": True}, _ok(status="failed"))
    assert r.passed is False and any("status" in reason for reason in r.reasons)


def test_contains_is_case_insensitive() -> None:
    assert score_case("c", {"contains": ["paris"]}, _ok(summary="The capital is Paris.")).passed is True
    r = score_case("c", {"contains": ["london"]}, _ok(summary="Paris"))
    assert r.passed is False and any("london" in reason for reason in r.reasons)


def test_regex_check() -> None:
    assert score_case("c", {"regex": r"(?i)paris"}, _ok(summary="PARIS")).passed is True
    assert score_case("c", {"regex": r"\d+"}, _ok(summary="no digits")).passed is False


def test_agent_and_tool_used() -> None:
    assert score_case("c", {"agentUsed": "agent_file"}, _ok(agents=["agent_file"])).passed is True
    assert score_case("c", {"agentUsed": "agent_file"}, _ok(agents=["agent_manager"])).passed is False
    assert score_case("c", {"toolUsed": "terminal"}, _ok(tools=["terminal"])).passed is True
    assert score_case("c", {"toolUsed": "terminal"}, _ok(tools=[])).passed is False


def test_multiple_reasons_accumulate() -> None:
    r = score_case("c", {"completed": True, "contains": ["x"], "regex": r"zzz"}, _ok(summary="Paris", status="failed"))
    assert r.passed is False and len(r.reasons) == 3
```

- [ ] **Step 2: Run to verify it fails** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_eval_scorer.py -q` → FAIL (module `evals` not found). (If it fails on import-path rather than module-missing, do Step 3's pyproject change first.)

- [ ] **Step 3: Create the package + scorer + pythonpath**

`runtime/python/evals/__init__.py`: empty file.

`runtime/python/evals/scorer.py`:

```python
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class RunResult:
    status: str
    result_summary: str
    agents_used: list[str] = field(default_factory=list)
    tools_used: list[str] = field(default_factory=list)


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    reasons: list[str] = field(default_factory=list)


def score_case(case_id: str, expect: dict, result: RunResult) -> CaseResult:
    """Deterministically score one run against a case's expectations. A case passes iff every
    provided check holds. Failure is decided by status — never by keyword-guessing the answer."""
    reasons: list[str] = []

    if "completed" in expect:
        want = bool(expect["completed"])
        is_completed = result.status == "completed"
        if want != is_completed:
            reasons.append(f"status was {result.status!r}, expected {'completed' if want else 'not completed'}")

    summary_lower = result.result_summary.lower()
    for sub in expect.get("contains", []):
        if sub.lower() not in summary_lower:
            reasons.append(f"missing substring {sub!r}")

    regex = expect.get("regex")
    if regex is not None and not re.search(regex, result.result_summary):
        reasons.append(f"no match for regex {regex!r}")

    agent_used = expect.get("agentUsed")
    if agent_used is not None and agent_used not in result.agents_used:
        reasons.append(f"agent {agent_used!r} not used")

    tool_used = expect.get("toolUsed")
    if tool_used is not None and tool_used not in result.tools_used:
        reasons.append(f"tool {tool_used!r} not used")

    return CaseResult(case_id=case_id, passed=not reasons, reasons=reasons)
```

In `runtime/python/pyproject.toml`, under `[tool.pytest.ini_options]`, add (if not already present):

```toml
pythonpath = ["."]
```

(This puts `runtime/python` on `sys.path` for tests so `import evals.scorer` resolves alongside `import yanshi_runtime`.)

- [ ] **Step 4: Create the golden-set** `runtime/python/evals/cases.jsonl` (small, stable — avoid flaky checks):

```jsonl
{"id": "math_basic", "task": "What is 2+2? Reply with just the number.", "expect": {"completed": true, "contains": ["4"]}}
{"id": "knowledge_capital", "task": "What is the capital of France? Answer in one word.", "expect": {"completed": true, "regex": "(?i)paris"}}
{"id": "greeting", "task": "Say hello in English.", "expect": {"completed": true, "regex": "(?i)hello"}}
```

- [ ] **Step 5: README + gitignore** — `runtime/python/evals/README.md`:

```markdown
# Yanshi eval harness (deterministic)

Golden-set agent-quality regression baseline.

- `cases.jsonl` — golden tasks + deterministic `expect` checks.
- `scorer.py` — pure deterministic scorer (unit-tested in CI).
- `run_evals.py` — runs each case through the real runtime against your CONFIGURED provider.

Run (needs a configured provider; costs provider tokens — NOT run in CI):

    uv run --project runtime/python python -m evals.run_evals

It prints a per-case PASS/FAIL report + pass rate, writes `evals/last_report.json`
(gitignored), and exits non-zero if any case fails or no provider is configured.
```

Add to `.gitignore`: `runtime/python/evals/last_report.json`.

- [ ] **Step 6: Run the scorer tests → PASS; then the full suite green.**
- [ ] **Step 7: Commit**

```bash
git add runtime/python/evals/__init__.py runtime/python/evals/scorer.py runtime/python/evals/cases.jsonl runtime/python/evals/README.md runtime/python/pyproject.toml .gitignore runtime/python/tests/test_eval_scorer.py
git commit -m "$(printf 'feat(evals): deterministic scorer + golden-set (CI-tested)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: `run_evals.py` — the runner (manual; honest no-provider path CI-tested)

**Files:**
- Create: `runtime/python/evals/run_evals.py`
- Test: `runtime/python/tests/test_eval_runner.py`

**Interfaces:**
- Consumes: `evals.scorer` (Task 1); `yanshi_runtime.server.create_app`; `yanshi_runtime.config.RuntimeSettings`; `storage.list_agent_tasks(run_id=…)` (each item has `.agentId`).
- Produces:
  - `evals.run_evals.EvalReport(provider_configured: bool, results: list[CaseResult])` with `.passed -> int`, `.total -> int` properties.
  - `evals.run_evals.load_cases(path: Path) -> list[dict]`
  - `evals.run_evals.run_evals(cases: list[dict], *, data_dir: Path) -> EvalReport`
  - `evals.run_evals.main() -> int` (CLI entry)

- [ ] **Step 1: Write the failing test** (the no-provider path is fully CI-safe — an empty data_dir has no configured provider, so no model call happens):

```python
from pathlib import Path
from evals.run_evals import EvalReport, load_cases, run_evals


def test_run_evals_is_honest_without_provider(tmp_path: Path) -> None:
    # A fresh data_dir has no configured provider → the runner must NOT run cases or fake scores.
    report = run_evals([{"id": "x", "task": "hi", "expect": {"completed": True}}], data_dir=tmp_path)
    assert isinstance(report, EvalReport)
    assert report.provider_configured is False
    assert report.results == []
    assert report.total == 0


def test_load_cases_parses_jsonl(tmp_path: Path) -> None:
    p = tmp_path / "c.jsonl"
    p.write_text('{"id": "a", "task": "t", "expect": {"completed": true}}\n\n{"id": "b", "task": "t2", "expect": {}}\n', encoding="utf-8")
    cases = load_cases(p)
    assert [c["id"] for c in cases] == ["a", "b"]
```

- [ ] **Step 2: Run to verify it fails** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_eval_runner.py -q` → FAIL.

- [ ] **Step 3: Implement `run_evals.py`**:

```python
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from evals.scorer import CaseResult, RunResult, score_case

_TOOL_ROLES = {"browser", "computer", "terminal", "file"}
_DEFAULT_CASES = Path(__file__).parent / "cases.jsonl"


@dataclass
class EvalReport:
    provider_configured: bool
    results: list[CaseResult]

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def total(self) -> int:
        return len(self.results)


def load_cases(path: Path) -> list[dict]:
    cases: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            cases.append(json.loads(line))
    return cases


def _agents_and_tools(storage, run_id: str) -> tuple[list[str], list[str]]:
    try:
        tasks = storage.list_agent_tasks(run_id=run_id)
        agents = sorted({task.agentId for task in tasks})
    except Exception:  # noqa: BLE001 — never let result-gathering crash the eval
        agents = []
    tools = sorted({role for agent in agents if (role := agent.removeprefix("agent_")) in _TOOL_ROLES})
    return agents, tools


def run_evals(cases: list[dict], *, data_dir: Path) -> EvalReport:
    from fastapi.testclient import TestClient

    from yanshi_runtime.config import RuntimeSettings
    from yanshi_runtime.server import create_app

    settings = RuntimeSettings(data_dir=data_dir, runtime_version="eval", synchronous_runs=True, api_token="eval-token")
    app = create_app(settings)
    service = app.state.runtime_service
    if not service.provider.configured:
        return EvalReport(provider_configured=False, results=[])

    client = TestClient(app, headers={"Authorization": "Bearer eval-token"})
    results: list[CaseResult] = []
    for case in cases:
        created = client.post("/runs", json={"task": case["task"], "projectId": case.get("projectId")}).json()
        run_id = created["id"]
        fetched = client.get(f"/runs/{run_id}").json()
        agents, tools = _agents_and_tools(service.storage, run_id)
        result = RunResult(
            status=fetched.get("status", "unknown"),
            result_summary=fetched.get("resultSummary") or "",
            agents_used=agents,
            tools_used=tools,
        )
        results.append(score_case(case["id"], case.get("expect", {}), result))
    return EvalReport(provider_configured=True, results=results)


def main() -> int:
    cases_path = Path(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT_CASES
    data_dir = Path.home() / ".yanshi"
    report = run_evals(load_cases(cases_path), data_dir=data_dir)
    if not report.provider_configured:
        print("No model provider is configured — configure one in Yanshi, then re-run. (No cases were run.)")
        return 1
    for result in report.results:
        mark = "PASS" if result.passed else "FAIL"
        print(f"[{mark}] {result.case_id}" + ("" if result.passed else f" — {'; '.join(result.reasons)}"))
    print(f"\n{report.passed}/{report.total} passed")
    (cases_path.parent / "last_report.json").write_text(
        json.dumps({"passed": report.passed, "total": report.total,
                    "results": [{"id": r.case_id, "passed": r.passed, "reasons": r.reasons} for r in report.results]}, indent=2),
        encoding="utf-8",
    )
    return 0 if report.passed == report.total else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run the tests → PASS; then the full suite green.**

- [ ] **Step 5: Manual smoke (NOT a CI gate — document the result)** — with a provider configured in the real Yanshi data dir, run `cd runtime/python && uv run python -m evals.run_evals` and confirm it prints a report + pass rate and writes `last_report.json`. (If no provider is configured on the build machine, note that the manual run was deferred — the no-provider path is the CI-covered behavior.)

- [ ] **Step 6: Commit**

```bash
git add runtime/python/evals/run_evals.py runtime/python/tests/test_eval_runner.py
git commit -m "$(printf 'feat(evals): runner driving the synchronous runtime, honest no-provider exit\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:** §4.1 cases.jsonl → Task 1. §4.2 pure scorer + CI unit tests → Task 1. §4.3 runner (synchronous runtime, provider check, gather agents/tools, score, report, exit code) → Task 2. §4.4 CI runs only the scorer (+ runner no-provider) tests → Tasks 1 & 2 tests; the eval run is `main()`, never invoked by CI. §5 honesty (no provider → honest non-zero, never faked; status-authoritative) → Task 2 `run_evals`/`main` + Task 1 scorer. §6 tests (scorer branches; no-provider path; load_cases) → both tasks. §8 seed set → Task 1 cases.jsonl (3 stable seeds; the flaky file-tool case was intentionally dropped per the spec). ✅

**Placeholder scan:** Complete code in every code step. The Task 2 Step 5 "manual smoke" is explicitly NOT a CI gate and documents a real human/opt-in action with a stated fallback (note if deferred) — not missing content. The `list_agent_tasks(...).agentId` access is wrapped in try/except with a documented `[]` fallback (spec §9), so an unexpected shape degrades honestly rather than crashing.

**Type consistency:** `RunResult`/`CaseResult`/`score_case` (Task 1) consumed by `run_evals` (Task 2) with matching signatures. `EvalReport.passed/total` used in `main`. `expect` dict keys (`completed`/`contains`/`regex`/`agentUsed`/`toolUsed`) consistent between the scorer, the cases.jsonl seed, and the spec.

**Scope:** Single plan. LLM-judge, running in CI, and multi-provider matrices are out of scope and unreferenced by any task.
