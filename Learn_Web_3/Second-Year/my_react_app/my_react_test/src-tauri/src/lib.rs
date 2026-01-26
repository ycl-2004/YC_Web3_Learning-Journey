// src-tauri/src/lib.rs (or wherever app_lib::run() lives)

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  tray::{MouseButton, MouseButtonState, TrayIconEvent},
  ActivationPolicy, Manager,
};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_nspopover::{AppExt as _, ToPopoverOptions, WindowExt as _};

/// ✅ Open system file picker safely in menubar/popover mode
/// Returns: Some(path) or None
#[tauri::command]
async fn pick_audio(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();

  // ✅ All UI-related operations must run on main thread
  let app_ui = app.clone();
  let _ = app.run_on_main_thread(move || {
    // 1) Hide popover first so OpenPanel won't attach to popover (avoids white panel/crash)
    if app_ui.is_popover_shown() {
      app_ui.hide_popover();
    }

    // ❌ IMPORTANT: Do NOT switch to ActivationPolicy::Regular here
    // It will cause Dock icon to appear.
    // Keep Accessory policy and just open the dialog.

    // 2) Open file dialog (dialog v2 callback)
    let app_after = app_ui.clone();
    app_ui
      .dialog()
      .file()
      .add_filter("Audio", &["mp3", "m4a", "wav", "aac"])
      .pick_file(move |path_opt| {
        let picked = path_opt.map(|p| p.to_string());

        // 3) After select/cancel: restore menubar state (still on main thread)
        let app_restore = app_after.clone();
        let _ = app_after.run_on_main_thread(move || {
          #[cfg(target_os = "macos")]
          {
            let _ = app_restore.set_activation_policy(ActivationPolicy::Accessory);
          }
          app_restore.show_popover();
        });

        let _ = tx.send(picked);
      });
  });

  // ✅ Wait for user selection/cancel (blocking wait in spawn_blocking)
  let picked = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
    .await
    .map_err(|_| "dialog join error".to_string())?;

  Ok(picked)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_nspopover::init())
    // .invoke_handler(...) 你原本的 command 保留
    .invoke_handler(tauri::generate_handler![pick_audio])

    .setup(|app| {
      // ✅ macOS: menubar app (no Dock)
      #[cfg(target_os = "macos")]
      {
        app.set_activation_policy(ActivationPolicy::Accessory);
      }

      // ✅ main window -> popover
      let window = app
        .get_webview_window("main")
        .expect("missing window label=main");

      window.to_popover(ToPopoverOptions {
        is_fullsize_content: true,
      });

      
      // tray (created by tauri.conf.json)
      let tray = app.tray_by_id("main").expect("missing trayIcon id=main");

      // build menu
      let version_str = format!("Version {}", env!("CARGO_PKG_VERSION"));
      let version_item = tauri::menu::MenuItem::with_id(app, "version", version_str, false, None::<&str>)?;
      let quit_item = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let menu = tauri::menu::Menu::with_items(
        app,
        &[
          &version_item,
          &tauri::menu::PredefinedMenuItem::separator(app)?,
          &quit_item,
        ],
      )?;

      // attach menu
      tray.set_menu(Some(menu))?;

      // ✅ IMPORTANT: prevent left click from showing menu
      tray.set_show_menu_on_left_click(false)?;

      // menu events
      let app_handle_for_menu = app.handle().clone();
      tray.on_menu_event(move |_tray, event| {
        if event.id().as_ref() == "quit" {
          app_handle_for_menu.exit(0);
        }
      });

      // left click toggles popover
      let handle = app.handle().clone();
      tray.on_tray_icon_event(move |_, event| {
        if let tauri::tray::TrayIconEvent::Click { button, button_state, .. } = event {
          if button == tauri::tray::MouseButton::Left
            && button_state == tauri::tray::MouseButtonState::Up
          {
            if !handle.is_popover_shown() {
              handle.show_popover();
            } else {
              handle.hide_popover();
            }
          }
        }
      });


      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}