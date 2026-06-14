# Repository Cleanup + Docs Consolidation Report (2026-06-13)

## 1. Verdict

**PASS.** Repository hygiene + docs/QA consolidation complete; no source, runtime, or desktop
behavior changed; all verification green.

## 2. Cleanup summary

The working tree carried the entire project uncommitted plus ~28 MB of QA machine debris from
historical Codex runs. This pass removed the disposable machine state (SQLite databases, dummy
secret stores, workspace copies, exported test packs, raw process logs) while keeping **100% of
the human-readable QA history** (every report `.md`, every screenshot `.png`, and the historical
regression scripts). Caches were cleared, `.gitignore` was hardened so QA runs can never re-commit
machine state, broken `qa/junie-archive/` links in active docs were fixed, and the QA status index
was rewritten to current reality.

## 3. Files / directories deleted

**Machine-state directories (entire trees):**

- `qa/codex-global-review/runtime-data/`
- `qa/codex-ux-refinement-review/runtime-data/`
- `qa/codex-ux-refinement-review/regression-runtime-data/`
- `qa/codex-ux-refinement-review/regression-packaged-home/`
- `qa/codex-final-product-audit/regression-2026-06-09_21-57-56_PDT/ui-runtime-data/`
- `qa/codex-final-product-audit/regression-2026-06-09_21-57-56_PDT/adopted-runtime-data/`

These contained `yanshi.db` / `langgraph-checkpoints.db` (+ `-shm`/`-wal`), `provider_api_key.secret`
files (**dummy QA values** `codex-dummy-secret` / `qa-secret-codex-ux-review-2026`, not real keys),
and per-run `workspaces/` copies.

**Raw artifacts removed across the three Codex QA dirs** (kept `.md`, `.png`, `.py`, `.sh`):
all `*.log`, `*.json`, `*.txt`, `*.zip`, `*.pid`, `*.err`, `*.out`, `*.stderr`, `*.stdout`, `*.html`
(build/process logs, API-response snapshots, exported workshop test packs, pid/exit captures).

**Caches cleared from the working tree** (all already gitignored): `__pycache__/` (repo +
runtime), `.pytest_cache/`, `.ruff_cache/`, `.DS_Store`, `.playwright-mcp/`.

**Result:** the three QA dirs dropped from ~28 MB → ~18 MB; `qa/` total is 24 MB of pure
documents (67 `.md` + 124 `.png` + 3 scripts), with **zero** `.db` / `.secret` / `.zip` remaining.

## 4. Files archived / moved

None. The Junie evidence directories were already absent from the working tree (removed in an
earlier cleanup); this pass only fixed the dangling references to them. No reports were moved —
the existing per-pass directory layout was kept (a large rename would have broken links).

## 5. Docs updated

- `qa/CURRENT_QA_STATUS.md` — rewritten: active workflow (Claude implements, **Codex validates**,
  user decides, Junie historical), latest passing validation (**Codex global review 2026-06-12,
  no active P0/P1/P2**), current directory map, and a note that QA machine state is not committed.
- `CURRENT_STATUS.md`, `AGENTS.md`, `ACCEPTANCE_CHECKLIST.md` — fixed dangling `qa/junie-archive/`
  references (Junie is historical; its evidence dirs were removed). Workflow text confirmed.
- `IMPLEMENTATION_LOG.md` — added this cleanup entry.
- Verified active docs ↔ docs site (`apps/docs`) agreement on commands, `DOCS_BASE_PATH`, and the
  GitHub Pages source. Historical/record docs (`RELEASE_NOTES_RC.md`, `Yanshi_Product_Design_Spec.md`,
  `BUILD_AND_RELEASE.md` verification records) were left verbatim — rewriting their period wording
  would misrepresent history.

## 6. README updates

None needed — the README was already rewritten (Codex README-update pass) into a current,
public-facing form (identity, status table, architecture incl. `apps/docs`, features, requirements,
commands, GitHub Pages with `DOCS_BASE_PATH`, known limitations). Verified consistent with this
cleanup; no changes required.

## 7. .gitignore updates

Added so future QA runs never re-commit machine state or secret stores:

```
**/runtime-data/
**/regression-runtime-data/
**/regression-packaged-home/
*.secret
qa/**/*.zip
qa/**/*.log
qa/**/LOGS/*.json
qa/**/*.pid
```

(VitePress `dist`/`cache` and the existing `*.db*` / cache / `.playwright-mcp/` rules already
present.)

## 8. Active QA status after cleanup

- **Active validation reference:** `qa/codex-global-review/` — Codex global review **passed**,
  **no active P0/P1/P2 product bugs**.
- Docs-site review (`codex-docs-site-review/`) and README update (`codex-readme-update/`) complete.
- All historical `BUGS_FOR_CLAUDE.md` files carry an "Archived / Resolved" header.

## 9. Current active workflow

Claude Code = implementation / design / cleanup / fixes · Codex = independent validation /
review · User = final product & release decisions · Junie = historical only (not in workflow).

## 10. Remaining blockers (external / human)

Developer ID codesign + notarization + stapling + Gatekeeper second-machine verification;
Chromium provisioning for the Browser tool; macOS Accessibility / Screen Recording grants for
Computer Use; real provider API key for live chats; packaged human interactive pass; plus the
documented future roadmap (ACP prompt routing, MCP runtime client, richer Atelier workers /
pathfinding).

## 11. Commands run and results

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS (41 tests, 7 files) |
| `pnpm docs:build` | PASS (default base `/yanshi/`) |
| `DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build` | PASS (base path applied) |

`pytest` and `cargo` were not run because no runtime/desktop/source files changed in this pass
(only QA dirs, `.gitignore`, and docs/status `.md`). `desktop:release` not run (no build behavior
changed).

## 12. Source behavior changed?

**No.** Zero changes to `apps/desktop`, `runtime/python`, `packages/*`, or any build/config that
affects the app. Changes were limited to QA-debris deletion, cache clearing, `.gitignore`, and
documentation `.md` files.

## 13. Ready for commit/push?

**Yes.** The working tree is clean of machine debris and secret stores, `.gitignore` prevents
recurrence, docs are consistent, and all checks pass. Committing was intentionally **not**
performed (commit/push only on explicit request). Recommended: review `git status`, then commit
the full final-candidate tree.
