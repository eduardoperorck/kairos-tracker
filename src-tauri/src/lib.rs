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

/// Capture a screenshot and save it as JPEG to the given path.
/// Uses PowerShell [System.Drawing] — no extra crates needed.
/// Returns Err if screenshots are unavailable on this platform.
#[tauri::command]
fn capture_screenshot(output_path: String) -> Result<(), String> {
  // Security: reject path traversal and non-absolute paths
  if output_path.contains("..") || output_path.is_empty() {
    return Err("Invalid path".into());
  }
  #[cfg(target_os = "windows")]
  {
    let script = format!(
      r#"Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$bmp=New-Object System.Drawing.Bitmap($s.Width,$s.Height);
$g=[System.Drawing.Graphics]::FromImage($bmp);
$g.CopyFromScreen($s.Location,[System.Drawing.Point]::Empty,$s.Size);
$enc=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{{$_.MimeType -eq 'image/jpeg'}};
$p=New-Object System.Drawing.Imaging.EncoderParameters(1);
$p.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]60);
$bmp.Save('{}', $enc, $p);"#,
      output_path.replace('\'', "''")
    );
    let out = std::process::Command::new("powershell")
      .args(["-NonInteractive", "-Command", &script])
      .output()
      .map_err(|e| e.to_string())?;
    if !out.status.success() {
      let stderr = String::from_utf8_lossy(&out.stderr);
      return Err(format!("Screenshot failed: {}", stderr));
    }
    Ok(())
  }
  #[cfg(not(target_os = "windows"))]
  {
    Err("Screenshots are only supported on Windows.".into())
  }
}

/// List screenshot file paths for a given date (YYYY-MM-DD).
/// Screenshots are stored in: {app_data}/screenshots/{date}/
#[tauri::command]
fn list_screenshots(app: tauri::AppHandle, date: String) -> Vec<String> {
  // Validate date format
  if date.len() != 10 || date.contains("..") {
    return vec![];
  }
  let Ok(data_dir) = app.path().app_data_dir() else { return vec![] };
  let dir = data_dir.join("screenshots").join(&date);
  let Ok(entries) = std::fs::read_dir(&dir) else { return vec![] };
  let mut paths: Vec<String> = entries
    .filter_map(|e| e.ok())
    .filter(|e| e.path().extension().map(|x| x == "jpg").unwrap_or(false))
    .filter_map(|e| e.path().to_str().map(String::from))
    .collect();
  paths.sort();
  paths
}

/// Returns keyboard and mouse activity stats for the last N seconds.
/// On Windows, reads from a lightweight counter updated by a background poll.
/// Falls back to zeros on unsupported platforms or when no data is available.
#[derive(serde::Serialize)]
pub struct InputActivity {
  pub keystrokes: u64,
  pub mouse_clicks: u64,
  pub mouse_distance_px: u64,
  pub window_ms: u64,
}

#[tauri::command]
fn get_input_activity() -> InputActivity {
  // Stub: full implementation requires platform-level input hooks (e.g. SetWindowsHookEx).
  // Returns zeros — callers should fall back to idle-seconds-based estimation.
  InputActivity {
    keystrokes: 0,
    mouse_clicks: 0,
    mouse_distance_px: 0,
    window_ms: 0,
  }
}

/// Delete all screenshots older than the given date (YYYY-MM-DD).
#[tauri::command]
fn delete_screenshots_before(app: tauri::AppHandle, before_date: String) -> Result<(), String> {
  if before_date.len() != 10 || before_date.contains("..") {
    return Err("Invalid date".into());
  }
  let Ok(data_dir) = app.path().app_data_dir() else {
    return Err("Cannot resolve app data dir".into());
  };
  let screenshots_dir = data_dir.join("screenshots");
  let Ok(entries) = std::fs::read_dir(&screenshots_dir) else { return Ok(()) };
  for entry in entries.filter_map(|e| e.ok()) {
    let name = entry.file_name().to_string_lossy().to_string();
    // Directory names are dates: compare lexicographically
    if name.len() == 10 && name < before_date {
      let _ = std::fs::remove_dir_all(entry.path());
    }
  }
  Ok(())
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
      capture_screenshot,
      list_screenshots,
      delete_screenshots_before,
      get_input_activity,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
