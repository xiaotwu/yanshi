from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

ROOT = Path("/Users/xiaotwu/Code/yanshi")
REG_DIR = ROOT / "qa/codex-final-product-audit/regression-2026-06-09_21-57-56_PDT"
LOGS = REG_DIR / "LOGS"
BASE = "http://127.0.0.1:8765"


def curl_json(name: str, args: list[str], *, fail: bool = True) -> object:
    cmd = ["curl", "-sS"]
    if fail:
        cmd.append("-f")
    cmd.extend(args)
    proc = subprocess.run(cmd, text=True, capture_output=True, check=False)
    (LOGS / f"{name}.stdout").write_text(proc.stdout, encoding="utf-8")
    (LOGS / f"{name}.stderr").write_text(proc.stderr, encoding="utf-8")
    result = {"returncode": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr}
    (LOGS / f"{name}.json").write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
    if fail and proc.returncode != 0:
        raise AssertionError(f"{name} failed: {proc.stderr or proc.stdout}")
    return json.loads(proc.stdout)


def create_run(name: str, task: str) -> str:
    payload = json.dumps({"task": task, "permissionMode": "default"})
    run = curl_json(name, ["-X", "POST", "-H", "Content-Type: application/json", "-d", payload, f"{BASE}/runs"])
    return run["id"]  # type: ignore[index]


def wait_pending_approval(run_id: str, name: str) -> str:
    for _ in range(80):
        approvals = curl_json(name, [f"{BASE}/approvals"])
        for approval in approvals:  # type: ignore[union-attr]
            if approval["runId"] == run_id:
                return approval["id"]
        time.sleep(0.25)
    raise AssertionError(f"No pending approval for {run_id}")


def wait_run_terminal(run_id: str, name: str) -> dict:
    for _ in range(80):
        runs = curl_json(name, [f"{BASE}/runs"])
        for run in runs:  # type: ignore[union-attr]
            if run["id"] == run_id and run["status"] in {"completed", "failed", "cancelled"}:
                return run
        time.sleep(0.25)
    raise AssertionError(f"Run did not reach terminal state: {run_id}")


def decide(name: str, approval_id: str, decision: str) -> dict:
    payload = json.dumps({"decision": decision})
    result = curl_json(
        name,
        ["-X", "POST", "-H", "Content-Type: application/json", "-d", payload, f"{BASE}/approvals/{approval_id}/decision"],
    )
    return result  # type: ignore[return-value]


def main() -> int:
    deny_run = create_run("40-approval-deny-create-run", "Use browser https://example.com for regression deny alias")
    deny_approval = wait_pending_approval(deny_run, "41-approval-deny-list")
    deny_result = decide("42-approval-deny-alias", deny_approval, "deny")
    if deny_result["status"] != "denied":
        raise AssertionError(f"deny alias did not map to denied: {deny_result}")
    deny_terminal = wait_run_terminal(deny_run, "43-approval-deny-run-terminal")
    if deny_terminal["status"] != "failed" or "denied" not in (deny_terminal.get("resultSummary") or "").lower():
        raise AssertionError(f"denied run did not fail honestly: {deny_terminal}")

    approve_run = create_run("44-approval-approve-create-run", "Use browser https://example.com for regression approve alias")
    approve_approval = wait_pending_approval(approve_run, "45-approval-approve-list")
    approve_result = decide("46-approval-approve-alias", approve_approval, "approve")
    if approve_result["status"] != "approved":
        raise AssertionError(f"approve alias did not map to approved: {approve_result}")
    approve_terminal = wait_run_terminal(approve_run, "47-approval-approve-run-terminal")
    if approve_terminal["status"] != "failed" or "Chromium" not in (approve_terminal.get("resultSummary") or ""):
        raise AssertionError(f"approved browser run did not reach honest Chromium setup-required failure: {approve_terminal}")

    (LOGS / "48-approval-alias-regression-summary.json").write_text(
        json.dumps(
            {
                "status": "PASS",
                "denyRun": deny_run,
                "denyApproval": deny_approval,
                "approveRun": approve_run,
                "approveApproval": approve_approval,
                "approveTerminal": approve_terminal,
            },
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    print("PASS approval alias regression")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
