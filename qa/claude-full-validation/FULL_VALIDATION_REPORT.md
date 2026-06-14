# Full Validation Report — v0.1 Local Final Candidate (2026-06-13)

_Validator: **Claude Code** (performed independently, in-session, per the instruction "Do not use
Codex for full validation. You can go through this now"). This is a local-final-candidate
validation, not a public-release sign-off — see §8 Release blockers._

## 1. Verdict

**PASS for the v0.1 Local Final Candidate.** Every automated suite is green, the packaged app
builds/launches/quits cleanly with no orphans, the no-mock principle holds across all tool and
integration surfaces (real work or honest blocker — never a fabricated success), the secret model
holds (the raw key never leaves the 0600 secret store), and a real run executes end-to-end with
real events and a real artifact. The only remaining work is **external/human** (Apple Developer ID
signing/notarization + Chromium/Computer-Use host grants + a packaged human interactive pass).

## 2. Scope validated

Automated suites · packaged-app lifecycle · live functional smoke · no-mock audit · secret audit ·
real run end-to-end · live UI honest-states. Methodology: an **isolated runtime** at
`/tmp/yanshi-val-1781402294` (separate `YANSHI_HOME`, fresh SQLite + secret store) on `:8765`, a
Vite dev server on `:5199`, plus the production `desktop:release` bundle for the packaged checks.

## 3. Automated suites — PASS

| Command | Result |
|---|---|
| `pnpm lint` (+ `typecheck`) | PASS |
| `pnpm test` | PASS — 41 tests / 7 files (incl. i18n parity, errors registry) |
| `pnpm build` | PASS |
| `uv run --project runtime/python pytest` | PASS — 79 |
| `cargo check` | PASS |
| `cargo test` | PASS — 11 |
| `pnpm docs:build` | PASS (default base) |
| `DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build` | PASS (base-path safe) |

## 4. Packaged app lifecycle — PASS

- **Build:** `desktop:release` produced the `.app`/`.dmg` with the PyInstaller runtime embedded
  (~66 MB sidecar, `mode=bundled-sidecar` — no external Python required).
- **Launch:** runtime reached healthy in ~5 s on first launch.
- **Clean quit:** process-group teardown left **0 orphans** bound to `:8765`.
- **Relaunch:** healthy in ~3 s; **second clean quit**, again 0 orphans.

## 5. No-mock audit — PASS

The core principle ("real work or an honest blocker — never a fabricated success") was exercised
live against the running runtime:

| Surface | Result | Honest? |
|---|---|---|
| **LLM provider** | OpenAI-compatible save/test against a real endpoint; Anthropic/Gemini report "not implemented" | ✅ |
| **Browser tool (valid URL)** | Real Playwright navigation — run **completed**, summary "Browser Agent loaded Example Domain" (the genuine `example.com` title) | ✅ real |
| **Browser tool (bad input)** | "Use the browser to open example.com" (no scheme) → run **failed**, "Browser Agent needs an http(s) URL to navigate" — honest validation failure, not a faked success | ✅ honest |
| **File tool** | Real workspace scan; "File Agent scanned 0 items" honest for an empty temp workspace | ✅ |
| **ACP external agent** | Saved → status `configured`, capabilities `[]`; never persisted as fake-connected | ✅ |
| **MCP server** | Saved → status `not_implemented`, tools `[]`; no fake test button, tools never fabricated | ✅ |

`runtime/status` reported `running` with empty missing-requirements (the provider is configured),
consistent with the honest requirement model.

## 6. Secret audit — PASS

Seeded a known key `sk-VALIDATIONSECRET-7f3a9c2e`, then searched every persistence surface:

| Location | Key present? | Expected |
|---|---|---|
| `secrets/provider_api_key.secret` (perms `-rw-------`, 0600) | **YES** | ✅ only place it should live |
| `yanshi.db` / `-wal` / `-shm` | no (0 matches) | ✅ |
| `runtime.log` | no (0 matches) | ✅ |
| `GET /settings/provider` response body | no — returns only `apiKeyConfigured: true` | ✅ |

The documented `apiKeyRef`/off-DB secret model holds: the raw key never enters SQLite, logs,
events, or API responses.

## 7. Real run end-to-end — PASS

A real task produced a real, ordered event stream (16 events): `run.created` → `run.started` →
`plan.created` → `agent.task.assigned`/`started`/`completed` (×2) → `action.created`/`completed`
(×2) → `observation.created` → `artifact.created` → `run.completed`, with a real artifact
`latest-file-scan.json` and an honest "scanned 0 items" result for the empty workspace. The live
UI listed these as real **Recent chats** (no synthetic placeholders).

## 8. Live UI honest-states — PASS

Rendered app on `:5199`: sidebar reads **New Chat / Search / Library / Workshop / Projects / New
Project** with **zero** Runs / Artifacts / Live Office / New Task leaks; the composer is honest
(Effort, Permission, Voice controls present; **Run disabled** until there is input); the Atelier
toolbar button is present and singular. This matches the latest product decisions and the spec
alignment matrix.

## 9. Release blockers (external / human only)

These are out of scope for a local validation and remain open — **public release is not complete
until they are done**:

- Apple **Developer ID** signing + notarization + stapling + **Gatekeeper** verification on a
  second machine.
- **Chromium** provisioning for the Browser tool on the target host (the dev runtime had Playwright
  browsers; a packaged host does not by default — the app shows the honest `YANSHI_BROWSER_001`
  missing-binaries state).
- **Computer Use** macOS Accessibility / Screen Recording grants (honest permission-required state
  until granted).
- A **packaged human interactive pass** (real provider key, real chats) on the signed build.

## 10. Conclusion

The v0.1 Local Final Candidate is **validated PASS**. No P0/P1/P2 product defects surfaced. The
build is honest end-to-end (no mocks, no fake success states, secrets contained). The path to a
public release is gated only on the external/human items in §9.
