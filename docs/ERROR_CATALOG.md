# Yanshi Error Catalog

_All user-facing error codes (format `YANSHI_<AREA>_<NNN>`). Every code maps to an entry in
`apps/desktop/src/lib/errors.ts` and surfaces as a red toast (~8s) with the code + a short
localized reason. Unknown failures map to `YANSHI_UNKNOWN_001`. Normal mode never shows stack
traces; structured detail goes to the console / runtime logs for Developer Mode._

## YANSHI_RUNTIME_001

Area: Runtime · Severity: Critical
User message: Runtime connection failed.
中文提示：运行时连接失败。无法连接偃师运行时。
Cause: The frontend could not reach the bundled runtime sidecar (hydrate/API request failed).
User action: Restart Yanshi. If it continues, use "Open logs".
Developer notes: Check sidecar process, port 8765 binding, launch mode in Settings → Developer.

## YANSHI_RUNTIME_002

Area: Runtime · Severity: Error
User message: Event stream unavailable.
中文提示：事件流不可用，偃师正在自动重试。
Cause: WebSocket and HTTP-polling fallback both failed repeatedly.
User action: None required — reconnects automatically; check logs if persistent.
Developer notes: See ws backoff + poll failures in runtimeStore.connectEvents; toast fires only
on the transition into "unavailable" and the banner auto-clears on recovery.

## YANSHI_RUNTIME_003

Area: Runtime · Severity: Error
User message: Runtime restart failed.
中文提示：运行时重启失败。
Cause: The desktop restart command failed.
User action: Quit and relaunch Yanshi; check logs.
Developer notes: restartDesktopRuntime (Tauri command) error path.

## YANSHI_PROVIDER_001

Area: Provider · Severity: Warning
User message: No model provider configured.
中文提示：尚未配置模型服务。
Cause: Healthcheck reports `not_configured` (missing API key/model).
User action: Open Settings → LLM Providers and save a provider + key.
Developer notes: ProviderHealth.status === "not_configured".

## YANSHI_PROVIDER_002

Area: Provider · Severity: Error
User message: Provider test failed.
中文提示：服务商测试失败。
Cause: Healthcheck request failed or provider returned an error.
User action: Check base URL, model name, API key; retest.
Developer notes: ProviderHealth.status === "failed" or healthcheck request threw.

## YANSHI_PROVIDER_003

Area: Provider · Severity: Error
User message: Provider save failed.
中文提示：服务商保存失败。
Cause: PUT /settings/provider failed.
User action: Retry; check runtime connection.
Developer notes: saveProviderSettings catch.

## YANSHI_BROWSER_001

Area: Browser · Severity: Warning
User message: Browser engine missing.
中文提示：浏览器引擎缺失（缺少 Chromium）。
Cause: Playwright Chromium binaries are not provisioned for the runtime.
User action: Run `playwright install chromium` for the runtime, then retry.
Developer notes: missingRequirement `playwright_browser_binaries` (and browser_* requirement ids).

## YANSHI_COMPUTER_001

Area: Computer · Severity: Warning
User message: Accessibility permission is required for computer control.
中文提示：电脑控制需要 macOS 辅助功能权限。
Cause: macOS Accessibility not granted (or bridge unavailable).
User action: System Settings → Privacy & Security → Accessibility → enable Yanshi.
Developer notes: missingRequirement `macos_permissions` / `computer_use_control_bridge`.

## YANSHI_COMPUTER_002

Area: Computer · Severity: Warning
User message: Screen Recording permission is required for screenshots.
中文提示：截图需要 macOS 屏幕录制权限。
Cause: macOS Screen Recording not granted.
User action: System Settings → Privacy & Security → Screen Recording → enable Yanshi.
Developer notes: missingRequirement `macos_screencapture` / screen-capture failures.

## YANSHI_DOCKER_001

Area: Terminal/Docker · Severity: Warning
User message: Docker unavailable or misconfigured.
中文提示：Docker 不可用或配置有误。
Cause: Docker daemon/CLI missing, invalid sandbox config, or pull/exec timeout.
User action: Start Docker; check sandbox settings (Settings → Developer → Sandbox).
Developer notes: missingRequirement `docker_*` ids.

## YANSHI_FILE_001

Area: File · Severity: Error
User message: File upload failed.
中文提示：文件上传失败。
Cause: Workspace upload request failed (size/traversal guard or I/O).
User action: Retry with a smaller/valid file.
Developer notes: composer upload catch; runtime upload endpoint errors.

## YANSHI_FILE_002

Area: File/Library · Severity: Error
User message: Files or outputs could not be loaded.
中文提示：文件或输出未能加载。
Cause: Library artifact/file listing failed.
User action: Reopen Library; check runtime connection.
Developer notes: GET /artifacts or project files failure.

## YANSHI_WORKSHOP_001

Area: Workshop · Severity: Error
User message: Workshop import failed.
中文提示：扩展包导入失败。
Cause: Pack import/update request failed.
User action: Verify the pack file and retry.
Developer notes: importWorkshopPack / setWorkshopPackEnabled catch.

## YANSHI_WORKSHOP_002

Area: Workshop · Severity: Warning
User message: Unsafe Workshop pack rejected.
中文提示：不安全的扩展包已拦截。
Cause: Pack failed safety validation (400 from the validator).
User action: Only install trusted packs; fix the pack contents.
Developer notes: import error message matches /unsafe|rejected|validation/i.

## YANSHI_ATELIER_001

Area: Atelier · Severity: Error
User message: Yanshi Atelier could not render.
中文提示：偃师工坊无法渲染。
Cause: WebGL/render failure inside the Atelier canvas.
User action: Use Retry or the simplified view; reopen the window.
Developer notes: Atelier ErrorBoundary onError; WebGL probe and context handling in
error-boundary.tsx / FreeContextOnUnmount.

## YANSHI_ACP_001

Area: ACP · Severity: Error
User message: External Agent failed to start or connect.
中文提示：外部 Agent 未能启动或连接。
Cause: Launch command failed, handshake timed out, or connect/disconnect request failed.
User action: Check the command, arguments, and environment in Settings → External Agents.
Developer notes: connect/disconnectExternalAgent catch; agent.lastError carries the real reason.

## YANSHI_MCP_001

Area: MCP · Severity: Error
User message: MCP server configuration could not be saved.
中文提示：MCP 服务器配置未能保存。
Cause: PUT /settings/integrations failed.
User action: Retry; check runtime connection.
Developer notes: saveAiIntegrations catch (covers agents + servers persistence).

## YANSHI_SHORTCUT_001

Area: Shortcuts · Severity: Warning
User message: Shortcut conflict — combination already in use.
中文提示：快捷键冲突，该按键组合已被占用。
Cause: Captured chord collides with another in-app command.
User action: Choose Replace or Cancel in Keyboard Shortcuts.
Developer notes: validateBinding conflict path; nothing persists before explicit resolution.

## YANSHI_SHORTCUT_002

Area: Shortcuts · Severity: Warning
User message: Global shortcut could not be registered.
中文提示：全局快捷键未能在 macOS 注册。
Cause: OS-level ⌘Y registration failed (taken by another app).
User action: Free the combination or ignore (in-app shortcuts still work).
Developer notes: desktopStatus.missingRequirements includes a shortcut entry.

## YANSHI_SETTINGS_001

Area: Settings · Severity: Error
User message: Settings save failed.
中文提示：设置保存失败。
Cause: PUT /settings failed; optimistic value rolled back.
User action: Retry; check runtime connection.
Developer notes: saveAppSettings catch (state restored to pre-optimistic value).

## YANSHI_PROJECT_001

Area: Projects · Severity: Error
User message: Project could not be created or updated.
中文提示：项目未能创建或更新。
Cause: Project create/update/delete request failed (e.g. empty name 400).
User action: Adjust the input and retry.
Developer notes: createProject/updateProject/deleteProject catch.

## YANSHI_AUTOMATION_001

Area: Automations · Severity: Error
User message: Automation could not be saved or run.
中文提示：自动化未能保存或运行。
Cause: Automation CRUD/run-now request failed.
User action: Retry; check runtime connection.
Developer notes: automations feature API calls.

## YANSHI_UI_001

Area: UI · Severity: Error
User message: Something went wrong in the interface.
中文提示：界面发生异常，你的对话和数据是安全的。
Cause: Uncaught frontend render error contained by the root boundary, or a view that failed
to load (view areas show a neutral empty/retry state; the toast carries the error).
User action: Continue using the app; reload if the view stays broken.
Developer notes: root ErrorBoundary onError; full error logged to console.

## YANSHI_UNKNOWN_001

Area: Unknown · Severity: Error
User message: An unexpected error occurred.
中文提示：发生了意外错误。
Cause: A failure without a registered code (fallback mapping).
User action: Check logs if it persists.
Developer notes: resolveError fallback — add a proper code when a recurring source is found.
