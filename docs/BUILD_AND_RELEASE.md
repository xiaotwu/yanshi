# Yanshi Build and Release Notes

## Local Build

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
uv run --project runtime/python pytest
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm --filter @yanshi/desktop tauri build
```

## Runtime Packaging Status

A standalone runtime sidecar can now be built and bundled, producing a self-contained
`.app` that launches the runtime without `uv` or a repo checkout.

### Build the bundled, distributable app

```bash
pnpm desktop:release
```

This runs `pnpm sidecar:build` (PyInstaller) and then `tauri build` with the sidecar
overlay config (`apps/desktop/src-tauri/tauri.sidecar.conf.json`).

`pnpm sidecar:build` alone (`scripts/build-sidecar.sh`):

- Uses PyInstaller (`--onefile`) to build `yanshi-runtime-sidecar` from
  `runtime/python/sidecar_main.py`.
- Stages it at `apps/desktop/src-tauri/resources/yanshi-runtime-sidecar` (gitignored;
  ~63 MB).
- The overlay config bundles `resources/yanshi-runtime-sidecar` into the app, landing at
  `Yanshi.app/Contents/Resources/resources/yanshi-runtime-sidecar`.

### Launch-path resolution order (Rust)

1. `YANSHI_RUNTIME_PROJECT` env → `uv run` against that project (dev override).
2. Bundled sidecar binary at any of: `Resources/yanshi-runtime-sidecar`,
   `Resources/bin/…`, `Resources/runtime/…`, `Resources/resources/…` → `mode=bundled-sidecar`.
3. Bundled `Resources/runtime/python` project with `uv` available.
4. (debug builds only) the repo `runtime/python` project.
5. Otherwise: honest `setup_required` state.

### Plain vs. release build

- `pnpm --filter @yanshi/desktop tauri build` → setup-required bundle (no sidecar). Used in CI/verification.
- `pnpm desktop:release` → distributable bundle with the embedded sidecar.

### Gatekeeper

The bundle is **not codesigned or notarized**. It is functionally self-contained (the
runtime launches with no external Python), but a second machine will show a Gatekeeper
warning until codesigning + notarization are added.

### Verification record (2026-06-08, Apple Silicon, dev machine)

- `pnpm desktop:release` produced `Yanshi.app` + `Yanshi_0.1.0_aarch64.dmg`.
- Sidecar present at `Yanshi.app/Contents/Resources/resources/yanshi-runtime-sidecar`, mode `0755`.
- Bundled binary launched with a clean env (`env -i HOME=… PATH=/usr/bin:/bin`) and served `/health` → ok.
- Launched the packaged app: runtime came up in `mode=bundled-sidecar`, `/health` ok, and the
  log shows `computer bridge listening at http://127.0.0.1:<random-port>`.
- Computer bridge end-to-end (packaged app): `POST /computer/open-app` with no/invalid token → **401**.
  Runtime task `Use the computer to open app \`TextEdit\`` → `Computer bridge opened TextEdit.`
  (`returnCode 0`), run **completed**.
- Pending interactive step: grant **System Settings → Privacy & Security → Accessibility →
  Yanshi** to verify `click`/`type`/`shortcut` (these require Accessibility; `open-app` does not).

### Verification record (2026-06-09, re-confirmed)

- `pnpm desktop:release` produced `Yanshi.app` + `.dmg`; packaged app launched `mode=bundled-sidecar`,
  `/health` ok, `computer bridge listening …`.
- Computer bridge `open-app` end-to-end → "Computer bridge opened TextEdit." (completed); bridge
  rejects unauthorized requests (401). 6 AgentInstances persisted in the packaged app.
- Office Editor 2D drag verified in dev: dragging a station persisted `stationLayout` to the office
  state and drives Live Office.
- **Still pending (interactive / environment):** Computer `click/type/shortcut` (Accessibility) and
  `screenshot` (Screen Recording); Docker command smoke (Docker daemon + pre-pulled image);
  tray/notifications/global-shortcuts/close-prompt in the packaged app.

## Automations

The runtime persists automations (`automations` + `automation_runs` tables). A background
scheduler thread (`start_automation_scheduler`, started only by the real sidecar `main()`, not
under tests) runs **enabled interval automations** when due (`run_due_automations` /
`is_automation_due`). "Run now" launches a real run and links it to the automation; run history
lists those runs. Only the runtime process lifetime is covered — automations do not run while the
app is closed (documented limitation; calendar/event triggers are future work).

## Theme

The UI is fully tokenized (`apps/desktop/src/styles.css` CSS variables) and supports **System /
Light / Dark** (Settings → General → Theme; default System). Light is pure white, Dark is
near-black, accent is a soft mint-green. The desktop resolves System via `prefers-color-scheme`
and reacts to OS changes. The Live Office 3D scene adapts (floor/lighting/environment + green glow).

## Codesign & Notarization (pending for public release)

The current bundle is **unsigned and un-notarized** — functionally distributable locally, but
Gatekeeper will block/warn on another Mac. To ship publicly:

1. **Ad-hoc sign (local only, no Apple account):**
   ```bash
   codesign --deep --force -s - "apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app"
   ```
   Removes the "damaged" prompt on the build machine; not valid for distribution.

2. **Developer ID signing** (requires an Apple Developer account + "Developer ID Application" cert):
   Configure Tauri signing in `tauri.conf.json` (`bundle.macOS.signingIdentity`) or sign post-build:
   ```bash
   codesign --deep --force --options runtime --timestamp \
     -s "Developer ID Application: <Your Name> (<TEAMID>)" Yanshi.app
   ```

3. **Notarize + staple:**
   ```bash
   xcrun notarytool submit Yanshi_0.1.0_aarch64.dmg \
     --apple-id <id> --team-id <TEAMID> --password <app-specific-password> --wait
   xcrun stapler staple Yanshi.app
   xcrun stapler staple Yanshi_0.1.0_aarch64.dmg
   ```

Until steps 2–3 are completed, the release notes must state: a functionally distributable local
build exists; a signed/notarized public release remains pending.

## Provider API Key Storage

The provider API key is never stored inline in SQLite. `set_provider_settings` writes the
raw key to an off-database secret store and persists only an opaque `apiKeyRef`:

- Default backend: 0600 files under `<data_dir>/secrets/` (deterministic, no prompts).
- Opt-in macOS Keychain: set `YANSHI_SECRET_BACKEND=keychain` (uses the `security` CLI).
- On startup, any legacy inline `apiKey` is migrated to the secret store and the database is
  `VACUUM`ed so the raw key does not linger in freed pages.
- Settings responses only expose `apiKeyConfigured`; the key never appears in responses or logs.

## External Requirements

## Computer Use Bridge

The desktop app starts an in-process localhost HTTP bridge server before it spawns
the Python runtime:

- Binds `127.0.0.1:0` (OS-assigned random port); never listens on a public interface.
- Generates a per-launch random bearer token (32 bytes from `/dev/urandom`, hex-encoded).
- Injects `YANSHI_COMPUTER_BRIDGE_URL` and `YANSHI_COMPUTER_BRIDGE_TOKEN` into the
  runtime process environment for both the `uv` and bundled-sidecar launch paths.
- Authenticates every request with a constant-time bearer-token check. Missing or
  invalid tokens return HTTP 401; unknown operations return 404; non-POST returns 405.
- Exposes `POST /computer/{click,type,shortcut,open-app}`, dispatching to the native
  macOS CoreGraphics action functions (which still enforce Accessibility permission).

The token is never logged, persisted, or returned in any API response. The runtime
log only records the bridge URL (host/port), not the token.

## External Requirements

- macOS with Tauri prerequisites and Xcode Command Line Tools.
- `pnpm` and the Node workspace installed for local builds.
- `uv` for the current Python runtime launch path.
- Playwright Chromium for Browser Use:

```bash
uv sync --project runtime/python --extra browser
uv run --project runtime/python playwright install chromium
```

- Docker Desktop running and the configured sandbox image available for Docker-backed terminal actions.
- macOS Accessibility permission for click/type/shortcut Computer Use.
- macOS Screen Recording permission for screenshot Computer Use.

## Release Checklist

- [x] Run the full verification command set above.
- [x] Build the distributable bundle with `pnpm desktop:release`.
- [x] Manually launch `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`.
- [x] Confirm runtime launch mode is `bundled-sidecar`.
- [x] Bundle and verify `yanshi-runtime-sidecar` launches from a clean environment.
- [x] Verify Computer bridge `open-app` end-to-end and 401 on unauthorized bridge requests.
- [ ] Grant Accessibility and verify Computer bridge `click`/`type`/`shortcut`.
- [ ] Codesign + notarize for second-machine distribution.
- [ ] Verify Browser Use with installed Chromium and screenshot artifact output.
- [ ] Verify Docker sandbox with the configured image pre-pulled or pullable.
- [ ] Verify macOS Accessibility and Screen Recording permission flows.
- [ ] Verify tray menu actions: Open Yanshi, Current Tasks, Open Live Office, Pause All, Quit.
- [ ] Verify notifications for approval requested, run completed, run failed, and runtime error.
- [ ] Verify no API keys or provider secrets appear in logs, events, or public settings responses.
