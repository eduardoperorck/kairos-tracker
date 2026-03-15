#[tauri::command]
fn update_tray_status(_category: String, _elapsed: String) {
  // Update tray tooltip with active timer info
  // Stub: full implementation requires tray handle
}

#[tauri::command]
fn get_idle_seconds() -> u64 {
  // Returns seconds since last user input
  // Windows: use GetLastInputInfo via winapi
  // Returns 0 if not available (browser mode fallback)
  0
}

#[tauri::command]
async fn set_always_on_top(window: tauri::Window, enabled: bool) -> Result<(), String> {
  window.set_always_on_top(enabled).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_notification::Builder::default().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      update_tray_status,
      get_idle_seconds,
      set_always_on_top,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
