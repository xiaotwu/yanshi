mod runtime;

use runtime::{
    computer_click, computer_open_app, computer_shortcut, computer_type, desktop_notify,
    hide_main_window, macos_permission_status, open_live_office, open_runtime_logs, open_yanshi,
    pop_out_live_office, quit_app, restart_runtime, reveal_path, runtime_status, runtime_token,
    show_main_window, start_runtime, stop_runtime, update_active_runs, RuntimeState,
};
use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCheckResult {
    status: &'static str,
    version: Option<String>,
    current_version: Option<String>,
    error: Option<String>,
}

fn updater_enabled_at_build() -> bool {
    matches!(
        option_env!("YANSHI_UPDATER_ENABLED"),
        Some("1" | "true" | "TRUE" | "yes" | "YES")
    )
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> UpdateCheckResult {
    if !updater_enabled_at_build() {
        return UpdateCheckResult {
            status: "not_configured",
            version: None,
            current_version: None,
            error: None,
        };
    }
    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => UpdateCheckResult {
                status: "available",
                version: Some(update.version),
                current_version: Some(update.current_version),
                error: None,
            },
            Ok(None) => UpdateCheckResult {
                status: "up_to_date",
                version: None,
                current_version: None,
                error: None,
            },
            Err(error) => UpdateCheckResult {
                status: "error",
                version: None,
                current_version: None,
                error: Some(error.to_string()),
            },
        },
        Err(error) => UpdateCheckResult {
            status: "error",
            version: None,
            current_version: None,
            error: Some(error.to_string()),
        },
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if shortcut.matches(Modifiers::SUPER, Code::KeyY) {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(RuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            runtime_status,
            runtime_token,
            restart_runtime,
            open_runtime_logs,
            macos_permission_status,
            computer_click,
            computer_type,
            computer_shortcut,
            computer_open_app,
            open_yanshi,
            open_live_office,
            pop_out_live_office,
            desktop_notify,
            reveal_path,
            update_active_runs,
            hide_main_window,
            quit_app,
            check_for_updates
        ])
        .setup(|app| {
            let shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyY);
            let _ = app.global_shortcut().register(shortcut);
            setup_tray(app)?;
            let handle = app.handle().clone();
            let state = app.state::<RuntimeState>();
            start_runtime(&handle, &state);
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let state = window.state::<RuntimeState>();
                    let active = *state.active_runs.lock().expect("active runs mutex poisoned");
                    // Always confirm — the red close button never silently hides the app.
                    // The frontend prompt offers Cancel / Hide to menu bar / Quit; Quit goes
                    // through the canonical full-quit path (sidecar killed on RunEvent::Exit).
                    let _ = window.emit("desktop:close-prompt", active);
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                tauri::WindowEvent::Destroyed => {
                    let state = window.state::<RuntimeState>();
                    stop_runtime(&state);
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Yanshi")
        .run(|app_handle, event| {
            // Terminate the owned sidecar on every process-exit path (Cmd+Q, tray Quit,
            // AppleScript quit) so it never orphans on port 8765.
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<RuntimeState>();
                stop_runtime(&state);
            }
        });
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open_yanshi", "Open Yanshi", true, None::<&str>)?;
    let tasks = MenuItem::with_id(app, "current_tasks", "Current Tasks", true, None::<&str>)?;
    let office = MenuItem::with_id(app, "open_live_office", "Open Live Office", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "cancel_all", "Stop All", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &tasks, &office, &stop, &quit])?;
    TrayIconBuilder::new()
        .tooltip("Yanshi")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open_yanshi" => {
                let _ = show_main_window(app);
            }
            "current_tasks" => {
                let _ = show_main_window(app);
                let _ = app.emit("desktop:show-runs", ());
            }
            "open_live_office" => {
                let _ = pop_out_live_office(app.clone());
            }
            "cancel_all" => {
                let _ = app.emit("desktop:cancel-all", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}
