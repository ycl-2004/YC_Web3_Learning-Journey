use tauri::{
  tray::{MouseButton, MouseButtonState, TrayIconEvent},
  ActivationPolicy, Manager,
};

use tauri_plugin_nspopover::{AppExt as _, ToPopoverOptions, WindowExt as _};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // ✅ 先 init 插件
    .plugin(tauri_plugin_nspopover::init())
    .setup(|app| {
      // ✅ macOS: 不顯示 Dock（menubar app）
      #[cfg(target_os = "macos")]
      {
        app.set_activation_policy(ActivationPolicy::Accessory);
      }

      // ✅ 取 main window（tauri.conf.json 的 windows.label 必須是 "main"）
      let window = app.get_webview_window("main").expect("missing window label=main");

      // ✅ 把 window 轉成原生 popover（這才會像 Proton VPN 那樣浮在最上面）
      window.to_popover(ToPopoverOptions {
        is_fullsize_content: true,
      });

      // ✅ tray 由 tauri.conf.json 建立（id = "main"）
      let tray = app.tray_by_id("main").expect("missing trayIcon id=main in tauri.conf.json");
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
