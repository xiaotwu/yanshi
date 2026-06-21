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
