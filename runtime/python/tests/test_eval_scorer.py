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
