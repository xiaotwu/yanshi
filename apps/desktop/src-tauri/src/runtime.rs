use serde::{Deserialize, Serialize};
use std::{
    env,
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    os::raw::{c_double, c_uchar, c_void},
    os::unix::process::CommandExt,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;

#[derive(Default)]
pub struct RuntimeState {
    child: Mutex<Option<Child>>,
    last_error: Mutex<Option<String>>,
    launch_mode: Mutex<Option<String>>,
    command_label: Mutex<Option<String>>,
    log_path: Mutex<Option<PathBuf>>,
    bridge: Mutex<Option<ComputerBridgeHandle>>,
    pub active_runs: Mutex<u32>,
}

/// Connection details for the in-process localhost Computer Use bridge server.
/// The token is a per-launch secret; the Python runtime must present it as a
/// bearer token on every request.
#[derive(Clone)]
pub struct ComputerBridgeHandle {
    url: String,
    token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRuntimeStatus {
    status: String,
    detail: String,
    launch_mode: String,
    runtime_url: String,
    log_path: Option<String>,
    command_label: Option<String>,
    last_error: Option<String>,
    missing_requirements: Vec<String>,
    repair_actions: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MacosPermissionStatus {
    accessibility: String,
    screen_recording: String,
    required_action: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerClickRequest {
    x: f64,
    y: f64,
    button: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerTypeRequest {
    text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerShortcutRequest {
    keys: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerOpenAppRequest {
    app_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputerBridgeResult {
    ok: bool,
    summary: String,
    missing_requirement: Option<String>,
    structured_output: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationRequest {
    title: String,
    body: String,
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy)]
struct CGPoint {
    x: c_double,
    y: c_double,
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> c_uchar;
    fn CGEventCreateMouseEvent(
        source: *const c_void,
        mouse_type: u32,
        mouse_cursor_position: CGPoint,
        mouse_button: u32,
    ) -> *mut c_void;
    fn CGEventCreateKeyboardEvent(source: *const c_void, virtual_key: u16, key_down: bool) -> *mut c_void;
    fn CGEventKeyboardSetUnicodeString(event: *mut c_void, string_length: usize, unicode_string: *const u16);
    fn CGEventSetFlags(event: *mut c_void, flags: u64);
    fn CGEventPost(tap: u32, event: *mut c_void);
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
}

#[cfg(target_os = "macos")]
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFRelease(cf: *mut c_void);
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum RuntimeLaunch {
    UvProject {
        project_path: PathBuf,
        mode: String,
        uv_path: PathBuf,
    },
    BundledSidecar {
        binary_path: PathBuf,
    },
    SetupRequired {
        missing: Vec<String>,
        detail: String,
    },
}

/// Outcome of probing 127.0.0.1:8765 before spawning the sidecar.
enum RuntimePort {
    /// Nothing is listening — safe to spawn our own sidecar.
    Free,
    /// A healthy Yanshi Runtime already owns the port — adopt it instead of spawning.
    Healthy,
    /// Some other process holds the port — fail loudly rather than queue dead runs.
    OccupiedUnhealthy,
}

fn probe_runtime_port() -> RuntimePort {
    // If we can bind the port, nothing is listening on it.
    if TcpListener::bind("127.0.0.1:8765").is_ok() {
        return RuntimePort::Free;
    }
    if runtime_health_ok() {
        RuntimePort::Healthy
    } else {
        RuntimePort::OccupiedUnhealthy
    }
}

/// Minimal blocking GET /health probe (no extra HTTP deps). A healthy Yanshi Runtime answers
/// HTTP 200 with `{"ok":true,...,"runtimeVersion":...}`.
fn runtime_health_ok() -> bool {
    use std::io::{Read, Write};
    use std::time::Duration;
    let Ok(mut stream) = TcpStream::connect("127.0.0.1:8765") else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1500)));
    if stream
        .write_all(b"GET /health HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut buf = String::new();
    let _ = stream.read_to_string(&mut buf);
    health_response_is_ok(&buf)
}

/// True only for an HTTP 200 response whose body is a healthy Yanshi Runtime `/health` payload.
fn health_response_is_ok(response: &str) -> bool {
    response.contains(" 200") && response.contains("\"ok\":true") && response.contains("runtimeVersion")
}

pub fn start_runtime(app: &AppHandle, state: &State<RuntimeState>) {
    let mut child_guard = state.child.lock().expect("runtime child mutex poisoned");
    if child_guard.is_some() {
        return;
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| home_fallback_data_dir());
    let log_path = data_dir.join("logs").join("runtime.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    *state.log_path.lock().expect("runtime log mutex poisoned") = Some(log_path.clone());

    let bridge = ensure_computer_bridge(state, &log_path);

    // Lifecycle guard: never spawn a second sidecar onto an occupied port (which would leave new
    // runs stuck at `created` against a stale runtime). Adopt a healthy one, or fail loudly.
    match probe_runtime_port() {
        RuntimePort::Free => {}
        RuntimePort::Healthy => {
            append_runtime_log(&log_path, "Adopted an existing healthy Yanshi Runtime on 127.0.0.1:8765.");
            *state.last_error.lock().expect("runtime error mutex poisoned") = None;
            *state.launch_mode.lock().expect("runtime mode mutex poisoned") = Some("adopted-runtime".into());
            *state.command_label.lock().expect("runtime command mutex poisoned") = None;
            return;
        }
        RuntimePort::OccupiedUnhealthy => {
            let detail = "Port 127.0.0.1:8765 is held by another process that is not a healthy Yanshi Runtime. Quit that process (or restart your Mac), then use Restart Runtime.".to_string();
            append_runtime_log(&log_path, &detail);
            *state.last_error.lock().expect("runtime error mutex poisoned") = Some(detail);
            *state.launch_mode.lock().expect("runtime mode mutex poisoned") = Some("port-conflict".into());
            *state.command_label.lock().expect("runtime command mutex poisoned") = None;
            return;
        }
    }

    let resource_dir = app.path().resource_dir().ok();
    let launch = resolve_runtime_launch(resource_dir.as_deref());
    match launch {
        RuntimeLaunch::UvProject {
            project_path,
            mode,
            uv_path,
        } => {
            let mut command = Command::new(&uv_path);
            command
                .arg("run")
                .arg("--project")
                .arg(&project_path)
                .arg("yanshi-runtime")
                .arg("--host")
                .arg("127.0.0.1")
                .arg("--port")
                .arg("8765")
                .arg("--data-dir")
                .arg(&data_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                // New process group so we can reliably kill the whole runtime tree (PyInstaller
                // onefile forks a child that holds the port) when the app quits.
                .process_group(0);
            inject_bridge_env(&mut command, bridge.as_ref());
            let command_label = format!(
                "{} run --project {} yanshi-runtime --host 127.0.0.1 --port 8765 --data-dir {}",
                uv_path.display(),
                project_path.display(),
                data_dir.display()
            );
            write_log_header(&log_path, &mode, &command_label);
            match command.spawn() {
                Ok(mut child) => {
                    pipe_child_logs(&mut child, log_path.clone());
                    *child_guard = Some(child);
                    *state.last_error.lock().expect("runtime error mutex poisoned") = None;
                    *state.launch_mode.lock().expect("runtime mode mutex poisoned") = Some(mode);
                    *state
                        .command_label
                        .lock()
                        .expect("runtime command mutex poisoned") = Some(command_label);
                }
                Err(error) => {
                    let detail = format!("Failed to start Yanshi Runtime: {error}");
                    append_runtime_log(&log_path, &detail);
                    *state.last_error.lock().expect("runtime error mutex poisoned") = Some(detail);
                    *state.launch_mode.lock().expect("runtime mode mutex poisoned") = Some("failed".into());
                    *state
                        .command_label
                        .lock()
                        .expect("runtime command mutex poisoned") = Some(command_label);
                }
            }
        }
        RuntimeLaunch::BundledSidecar { binary_path } => {
            let mut command = Command::new(&binary_path);
            command
                .arg("--host")
                .arg("127.0.0.1")
                .arg("--port")
                .arg("8765")
                .arg("--data-dir")
                .arg(&data_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                // New process group so we can reliably kill the whole runtime tree (PyInstaller
                // onefile forks a child that holds the port) when the app quits.
                .process_group(0);
            inject_bridge_env(&mut command, bridge.as_ref());
            let command_label = format!(
                "{} --host 127.0.0.1 --port 8765 --data-dir {}",
                binary_path.display(),
                data_dir.display()
            );
            write_log_header(&log_path, "bundled-sidecar", &command_label);
            match command.spawn() {
                Ok(mut child) => {
                    pipe_child_logs(&mut child, log_path.clone());
                    *child_guard = Some(child);
                    *state.last_error.lock().expect("runtime error mutex poisoned") = None;
                    *state.launch_mode.lock().expect("runtime mode mutex poisoned") =
                        Some("bundled-sidecar".into());
                    *state
                        .command_label
                        .lock()
                        .expect("runtime command mutex poisoned") = Some(command_label);
                }
                Err(error) => {
                    let detail = format!("Failed to start bundled Yanshi Runtime: {error}");
                    append_runtime_log(&log_path, &detail);
                    *state.last_error.lock().expect("runtime error mutex poisoned") = Some(detail);
                    *state.launch_mode.lock().expect("runtime mode mutex poisoned") = Some("failed".into());
                    *state
                        .command_label
                        .lock()
                        .expect("runtime command mutex poisoned") = Some(command_label);
                }
            }
        }
        RuntimeLaunch::SetupRequired { missing, detail } => {
            append_runtime_log(&log_path, &detail);
            *state.last_error.lock().expect("runtime error mutex poisoned") = Some(detail);
            *state.launch_mode.lock().expect("runtime mode mutex poisoned") =
                Some(format!("setup_required:{}", missing.join(",")));
            *state
                .command_label
                .lock()
                .expect("runtime command mutex poisoned") = None;
        }
    }
}

pub fn stop_runtime(state: &State<RuntimeState>) {
    let mut child_guard = state.child.lock().expect("runtime child mutex poisoned");
    if let Some(child) = child_guard.as_mut() {
        // The spawned process is the leader of its own process group (process_group(0)). Killing the
        // group terminates the PyInstaller bootloader AND the forked server that actually holds port
        // 8765, so the sidecar never orphans after the app quits.
        let pgid = child.id();
        let _ = child.kill();
        let _ = child.wait();
        let _ = Command::new("/bin/kill")
            .arg("-TERM")
            .arg(format!("-{pgid}"))
            .status();
        // Give it a moment, then force-kill any survivor in the group.
        let _ = Command::new("pkill").arg("-9").arg("-g").arg(pgid.to_string()).status();
    }
    *child_guard = None;
}

#[tauri::command]
pub fn runtime_status(state: State<RuntimeState>) -> DesktopRuntimeStatus {
    runtime_status_from_state(&state)
}

#[tauri::command]
pub fn restart_runtime(app: AppHandle, state: State<RuntimeState>) -> DesktopRuntimeStatus {
    stop_runtime(&state);
    start_runtime(&app, &state);
    runtime_status_from_state(&state)
}

#[tauri::command]
pub fn macos_permission_status() -> MacosPermissionStatus {
    MacosPermissionStatus {
        accessibility: permission_state(macos_accessibility_trusted()),
        screen_recording: permission_state(macos_screen_recording_trusted()),
        required_action: "System Settings > Privacy & Security".into(),
    }
}

#[tauri::command]
pub fn computer_click(request: ComputerClickRequest) -> ComputerBridgeResult {
    run_computer_click(request)
}

fn run_computer_click(request: ComputerClickRequest) -> ComputerBridgeResult {
    if !request.x.is_finite() || !request.y.is_finite() || request.x < 0.0 || request.y < 0.0 {
        return bridge_error(
            "Computer click needs finite non-negative screen coordinates.",
            "computer_click_coordinates",
            serde_json::json!({"x": request.x, "y": request.y}),
        );
    }
    let Some(button) = mouse_button_from_request(request.button.as_deref()) else {
        return bridge_error(
            "Computer click supports left, right, or center mouse buttons.",
            "computer_click_button",
            serde_json::json!({"button": request.button}),
        );
    };
    if let Some(result) = accessibility_requirement() {
        return result;
    }
    perform_click(request.x, request.y, button)
}

#[tauri::command]
pub fn computer_type(request: ComputerTypeRequest) -> ComputerBridgeResult {
    run_computer_type(request)
}

fn run_computer_type(request: ComputerTypeRequest) -> ComputerBridgeResult {
    if request.text.is_empty() {
        return bridge_error(
            "Computer type needs non-empty text.",
            "computer_type_text",
            serde_json::json!({}),
        );
    }
    if request.text.chars().count() > 4_000 {
        return bridge_error(
            "Computer type text is too long for one desktop action.",
            "computer_type_text_too_large",
            serde_json::json!({"maxCharacters": 4000}),
        );
    }
    if let Some(result) = accessibility_requirement() {
        return result;
    }
    perform_type(&request.text)
}

#[tauri::command]
pub fn computer_shortcut(request: ComputerShortcutRequest) -> ComputerBridgeResult {
    run_computer_shortcut(request)
}

fn run_computer_shortcut(request: ComputerShortcutRequest) -> ComputerBridgeResult {
    if request.keys.is_empty() {
        return bridge_error(
            "Computer shortcut needs at least one key.",
            "computer_shortcut_keys",
            serde_json::json!({}),
        );
    }
    let Some((flags, key_code, normalized_keys)) = parse_shortcut(&request.keys) else {
        return bridge_error(
            "Computer shortcut supports one non-modifier key plus optional Command, Control, Option, and Shift modifiers.",
            "computer_shortcut_unsupported",
            serde_json::json!({"keys": request.keys}),
        );
    };
    if let Some(result) = accessibility_requirement() {
        return result;
    }
    perform_shortcut(flags, key_code, normalized_keys)
}

#[tauri::command]
pub fn computer_open_app(request: ComputerOpenAppRequest) -> ComputerBridgeResult {
    run_computer_open_app(request)
}

fn run_computer_open_app(request: ComputerOpenAppRequest) -> ComputerBridgeResult {
    let app_name = request.app_name.trim();
    if app_name.is_empty() {
        return bridge_error(
            "Computer open app needs an application name.",
            "computer_open_app_name",
            serde_json::json!({}),
        );
    }
    if app_name.contains('/') || app_name.contains('\0') {
        return bridge_error(
            "Computer open app accepts an application name, not a filesystem path.",
            "computer_open_app_name",
            serde_json::json!({"appName": app_name}),
        );
    }
    match Command::new("open").arg("-a").arg(app_name).output() {
        Ok(output) if output.status.success() => ComputerBridgeResult {
            ok: true,
            summary: format!("Computer bridge opened {app_name}."),
            missing_requirement: None,
            structured_output: serde_json::json!({
                "operation": "openApp",
                "appName": app_name,
                "returnCode": output.status.code(),
            }),
        },
        Ok(output) => bridge_error(
            &format!("Computer bridge could not open {app_name}."),
            "computer_open_app_failed",
            serde_json::json!({
                "operation": "openApp",
                "appName": app_name,
                "returnCode": output.status.code(),
                "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
            }),
        ),
        Err(error) => bridge_error(
            "Computer bridge needs the macOS open command.",
            "macos_open_command",
            serde_json::json!({"error": error.to_string()}),
        ),
    }
}

fn ensure_computer_bridge(state: &State<RuntimeState>, log_path: &Path) -> Option<ComputerBridgeHandle> {
    let mut guard = state.bridge.lock().expect("runtime bridge mutex poisoned");
    if let Some(handle) = guard.as_ref() {
        return Some(handle.clone());
    }
    match start_computer_bridge() {
        Ok(handle) => {
            append_runtime_log(log_path, &format!("computer bridge listening at {}", handle.url));
            *guard = Some(handle.clone());
            Some(handle)
        }
        Err(error) => {
            append_runtime_log(log_path, &format!("computer bridge failed to start: {error}"));
            None
        }
    }
}

fn inject_bridge_env(command: &mut Command, bridge: Option<&ComputerBridgeHandle>) {
    if let Some(bridge) = bridge {
        command.env("YANSHI_COMPUTER_BRIDGE_URL", &bridge.url);
        command.env("YANSHI_COMPUTER_BRIDGE_TOKEN", &bridge.token);
    }
}

/// Start a localhost-only HTTP server that performs native Computer Use actions.
/// The Python runtime reaches it via `YANSHI_COMPUTER_BRIDGE_URL` and must
/// present the per-launch bearer token. Binding to `127.0.0.1:0` lets the OS
/// pick a free port that we report back to the runtime.
fn start_computer_bridge() -> std::io::Result<ComputerBridgeHandle> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let token = random_bridge_token();
    let handle = ComputerBridgeHandle {
        url: format!("http://127.0.0.1:{port}"),
        token: token.clone(),
    };
    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            let token = token.clone();
            thread::spawn(move || {
                let _ = serve_bridge_connection(stream, &token);
            });
        }
    });
    Ok(handle)
}

fn serve_bridge_connection(mut stream: TcpStream, token: &str) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);

    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("").to_string();

    let mut content_length = 0usize;
    let mut authorization: Option<String> = None;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 {
            break;
        }
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            break;
        }
        if let Some((name, value)) = trimmed.split_once(':') {
            match name.trim().to_ascii_lowercase().as_str() {
                "content-length" => content_length = value.trim().parse().unwrap_or(0),
                "authorization" => authorization = Some(value.trim().to_string()),
                _ => {}
            }
        }
    }

    let mut body_bytes = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body_bytes)?;
    }

    if !authorize_bridge_request(token, authorization.as_deref()) {
        return write_bridge_response(
            &mut stream,
            401,
            &serde_json::json!({
                "ok": false,
                "summary": "Computer bridge rejected an unauthorized request.",
                "missingRequirement": "computer_use_control_bridge_unauthorized",
                "structuredOutput": {},
            }),
        );
    }

    if method != "POST" {
        return write_bridge_response(
            &mut stream,
            405,
            &serde_json::json!({
                "ok": false,
                "summary": "Computer bridge only accepts POST requests.",
                "missingRequirement": "computer_use_method_not_allowed",
                "structuredOutput": {"method": method},
            }),
        );
    }

    let Some(operation) = operation_from_path(&target) else {
        return write_bridge_response(
            &mut stream,
            404,
            &serde_json::json!({
                "ok": false,
                "summary": "Computer bridge does not recognize that path.",
                "missingRequirement": "computer_use_unknown_operation",
                "structuredOutput": {"path": target},
            }),
        );
    };

    let body_value: serde_json::Value = if body_bytes.is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_slice(&body_bytes).unwrap_or_else(|_| serde_json::json!({}))
    };

    match dispatch_bridge_operation(operation, &body_value) {
        Some(result) => write_bridge_response(
            &mut stream,
            200,
            &serde_json::to_value(&result).unwrap_or_else(|_| serde_json::json!({})),
        ),
        None => write_bridge_response(
            &mut stream,
            404,
            &serde_json::json!({
                "ok": false,
                "summary": format!("Computer bridge does not support operation: {operation}."),
                "missingRequirement": "computer_use_unknown_operation",
                "structuredOutput": {"operation": operation},
            }),
        ),
    }
}

fn authorize_bridge_request(expected_token: &str, header: Option<&str>) -> bool {
    let Some(value) = header else {
        return false;
    };
    let provided = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "));
    match provided {
        Some(token) => constant_time_eq(token.trim().as_bytes(), expected_token.as_bytes()),
        None => false,
    }
}

fn operation_from_path(target: &str) -> Option<&str> {
    let path = target.split('?').next().unwrap_or(target);
    let operation = path.strip_prefix("/computer/")?;
    match operation {
        "click" | "type" | "shortcut" | "open-app" => Some(operation),
        _ => None,
    }
}

fn dispatch_bridge_operation(operation: &str, body: &serde_json::Value) -> Option<ComputerBridgeResult> {
    match operation {
        "click" => Some(parse_bridge_body(body).map_or_else(|err| err, run_computer_click)),
        "type" => Some(parse_bridge_body(body).map_or_else(|err| err, run_computer_type)),
        "shortcut" => Some(parse_bridge_body(body).map_or_else(|err| err, run_computer_shortcut)),
        "open-app" => Some(parse_bridge_body(body).map_or_else(|err| err, run_computer_open_app)),
        _ => None,
    }
}

fn parse_bridge_body<T: serde::de::DeserializeOwned>(
    body: &serde_json::Value,
) -> Result<T, ComputerBridgeResult> {
    serde_json::from_value(body.clone()).map_err(|error| {
        bridge_error(
            "Computer bridge received an invalid request body.",
            "computer_use_invalid_request",
            serde_json::json!({"error": error.to_string()}),
        )
    })
}

fn write_bridge_response(stream: &mut TcpStream, status: u16, body: &serde_json::Value) -> std::io::Result<()> {
    let payload = serde_json::to_vec(body).unwrap_or_else(|_| b"{}".to_vec());
    let reason = match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "OK",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        payload.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(&payload)?;
    stream.flush()
}

fn random_bridge_token() -> String {
    let mut bytes = [0u8; 32];
    if read_random_bytes(&mut bytes).is_ok() {
        return hex_encode(&bytes);
    }
    // Fallback when /dev/urandom is unavailable: still unique per launch.
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    for (index, slot) in bytes.iter_mut().enumerate() {
        let mixed = nanos
            .wrapping_add((index as u128).wrapping_mul(0x9E37_79B9))
            .wrapping_add(pid as u128);
        *slot = (mixed >> ((index % 16) * 4)) as u8 ^ (pid as u8).wrapping_add(index as u8);
    }
    hex_encode(&bytes)
}

fn read_random_bytes(buffer: &mut [u8]) -> std::io::Result<()> {
    let mut file = File::open("/dev/urandom")?;
    file.read_exact(buffer)
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn permission_state(granted: bool) -> String {
    if granted {
        "granted".into()
    } else {
        "permission_required".into()
    }
}

#[cfg(target_os = "macos")]
fn macos_accessibility_trusted() -> bool {
    unsafe { AXIsProcessTrusted() != 0 }
}

#[cfg(not(target_os = "macos"))]
fn macos_accessibility_trusted() -> bool {
    false
}

#[cfg(target_os = "macos")]
fn macos_screen_recording_trusted() -> bool {
    unsafe { CGPreflightScreenCaptureAccess() }
}

#[cfg(not(target_os = "macos"))]
fn macos_screen_recording_trusted() -> bool {
    false
}

fn accessibility_requirement() -> Option<ComputerBridgeResult> {
    if macos_accessibility_trusted() {
        return None;
    }
    Some(bridge_error(
        "Computer Use requires macOS Accessibility permission before control actions can run.",
        "macos_accessibility",
        serde_json::json!({
            "required": ["Accessibility"],
            "path": "System Settings > Privacy & Security"
        }),
    ))
}

fn bridge_error(summary: &str, missing_requirement: &str, structured_output: serde_json::Value) -> ComputerBridgeResult {
    ComputerBridgeResult {
        ok: false,
        summary: summary.into(),
        missing_requirement: Some(missing_requirement.into()),
        structured_output,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MouseButton {
    Left,
    Right,
    Center,
}

fn mouse_button_from_request(button: Option<&str>) -> Option<MouseButton> {
    match button.unwrap_or("left").trim().to_lowercase().as_str() {
        "left" => Some(MouseButton::Left),
        "right" => Some(MouseButton::Right),
        "center" | "middle" => Some(MouseButton::Center),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn perform_click(x: f64, y: f64, button: MouseButton) -> ComputerBridgeResult {
    let (down_event, up_event, cg_button) = match button {
        MouseButton::Left => (1, 2, 0),
        MouseButton::Right => (3, 4, 1),
        MouseButton::Center => (25, 26, 2),
    };
    let point = CGPoint { x, y };
    unsafe {
        let down = CGEventCreateMouseEvent(std::ptr::null(), down_event, point, cg_button);
        let up = CGEventCreateMouseEvent(std::ptr::null(), up_event, point, cg_button);
        if down.is_null() || up.is_null() {
            if !down.is_null() {
                CFRelease(down);
            }
            if !up.is_null() {
                CFRelease(up);
            }
            return bridge_error(
                "Computer bridge could not create mouse events.",
                "computer_click_event",
                serde_json::json!({"x": x, "y": y}),
            );
        }
        CGEventPost(0, down);
        CGEventPost(0, up);
        CFRelease(down);
        CFRelease(up);
    }
    ComputerBridgeResult {
        ok: true,
        summary: format!("Computer bridge clicked at {x}, {y}."),
        missing_requirement: None,
        structured_output: serde_json::json!({
            "operation": "click",
            "x": x,
            "y": y,
            "button": format!("{button:?}").to_lowercase(),
        }),
    }
}

#[cfg(not(target_os = "macos"))]
fn perform_click(x: f64, y: f64, button: MouseButton) -> ComputerBridgeResult {
    let _ = (x, y, button);
    bridge_error("Computer control requires macOS.", "macos_required", serde_json::json!({}))
}

#[cfg(target_os = "macos")]
fn perform_type(text: &str) -> ComputerBridgeResult {
    for unit in text.encode_utf16() {
        unsafe {
            let down = CGEventCreateKeyboardEvent(std::ptr::null(), 0, true);
            let up = CGEventCreateKeyboardEvent(std::ptr::null(), 0, false);
            if down.is_null() || up.is_null() {
                if !down.is_null() {
                    CFRelease(down);
                }
                if !up.is_null() {
                    CFRelease(up);
                }
                return bridge_error(
                    "Computer bridge could not create keyboard events.",
                    "computer_type_event",
                    serde_json::json!({}),
                );
            }
            CGEventKeyboardSetUnicodeString(down, 1, &unit);
            CGEventKeyboardSetUnicodeString(up, 1, &unit);
            CGEventPost(0, down);
            CGEventPost(0, up);
            CFRelease(down);
            CFRelease(up);
        }
    }
    ComputerBridgeResult {
        ok: true,
        summary: format!("Computer bridge typed {} character(s).", text.chars().count()),
        missing_requirement: None,
        structured_output: serde_json::json!({
            "operation": "type",
            "characters": text.chars().count(),
        }),
    }
}

#[cfg(not(target_os = "macos"))]
fn perform_type(text: &str) -> ComputerBridgeResult {
    let _ = text;
    bridge_error("Computer control requires macOS.", "macos_required", serde_json::json!({}))
}

#[cfg(target_os = "macos")]
fn perform_shortcut(flags: u64, key_code: u16, normalized_keys: Vec<String>) -> ComputerBridgeResult {
    unsafe {
        let down = CGEventCreateKeyboardEvent(std::ptr::null(), key_code, true);
        let up = CGEventCreateKeyboardEvent(std::ptr::null(), key_code, false);
        if down.is_null() || up.is_null() {
            if !down.is_null() {
                CFRelease(down);
            }
            if !up.is_null() {
                CFRelease(up);
            }
            return bridge_error(
                "Computer bridge could not create shortcut events.",
                "computer_shortcut_event",
                serde_json::json!({"keys": normalized_keys}),
            );
        }
        CGEventSetFlags(down, flags);
        CGEventSetFlags(up, flags);
        CGEventPost(0, down);
        CGEventPost(0, up);
        CFRelease(down);
        CFRelease(up);
    }
    ComputerBridgeResult {
        ok: true,
        summary: format!("Computer bridge sent shortcut {}.", normalized_keys.join("+")),
        missing_requirement: None,
        structured_output: serde_json::json!({
            "operation": "shortcut",
            "keys": normalized_keys,
        }),
    }
}

#[cfg(not(target_os = "macos"))]
fn perform_shortcut(flags: u64, key_code: u16, normalized_keys: Vec<String>) -> ComputerBridgeResult {
    let _ = (flags, key_code, normalized_keys);
    bridge_error("Computer control requires macOS.", "macos_required", serde_json::json!({}))
}

const FLAG_MASK_SHIFT: u64 = 0x0002_0000;
const FLAG_MASK_CONTROL: u64 = 0x0004_0000;
const FLAG_MASK_ALTERNATE: u64 = 0x0008_0000;
const FLAG_MASK_COMMAND: u64 = 0x0010_0000;

fn parse_shortcut(keys: &[String]) -> Option<(u64, u16, Vec<String>)> {
    let mut flags = 0_u64;
    let mut key_code: Option<u16> = None;
    let mut normalized = Vec::with_capacity(keys.len());
    for key in keys {
        let key = key.trim().to_lowercase();
        if key.is_empty() {
            return None;
        }
        match key.as_str() {
            "cmd" | "command" | "meta" => {
                flags |= FLAG_MASK_COMMAND;
                normalized.push("command".into());
            }
            "ctrl" | "control" => {
                flags |= FLAG_MASK_CONTROL;
                normalized.push("control".into());
            }
            "option" | "alt" => {
                flags |= FLAG_MASK_ALTERNATE;
                normalized.push("option".into());
            }
            "shift" => {
                flags |= FLAG_MASK_SHIFT;
                normalized.push("shift".into());
            }
            _ => {
                if key_code.is_some() {
                    return None;
                }
                let code = key_code_for(&key)?;
                key_code = Some(code);
                normalized.push(key);
            }
        }
    }
    Some((flags, key_code?, normalized))
}

fn key_code_for(key: &str) -> Option<u16> {
    match key {
        "a" => Some(0),
        "s" => Some(1),
        "d" => Some(2),
        "f" => Some(3),
        "h" => Some(4),
        "g" => Some(5),
        "z" => Some(6),
        "x" => Some(7),
        "c" => Some(8),
        "v" => Some(9),
        "b" => Some(11),
        "q" => Some(12),
        "w" => Some(13),
        "e" => Some(14),
        "r" => Some(15),
        "y" => Some(16),
        "t" => Some(17),
        "1" => Some(18),
        "2" => Some(19),
        "3" => Some(20),
        "4" => Some(21),
        "6" => Some(22),
        "5" => Some(23),
        "=" | "equals" => Some(24),
        "9" => Some(25),
        "7" => Some(26),
        "-" | "minus" => Some(27),
        "8" => Some(28),
        "0" => Some(29),
        "]" | "rightbracket" => Some(30),
        "o" => Some(31),
        "u" => Some(32),
        "[" | "leftbracket" => Some(33),
        "i" => Some(34),
        "p" => Some(35),
        "return" | "enter" => Some(36),
        "l" => Some(37),
        "j" => Some(38),
        "'" | "quote" => Some(39),
        "k" => Some(40),
        ";" | "semicolon" => Some(41),
        "\\" | "backslash" => Some(42),
        "," | "comma" => Some(43),
        "/" | "slash" => Some(44),
        "n" => Some(45),
        "m" => Some(46),
        "." | "period" => Some(47),
        "tab" => Some(48),
        "space" => Some(49),
        "`" | "grave" => Some(50),
        "delete" | "backspace" => Some(51),
        "escape" | "esc" => Some(53),
        "left" | "arrowleft" => Some(123),
        "right" | "arrowright" => Some(124),
        "down" | "arrowdown" => Some(125),
        "up" | "arrowup" => Some(126),
        _ => None,
    }
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("A file path is required.".into());
    }
    if !Path::new(&path).exists() {
        return Err("That file is no longer on disk.".into());
    }
    Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not reveal file: {error}"))
}

#[tauri::command]
pub fn open_runtime_logs(state: State<RuntimeState>) -> Result<(), String> {
    let log_path = state
        .log_path
        .lock()
        .map_err(|_| "runtime log mutex poisoned".to_string())?
        .clone()
        .ok_or_else(|| "Runtime log path is not available yet.".to_string())?;
    Command::new("open")
        .arg(&log_path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open runtime log: {error}"))
}

#[tauri::command]
pub fn update_active_runs(count: u32, state: State<RuntimeState>) {
    *state.active_runs.lock().expect("active runs mutex poisoned") = count;
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available.".to_string())?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    // Terminate the sidecar we own before exiting so it never orphans on port 8765.
    let state = app.state::<RuntimeState>();
    stop_runtime(&state);
    app.exit(0);
}

#[tauri::command]
pub fn open_yanshi(app: AppHandle) -> Result<(), String> {
    show_main_window(&app)
}

#[tauri::command]
pub fn open_live_office(app: AppHandle) -> Result<(), String> {
    show_main_window(&app)?;
    app.emit("desktop:open-live-office", ())
        .map_err(|error| format!("Could not open Live Office: {error}"))
}

#[tauri::command]
pub fn pop_out_live_office(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live-office") {
        window.unminimize().map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        return window.set_focus().map_err(|error| error.to_string());
    }
    let window = WebviewWindowBuilder::new(
        &app,
        "live-office",
        WebviewUrl::App("index.html?liveOffice=1".into()),
    )
    .title("Yanshi Live Office")
    .inner_size(960.0, 720.0)
    .min_inner_size(720.0, 520.0)
    .always_on_top(true)
    .build()
    .map_err(|error| format!("Could not create Live Office window: {error}"))?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn desktop_notify(app: AppHandle, request: DesktopNotificationRequest) -> Result<(), String> {
    if request.title.trim().is_empty() {
        return Err("Notification title is required.".into());
    }
    app.notification()
        .builder()
        .title(request.title)
        .body(request.body)
        .show()
        .map_err(|error| format!("Could not send notification: {error}"))
}

pub fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available.".to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn runtime_status_from_state(state: &State<RuntimeState>) -> DesktopRuntimeStatus {
    let mut child_guard = state.child.lock().expect("runtime child mutex poisoned");
    let last_error = state
        .last_error
        .lock()
        .expect("runtime error mutex poisoned")
        .clone();
    let launch_mode = state
        .launch_mode
        .lock()
        .expect("runtime mode mutex poisoned")
        .clone()
        .unwrap_or_else(|| "not_started".into());
    let log_path = state
        .log_path
        .lock()
        .expect("runtime log mutex poisoned")
        .clone()
        .map(|path| path.to_string_lossy().to_string());
    let command_label = state
        .command_label
        .lock()
        .expect("runtime command mutex poisoned")
        .clone();

    if let Some(child) = child_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(status)) => {
                *child_guard = None;
                DesktopRuntimeStatus {
                    status: "failed".into(),
                    detail: format!("Runtime exited with {status}."),
                    launch_mode,
                    runtime_url: "http://127.0.0.1:8765".into(),
                    log_path,
                    command_label,
                    last_error,
                    missing_requirements: vec![],
                    repair_actions: runtime_repair_actions(),
                }
            }
            Ok(None) => DesktopRuntimeStatus {
                status: "running".into(),
                detail: "Runtime sidecar process is running.".into(),
                launch_mode,
                runtime_url: "http://127.0.0.1:8765".into(),
                log_path,
                command_label,
                last_error,
                missing_requirements: vec![],
                repair_actions: vec!["Restart Runtime".into(), "Open Logs".into()],
            },
            Err(error) => DesktopRuntimeStatus {
                status: "failed".into(),
                detail: error.to_string(),
                launch_mode,
                runtime_url: "http://127.0.0.1:8765".into(),
                log_path,
                command_label,
                last_error,
                missing_requirements: vec![],
                repair_actions: runtime_repair_actions(),
            },
        }
    } else if launch_mode == "adopted-runtime" {
        // We did not spawn a child but a healthy runtime owns the port — report it as running.
        DesktopRuntimeStatus {
            status: "running".into(),
            detail: "Attached to an existing Yanshi Runtime on 127.0.0.1:8765.".into(),
            launch_mode,
            runtime_url: "http://127.0.0.1:8765".into(),
            log_path,
            command_label,
            last_error,
            missing_requirements: vec![],
            repair_actions: vec!["Restart Runtime".into(), "Open Logs".into()],
        }
    } else if launch_mode == "port-conflict" {
        DesktopRuntimeStatus {
            status: "failed".into(),
            detail: last_error.clone().unwrap_or_else(|| "Runtime port is in use.".into()),
            launch_mode,
            runtime_url: "http://127.0.0.1:8765".into(),
            log_path,
            command_label,
            last_error,
            missing_requirements: vec![],
            repair_actions: runtime_repair_actions(),
        }
    } else {
        let missing = parse_missing_requirements(&launch_mode);
        DesktopRuntimeStatus {
            status: if missing.is_empty() {
                "stopped".into()
            } else {
                "setup_required".into()
            },
            detail: last_error.clone().unwrap_or_else(|| "Runtime sidecar is not running.".into()),
            launch_mode,
            runtime_url: "http://127.0.0.1:8765".into(),
            log_path,
            command_label,
            last_error,
            missing_requirements: missing,
            repair_actions: runtime_repair_actions(),
        }
    }
}

fn resolve_runtime_launch(resource_dir: Option<&Path>) -> RuntimeLaunch {
    if let Ok(project) = env::var("YANSHI_RUNTIME_PROJECT") {
        let project_path = PathBuf::from(project);
        match resolve_uv_binary() {
            Some(uv_path) if project_path.join("pyproject.toml").exists() => {
                return RuntimeLaunch::UvProject {
                    project_path,
                    mode: "env-runtime-project".into(),
                    uv_path,
                };
            }
            Some(_) => {
                return RuntimeLaunch::SetupRequired {
                    missing: vec!["runtime_project".into()],
                    detail: "YANSHI_RUNTIME_PROJECT is set, but it does not point to a Python runtime project with pyproject.toml.".into(),
                };
            }
            None => {
                return RuntimeLaunch::SetupRequired {
                    missing: vec!["uv".into()],
                    detail: "Yanshi Runtime needs uv installed when using YANSHI_RUNTIME_PROJECT.".into(),
                };
            }
        }
    }

    if let Some(resource_dir) = resource_dir {
        for candidate in bundled_sidecar_candidates(resource_dir) {
            if candidate.exists() {
                return RuntimeLaunch::BundledSidecar {
                    binary_path: candidate,
                };
            }
        }
        let bundled_project = resource_dir.join("runtime").join("python");
        if bundled_project.join("pyproject.toml").exists() {
            if let Some(uv_path) = resolve_uv_binary() {
                return RuntimeLaunch::UvProject {
                    project_path: bundled_project,
                    mode: "bundled-python-project".into(),
                    uv_path,
                };
            }
            return RuntimeLaunch::SetupRequired {
                missing: vec!["uv".into()],
                detail: "Bundled runtime project found, but uv is not installed. Install uv or package a standalone Yanshi Runtime sidecar.".into(),
            };
        }
    }

    #[cfg(debug_assertions)]
    {
        let dev_project = repo_runtime_project();
        if dev_project.join("pyproject.toml").exists() {
            if let Some(uv_path) = resolve_uv_binary() {
                return RuntimeLaunch::UvProject {
                    project_path: dev_project,
                    mode: "dev-repo-runtime".into(),
                    uv_path,
                };
            }
            return RuntimeLaunch::SetupRequired {
                missing: vec!["uv".into()],
                detail: "Development runtime found, but uv is not installed or not in PATH.".into(),
            };
        }
    }

    RuntimeLaunch::SetupRequired {
        missing: vec!["runtime_sidecar".into()],
        detail: "Packaged Yanshi does not contain a standalone Python runtime sidecar yet. Set YANSHI_RUNTIME_PROJECT to a valid runtime/python directory with uv installed, or install a packaged Yanshi Runtime sidecar.".into(),
    }
}

fn bundled_sidecar_candidates(resource_dir: &Path) -> Vec<PathBuf> {
    vec![
        resource_dir.join("yanshi-runtime-sidecar"),
        resource_dir.join("bin").join("yanshi-runtime-sidecar"),
        resource_dir.join("runtime").join("yanshi-runtime-sidecar"),
        resource_dir.join("resources").join("yanshi-runtime-sidecar"),
    ]
}

fn resolve_uv_binary() -> Option<PathBuf> {
    if let Ok(uv) = env::var("UV") {
        let path = PathBuf::from(uv);
        if path.exists() {
            return Some(path);
        }
    }
    let path_var = env::var_os("PATH")?;
    env::split_paths(&path_var)
        .map(|path| path.join("uv"))
        .find(|candidate| candidate.exists())
}

#[cfg(debug_assertions)]
fn repo_runtime_project() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .map(|path| path.join("runtime").join("python"))
        .unwrap_or_else(|| PathBuf::from("runtime/python"))
}

fn home_fallback_data_dir() -> PathBuf {
    env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".yanshi")
}

fn write_log_header(log_path: &Path, mode: &str, command_label: &str) {
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "\n=== Yanshi Runtime launch ===");
        let _ = writeln!(file, "mode={mode}");
        let _ = writeln!(file, "command={command_label}");
    }
}

fn append_runtime_log(log_path: &Path, line: &str) {
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "{line}");
    }
}

fn pipe_child_logs(child: &mut Child, log_path: PathBuf) {
    if let Some(stdout) = child.stdout.take() {
        let stdout_log_path = log_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            append_stream_to_log(reader, stdout_log_path, "stdout");
        });
    }
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            append_stream_to_log(reader, log_path, "stderr");
        });
    }
}

fn append_stream_to_log<R: BufRead>(reader: R, log_path: PathBuf, stream: &str) {
    let file_result: std::io::Result<File> = OpenOptions::new().create(true).append(true).open(log_path);
    let Ok(mut file) = file_result else {
        return;
    };
    for line in reader.lines().map_while(Result::ok) {
        let _ = writeln!(file, "[{stream}] {line}");
    }
}

fn parse_missing_requirements(launch_mode: &str) -> Vec<String> {
    launch_mode
        .strip_prefix("setup_required:")
        .map(|rest| {
            rest.split(',')
                .filter(|item| !item.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn runtime_repair_actions() -> Vec<String> {
    vec![
        "Restart Runtime".into(),
        "Open Logs".into(),
        "Check Python Environment".into(),
        "Install Yanshi Runtime".into(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_setup_missing_requirements() {
        assert_eq!(
            parse_missing_requirements("setup_required:uv,runtime_sidecar"),
            vec!["uv".to_string(), "runtime_sidecar".to_string()]
        );
        assert!(parse_missing_requirements("dev-repo-runtime").is_empty());
    }

    #[test]
    fn health_probe_accepts_only_healthy_yanshi_runtime() {
        let healthy = "HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n\r\n{\"ok\":true,\"runtimeVersion\":\"0.1.0\",\"databasePath\":\"/tmp/yanshi.db\"}";
        assert!(health_response_is_ok(healthy));
        // Wrong status, missing fields, or a non-Yanshi server must be rejected (fail loudly).
        assert!(!health_response_is_ok("HTTP/1.1 503 Service Unavailable\r\n\r\n{}"));
        assert!(!health_response_is_ok("HTTP/1.0 200 OK\r\n\r\n{\"ok\":false}"));
        assert!(!health_response_is_ok("HTTP/1.0 200 OK\r\n\r\n<html>nginx</html>"));
    }

    #[test]
    fn bundled_sidecar_candidates_include_runtime_locations() {
        let root = PathBuf::from("/tmp/resources");
        let candidates = bundled_sidecar_candidates(&root);
        assert!(candidates.contains(&root.join("yanshi-runtime-sidecar")));
        assert!(candidates.contains(&root.join("bin").join("yanshi-runtime-sidecar")));
        assert!(candidates.contains(&root.join("runtime").join("yanshi-runtime-sidecar")));
    }

    #[test]
    fn parses_supported_desktop_shortcuts() {
        let keys = vec!["Cmd".to_string(), "Shift".to_string(), "Y".to_string()];
        let (flags, key_code, normalized) = parse_shortcut(&keys).expect("shortcut should parse");
        assert_eq!(flags, FLAG_MASK_COMMAND | FLAG_MASK_SHIFT);
        assert_eq!(key_code, 16);
        assert_eq!(normalized, vec!["command", "shift", "y"]);
    }

    #[test]
    fn rejects_shortcuts_with_multiple_non_modifier_keys() {
        let keys = vec!["Command".to_string(), "Y".to_string(), "K".to_string()];
        assert!(parse_shortcut(&keys).is_none());
    }

    #[test]
    fn validates_mouse_button_names() {
        assert_eq!(mouse_button_from_request(None), Some(MouseButton::Left));
        assert_eq!(mouse_button_from_request(Some("right")), Some(MouseButton::Right));
        assert_eq!(mouse_button_from_request(Some("middle")), Some(MouseButton::Center));
        assert_eq!(mouse_button_from_request(Some("side")), None);
    }

    #[test]
    fn authorizes_only_matching_bearer_tokens() {
        assert!(authorize_bridge_request("secret", Some("Bearer secret")));
        assert!(authorize_bridge_request("secret", Some("bearer secret")));
        assert!(!authorize_bridge_request("secret", Some("Bearer nope")));
        assert!(!authorize_bridge_request("secret", Some("secret")));
        assert!(!authorize_bridge_request("secret", None));
    }

    #[test]
    fn maps_only_supported_bridge_operations() {
        assert_eq!(operation_from_path("/computer/click"), Some("click"));
        assert_eq!(operation_from_path("/computer/open-app?x=1"), Some("open-app"));
        assert_eq!(operation_from_path("/computer/teleport"), None);
        assert_eq!(operation_from_path("/computer/click/extra"), None);
        assert_eq!(operation_from_path("/health"), None);
    }

    #[test]
    fn dispatch_validates_body_before_native_action() {
        // Unknown operation -> no result (server answers 404).
        assert!(dispatch_bridge_operation("teleport", &serde_json::json!({})).is_none());

        // Validation failures are deterministic and happen before any permission/native call.
        let click = dispatch_bridge_operation("click", &serde_json::json!({"x": -1, "y": 5}))
            .expect("known operation returns a result");
        assert!(!click.ok);
        assert_eq!(click.missing_requirement.as_deref(), Some("computer_click_coordinates"));

        let empty_type = dispatch_bridge_operation("type", &serde_json::json!({"text": ""}))
            .expect("known operation returns a result");
        assert!(!empty_type.ok);
        assert_eq!(empty_type.missing_requirement.as_deref(), Some("computer_type_text"));

        let bad_body = dispatch_bridge_operation("type", &serde_json::json!({"text": 5}))
            .expect("known operation returns a result");
        assert!(!bad_body.ok);
        assert_eq!(bad_body.missing_requirement.as_deref(), Some("computer_use_invalid_request"));
    }

    #[test]
    fn random_tokens_are_hex_and_unique() {
        let first = random_bridge_token();
        let second = random_bridge_token();
        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }

    #[test]
    fn bridge_server_authorizes_and_dispatches_end_to_end() {
        let handle = start_computer_bridge().expect("bridge should start");
        let addr = handle.url.strip_prefix("http://").expect("http url").to_string();

        // Authorized request hits a deterministic validation branch (empty text)
        // and returns 200 with an honest missing-requirement body.
        let (status, body) = bridge_test_request(&addr, "POST", "/computer/type", Some(&handle.token), "{\"text\":\"\"}");
        assert!(status.starts_with("HTTP/1.1 200"), "status was {status}");
        assert!(body.contains("computer_type_text"), "body was {body}");

        // Missing token is rejected.
        let (unauth, _) = bridge_test_request(&addr, "POST", "/computer/type", None, "{\"text\":\"hi\"}");
        assert!(unauth.starts_with("HTTP/1.1 401"), "status was {unauth}");

        // Wrong token is rejected.
        let (wrong, _) = bridge_test_request(&addr, "POST", "/computer/type", Some("not-the-token"), "{\"text\":\"hi\"}");
        assert!(wrong.starts_with("HTTP/1.1 401"), "status was {wrong}");

        // Unknown operation -> 404 even when authorized.
        let (unknown, _) = bridge_test_request(&addr, "POST", "/computer/teleport", Some(&handle.token), "{}");
        assert!(unknown.starts_with("HTTP/1.1 404"), "status was {unknown}");

        // Wrong method -> 405.
        let (method, _) = bridge_test_request(&addr, "GET", "/computer/type", Some(&handle.token), "");
        assert!(method.starts_with("HTTP/1.1 405"), "status was {method}");
    }

    fn bridge_test_request(
        addr: &str,
        method: &str,
        path: &str,
        token: Option<&str>,
        body: &str,
    ) -> (String, String) {
        let mut stream = TcpStream::connect(addr).expect("connect to bridge");
        let mut request = format!(
            "{method} {path} HTTP/1.1\r\nHost: localhost\r\nContent-Length: {}\r\n",
            body.len()
        );
        if let Some(token) = token {
            request.push_str(&format!("Authorization: Bearer {token}\r\n"));
        }
        request.push_str("Connection: close\r\n\r\n");
        request.push_str(body);
        stream.write_all(request.as_bytes()).expect("write request");
        let mut response = String::new();
        stream.read_to_string(&mut response).expect("read response");
        let mut split = response.splitn(2, "\r\n\r\n");
        let head = split.next().unwrap_or("");
        let body = split.next().unwrap_or("").to_string();
        let status_line = head.lines().next().unwrap_or("").to_string();
        (status_line, body)
    }
}
