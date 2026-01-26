use tauri::{
  tray::{MouseButton, MouseButtonState, TrayIconEvent},
  ActivationPolicy, Manager,
};

use tauri_plugin_dialog::DialogExt;
use tauri_plugin_nspopover::{AppExt as _, ToPopoverOptions, WindowExt as _};

/// ✅ 由 Rust 打开系统文件选择器（popover/Accessory 模式下更稳定）
/// 返回：Some(path) 或 None

#[tauri::command]
async fn pick_audio(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();

  // ✅ 所有 UI 相关：全部放到主线程
  let app_ui = app.clone();
  let _ = app.run_on_main_thread(move || {
    // 1) 先收起 popover，避免 OpenPanel sheet 挂在 popover 上变白板/崩溃
    if app_ui.is_popover_shown() {
      app_ui.hide_popover();
    }

    #[cfg(target_os = "macos")]
    {
      let _ = app_ui.set_activation_policy(ActivationPolicy::Regular);
    }

    // 2) 打开文件对话框（dialog v2 callback）
    let app_after = app_ui.clone();
    app_ui
      .dialog()
      .file()
      .add_filter("Audio", &["mp3", "m4a", "wav", "aac"])
      .pick_file(move |path_opt| {
        let picked = path_opt.map(|p| p.to_string());

        // 3) 选完/取消：恢复 menubar 状态（也放主线程）
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

  // ✅ 等用户选择/取消（阻塞放到 spawn_blocking）
  let picked = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
    .await
    .map_err(|_| "dialog join error".to_string())?;

  Ok(picked)
}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // ✅ plugins
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_nspopover::init())

    // ✅ register commands
    .invoke_handler(tauri::generate_handler![pick_audio])

    .setup(|app| {
      // ✅ macOS: 不顯示 Dock（menubar app）
      #[cfg(target_os = "macos")]
      {
        app.set_activation_policy(ActivationPolicy::Accessory);
      }

      // ✅ 取 main window（tauri.conf.json 的 windows.label 必須是 "main"）
      let window = app
        .get_webview_window("main")
        .expect("missing window label=main");

      // ✅ 轉成原生 popover（像 Proton VPN 那样）
      window.to_popover(ToPopoverOptions {
        is_fullsize_content: true,
      });

      // ✅ tray 由 tauri.conf.json 建立（id = "main"）
      let tray = app
        .tray_by_id("main")
        .expect("missing trayIcon id=main in tauri.conf.json");

      let handle = app.handle().clone();

      tray.on_tray_icon_event(move |_, event| {
        if let TrayIconEvent::Click {
          button,
          button_state,
          ..
        } = event
        {
          // ✅ 只吃左鍵放開（避免 Down/Up 觸發兩次）
          if button != MouseButton::Left || button_state != MouseButtonState::Up {
            return;
          }

          if !handle.is_popover_shown() {
            handle.show_popover();
          } else {
            handle.hide_popover();
          }
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
