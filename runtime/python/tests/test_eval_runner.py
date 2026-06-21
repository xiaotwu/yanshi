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
