# Handoff D — Owner-credentialed items (Apple signing/notarization + auto-update / crash reporting)

**For:** the **owner** to run the credentialed steps; Codex may prepare non-credentialed scaffolding.
Repo `/Users/xiaotwu/Code/yanshi` on `main`. **Do not push to origin.** Trailer on any commit:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

> ⚠️ **Credential boundary.** Neither Claude nor Codex should enter, paste, or store Apple IDs,
> app-specific passwords, Developer ID certificates, API keys, or service tokens. Those steps are the
> owner's, performed in the owner's own keychain / CI secret store / service dashboards. The agents'
> job is limited to wiring the code/CI to *read* secrets from the environment and documenting the runbook.

## D1 — Apple Developer ID signing + notarization
**Scaffold today:** `.github/workflows/release.yml` (release pipeline) and `scripts/build-sidecar.sh`
(PyInstaller sidecar build). The Tauri shell produces `.app`/`.dmg`.

**What Codex may prepare (no credentials):**
- Confirm `release.yml` reads signing inputs from CI secrets/env (e.g. `APPLE_CERTIFICATE`,
  `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`) and never hardcodes them. Wire any missing env plumbing + Tauri
  `bundle.macOS` signing config / `notarize` step. Add a clear "fails loudly if secrets absent" guard
  (no silent unsigned release).
- Document the exact runbook below.

**Owner-only runbook (credentialed):**
1. In Apple Developer: ensure a **Developer ID Application** cert; create an **app-specific password**
   (or a notarytool API key) and your **Team ID**.
2. Add them as CI secrets (GitHub repo → Settings → Secrets) — owner action.
3. Trigger `release.yml`; it signs the `.app`, builds the `.dmg`, submits to `notarytool`, and staples.
4. Verify locally: `codesign --verify --deep --strict --verbose=2 Yanshi.app` and
   `spctl -a -vvv -t install Yanshi.app` (Gatekeeper accepts), and `xcrun stapler validate Yanshi.dmg`.
5. Confirm a clean download on another Mac opens without the unidentified-developer prompt.

## D2 — Auto-update + crash reporting (needs the owner's services/keys)
These need a hosting/service decision the owner must make; Codex can scaffold once the owner picks.
**Decisions for the owner:**
- **Auto-update:** Tauri updater needs an **update server / static feed** (e.g. a release JSON on
  GitHub Releases or your own host) and an **updater signing keypair** (the private key is an owner
  secret; the public key ships in `tauri.conf.json`). Pick the host + generate the keypair (owner).
- **Crash reporting:** pick a service (e.g. Sentry) → that's a **DSN/endpoint + token** the owner holds.
  Decide what's acceptable to collect (privacy: no secrets, no PII, no provider keys in payloads —
  consistent with Yanshi's secret-handling rules).

**What Codex may prepare (no credentials):**
- Wire the Tauri updater config to read the public key + feed URL from config/env; add an in-app
  "check for updates" path; make it **opt-in / clearly disclosed** (no silent telemetry).
- Add a crash-reporter init that reads the DSN from env and **scrubs** secrets/PII before send; default
  it **off** until the owner sets the DSN. Honest no-op when unconfigured.
- Document the enable runbook (owner adds key/DSN → feature activates).

## Done
- D1: `release.yml` + Tauri config wired to read signing secrets from env, fails loudly if absent;
  runbook documented. Owner runs the credentialed release + verifies Gatekeeper/staple.
- D2: updater + crash-reporter scaffolded, **disabled until configured**, privacy-scrubbing in place,
  enable runbook documented. Owner supplies feed/keypair/DSN.
- Any Codex commits: scaffolding only, no secrets, trailer present, no push.
