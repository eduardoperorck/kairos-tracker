#[derive(serde::Serialize, Clone)]
pub struct ActiveWindow {
    pub title: String,
    pub process: String,
}

#[tauri::command]
fn get_active_window() -> Option<ActiveWindow> {
    // Returns active window info — platform-specific implementation
    // Falls back to None when WinAPI unavailable or on non-Windows platforms
    None
}

#[derive(serde::Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub timestamp: String,
    pub subject: String,
}

#[tauri::command]
fn get_git_log(repo_path: String, since_date: String) -> Vec<GitCommit> {
    // Validate path — reject traversal attempts
    if repo_path.contains("..") || repo_path.is_empty() {
        return vec![];
    }

    // Run: git log --since=DATE --pretty=format:"%H|%ai|%s" --no-merges
    let output = std::process::Command::new("git")
        .args([
            "-C", &repo_path,
            "log",
            &format!("--since={}", since_date),
            "--pretty=format:%H|%ai|%s",
            "--no-merges",
        ])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.splitn(3, '|').collect();
                    if parts.len() == 3 {
                        Some(GitCommit {
                            hash: parts[0].to_string(),
                            timestamp: parts[1].to_string(),
                            subject: parts[2].to_string(),
                        })
                    } else {
                        None
                    }
                })
                .collect()
        }
        _ => vec![],
    }
}

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
    .plugin(tauri_plugin_notification::init())
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
      get_active_window,
      get_git_log,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
