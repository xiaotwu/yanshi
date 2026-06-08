use serde::{Deserialize, Serialize};
use std::{
    env,
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Write},
    os::raw::{c_double, c_uchar, c_void},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
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
                .stderr(Stdio::piped());
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
                .stderr(Stdio::piped());
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
        let _ = child.kill();
        let _ = child.wait();
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
}
