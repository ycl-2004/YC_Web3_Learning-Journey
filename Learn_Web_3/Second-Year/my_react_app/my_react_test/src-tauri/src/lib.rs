use tauri::{
  menu::{Menu, MenuItem},
  tray::{TrayIconBuilder, TrayIconEvent},
  Manager,
  image::Image,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // ✅ macOS: 不顯示 Dock（menubar app）
      #[cfg(target_os = "macos")]
      {
        use tauri::ActivationPolicy;
        app.set_activation_policy(ActivationPolicy::Accessory);
      }

      // ✅ 保留 debug log plugin
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // ✅ Tray menu: Quit
      let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&quit])?;

      // ✅ 讀取 PNG（編譯時嵌入），解碼成 RGBA
      let png_bytes = include_bytes!("../icons/n.png");
      let dyn_img = image::load_from_memory(png_bytes)
        .map_err(|e| format!("Failed to load tray icon PNG: {e}"))?;
      let rgba = dyn_img.to_rgba8();
      let (w, h) = rgba.dimensions();
      let icon = Image::new_owned(rgba.into_raw(), w, h);

      // ✅ Tray icon + click toggle
      let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { .. } = event {
            let app = tray.app_handle();
            let window = app.get_webview_window("main").unwrap();

            if window.is_visible().unwrap_or(false) {
              let _ = window.hide();
            } else {
              let _ = window.show();
              let _ = window.set_focus();

              // ✅ 點外面自動收起
              let window_clone = window.clone();
              window.on_window_event(move |e| {
                if let tauri::WindowEvent::Focused(false) = e {
                  let _ = window_clone.hide();
                }
              });
            }
          }
        })
        .on_menu_event(|app, event| {
          if event.id == "quit" {
            app.exit(0);
          }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
