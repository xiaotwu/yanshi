# No-Mock Policy

Yanshi has a hard rule: **no user-facing mock, fake, placeholder, scaffold-only, demo-only, or
"coming soon" implementations.** Every visible behavior is backed by something real.

## What this means

- If an external dependency, model API key, OS permission, or Docker daemon is missing, Yanshi
  shows a clear **not-configured** or **permission-required** state — never a fake success.
- Tool results are real. The Browser tool reports a missing-Chromium state honestly; Computer Use
  reports permission-required honestly; nothing simulates a screenshot or a click.
- Integration statuses are server-computed so a stored config can never claim a connection that
  does not exist. ACP live state is never persisted as "connected"; MCP tools are never faked.
- The Atelier mirrors real runtime state; idle/life animation is clearly decorative and never
  implies progress.

## What is allowed

- Test fixtures **in tests only**, and deterministic sample data **for unit tests only**.
- Honest *available now* / *setup required* / *blocked by permission* / *foundation implemented*
  / *planned* states in the UI.

## How the docs reflect it

These docs use status badges — <Badge type="tip" text="Available now" />,
<Badge type="info" text="Foundation implemented" />, <Badge type="warning" text="Setup required" />,
<Badge type="warning" text="Planned" />, and <Badge type="danger" text="Blocked by external requirement" />
— and never claim a feature is complete when it is a foundation or pending an external step. The
honest gaps are catalogued in
[Known Limitations](/release/limitations).
