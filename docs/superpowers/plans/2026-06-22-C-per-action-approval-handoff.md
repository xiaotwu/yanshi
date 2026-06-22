# Handoff C — Per-action approval/blocked defense-in-depth

**For:** Codex, in `/Users/xiaotwu/Code/yanshi` on `main`. **Do not push to origin.**
**venv:** `runtime/python/.venv/bin/python` · **trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
**Size:** Small, contained. Pure hardening — must not regress any existing approval test.

## The gap
In the ReAct loop, `_decide_node` (runtime_graph.py ~L527) evaluates `policy.decide(task, …)` on the
**top-level task** for the `blocked` (critical boundary) and `requires_approval` gates *before* calling
the provider. This is correct and necessary — `test_approval_pause_and_resume` requires gating to happen
with **no provider call** (it posts a high-risk task with no provider and expects `pending_approval`).
So the top-level pre-provider gate must stay.

But after the manager picks a concrete sub-action (`{"action":"assign","agentId":…,"task":<sub_task>}`),
that sub-action is **not** re-checked. A manager that escalates — benign-looking top-level task, but it
assigns a critical/high-risk sub-action — currently slips straight to `act`. The design spec §4.4 wants
each assigned action gated. This handoff adds that as **defense-in-depth on top of** the existing
top-level gate (not a replacement).

## Build
In `_decide_node`, *after* `_provider_next_action` returns an `assign` action, run
`action_decision = self.policy.decide(sub_task, permission_mode)` (the code already computes this for
`risk_level`) and additionally honor:
- `action_decision.blocked` → same `permission_boundary` `ReviewObservation` + `blocked=True` +
  `next_action=None` path as the top-level A-check (factor that into a small helper so both call sites
  share it). Route → finalizer (failed). The sub-action must **not** execute.
- `action_decision.requires_approval` and the action isn't already covered by an approval the user just
  granted → create the approval + `pending_approval` + `approval_required=True` (reuse the existing
  B/C block), route → permission_gate.

**`approved` lifecycle (important):** today `approved=True` is sticky for the whole run (set once at the
top-level gate). For per-action gating to mean anything, an approval must be *consumed per action*:
have `_act_node` clear `approved` (set to `None`) after it executes the approved action, so the *next*
risky sub-action re-gates. Verify this does not break `test_approval_pause_and_resume` /
`test_approval_decision_accepts_aliases` / `test_plan_first_forces_approval_then_resumes` (those approve
once and then either fail on missing-provider or complete in one tool step — re-gating shouldn't trigger
a second prompt for them; if it does, the test scenario needs a benign follow-up action, not a weakened
assertion).

## Tests (TDD)
- **Escalation blocked:** seed a provider whose first `assign` sub-task is on the critical blocklist
  while the top-level task is benign → run `failed`, `permission_boundary` observation, sub-action never
  executed (assert no tool action / `provider`-driven but tool not run).
- **Escalation needs approval:** benign top-level task, manager assigns a high-risk sub-action →
  `pending_approval`; approve → it proceeds; deny → `failed`.
- **No double-prompt regression:** the three existing approval tests stay green unchanged.
- Gate: `pytest -p no:cacheprovider -p no:warnings` green.

## Done
Implemented TDD in one or two commits; shared blocked/approval helper; `approved` consumed per action;
all existing approval tests green; new escalation tests added. Trailer on commits; no push. Update the
loop spec/handoff note to record that per-action gating is now implemented (it was listed as optional
follow-up in `2026-06-22-task5-loop-test-reconciliation-handoff.md` §7).
