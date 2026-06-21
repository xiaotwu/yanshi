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
