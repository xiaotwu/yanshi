mod runtime;

use runtime::{
    computer_click, computer_open_app, computer_shortcut, computer_type, desktop_notify,
    macos_permission_status, open_live_office, open_runtime_logs, open_yanshi, restart_runtime,
    pop_out_live_office, runtime_status, show_main_window, start_runtime, stop_runtime, RuntimeState,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
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
            desktop_notify
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
                    let _ = window.hide();
                }
                tauri::WindowEvent::Destroyed => {
                    let state = window.state::<RuntimeState>();
                    stop_runtime(&state);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Yanshi");
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open_yanshi", "Open Yanshi", true, None::<&str>)?;
    let tasks = MenuItem::with_id(app, "current_tasks", "Current Tasks", true, None::<&str>)?;
    let office = MenuItem::with_id(app, "open_live_office", "Open Live Office", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause_all", "Pause All", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &tasks, &office, &pause, &quit])?;
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
            "pause_all" => {
                let _ = app.emit("desktop:pause-all", ());
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
