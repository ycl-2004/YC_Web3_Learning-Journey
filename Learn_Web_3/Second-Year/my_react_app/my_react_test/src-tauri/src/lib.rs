use tauri::{
  image::Image,
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager,
};
use tauri_plugin_positioner::{Position, WindowExt};
use std::{thread, time::Duration};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_positioner::init())
    .setup(|app| {
      #[cfg(target_os = "macos")]
      {
        use tauri::ActivationPolicy;
        app.set_activation_policy(ActivationPolicy::Accessory);
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let window = app.get_webview_window("main").unwrap();

      // blur hide（延迟避免 Finder selection border）
      {
        let w = window.clone();
        window.on_window_event(move |e| {
          if let tauri::WindowEvent::Focused(false) = e {
            let w2 = w.clone();
            thread::spawn(move || {
              thread::sleep(Duration::from_millis(120));
              if !w2.is_focused().unwrap_or(false) {
                let _ = w2.hide();
              }
            });
          }
        });
      }

      // tray icon
      let png_bytes = include_bytes!("../icons/n.png");
      let dyn_img = image::load_from_memory(png_bytes)
        .map_err(|e| format!("Failed to load tray icon PNG: {e}"))?;
      let rgba = dyn_img.to_rgba8();
      let (w, h) = rgba.dimensions();
      let icon = Image::new_owned(rgba.into_raw(), w, h);

      let _tray = TrayIconBuilder::new()
        .icon(icon)
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { button, button_state, .. } = event {
            if button != MouseButton::Left || button_state != MouseButtonState::Up {
              return;
            }

            let app = tray.app_handle();
            let window = app.get_webview_window("main").unwrap();

            if window.is_visible().unwrap_or(false) {
              let _ = window.hide();
            } else {
              let _ = window.move_window(Position::TopRight);
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
