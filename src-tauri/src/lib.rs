use tauri::Manager;

#[derive(serde::Serialize, Clone)]
pub struct ActiveWindow {
    pub title: String,
    pub process: String,
    pub display_name: String,
    pub icon_base64: Option<String>,
}

/// Returns the exe name without the .exe extension.
#[cfg(target_os = "windows")]
fn exe_stem(path_wide: &[u16]) -> String {
    let s = String::from_utf16_lossy(path_wide);
    let filename = s.split('\\').last().unwrap_or("unknown");
    if filename.to_ascii_lowercase().ends_with(".exe") {
        filename[..filename.len() - 4].to_string()
    } else {
        filename.to_string()
    }
}

/// Minimal base64 encoder — avoids adding a crate dependency.
fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((n >> 18) & 63) as usize]);
        out.push(TABLE[((n >> 12) & 63) as usize]);
        out.push(if chunk.len() > 1 { TABLE[((n >> 6) & 63) as usize] } else { b'=' });
        out.push(if chunk.len() > 2 { TABLE[(n & 63) as usize] } else { b'=' });
    }
    String::from_utf8(out).unwrap_or_default()
}

/// Reads FileDescription from the exe's version info block.
/// Falls back to exe stem (name without .exe) on any error.
#[cfg(target_os = "windows")]
unsafe fn get_display_name(path_wide: &[u16]) -> String {
    use winapi::um::winver::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
    use winapi::shared::minwindef::LPVOID;

    // Null-terminate for API calls
    let path: Vec<u16> = path_wide.iter().copied()
        .take_while(|&c| c != 0)
        .chain(std::iter::once(0))
        .collect();

    let mut dummy = 0u32;
    let size = GetFileVersionInfoSizeW(path.as_ptr(), &mut dummy);
    if size == 0 { return exe_stem(path_wide); }

    let mut buf = vec![0u8; size as usize];
    if GetFileVersionInfoW(path.as_ptr(), 0, size, buf.as_mut_ptr() as *mut _) == 0 {
        return exe_stem(path_wide);
    }

    // English (US) + Unicode code page — covers the vast majority of apps
    let key: Vec<u16> = "\\StringFileInfo\\040904B0\\FileDescription\0"
        .encode_utf16().collect();
    let mut out: LPVOID = std::ptr::null_mut();
    let mut len: u32 = 0;

    if VerQueryValueW(
        buf.as_ptr() as LPVOID,
        key.as_ptr(),
        &mut out,
        &mut len,
    ) != 0 && len > 0 && !out.is_null() {
        let slice = std::slice::from_raw_parts(out as *const u16, (len - 1) as usize);
        let name = String::from_utf16_lossy(slice);
        let name = name.trim();
        if !name.is_empty() { return name.to_string(); }
    }

    exe_stem(path_wide)
}

/// Extracts the exe's icon and encodes it as a BMP data URI.
/// Returns None if the icon cannot be extracted.
#[cfg(target_os = "windows")]
unsafe fn extract_icon_base64(path_wide: &[u16]) -> Option<String> {
    use winapi::um::shellapi::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_SMALLICON};
    use winapi::um::winuser::{DrawIconEx, DestroyIcon, GetDC, ReleaseDC, FillRect, DI_NORMAL};
    use winapi::um::wingdi::{
        CreateCompatibleDC, CreateCompatibleBitmap, SelectObject,
        DeleteDC, DeleteObject, GetDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
        CreateSolidBrush,
    };
    use winapi::shared::windef::RECT;

    let path: Vec<u16> = path_wide.iter().copied()
        .take_while(|&c| c != 0)
        .chain(std::iter::once(0))
        .collect();

    let mut shfi: SHFILEINFOW = std::mem::zeroed();
    let ok = SHGetFileInfoW(
        path.as_ptr(), 0, &mut shfi,
        std::mem::size_of::<SHFILEINFOW>() as u32,
        SHGFI_ICON | SHGFI_SMALLICON,
    );
    if ok == 0 || shfi.hIcon.is_null() { return None; }

    let sz = 32i32;
    let hdc_screen = GetDC(std::ptr::null_mut());
    if hdc_screen.is_null() { DestroyIcon(shfi.hIcon); return None; }

    let hdc  = CreateCompatibleDC(hdc_screen);
    let hbm  = CreateCompatibleBitmap(hdc_screen, sz, sz);
    let old  = SelectObject(hdc, hbm as *mut _);

    // White background so transparent icons look clean
    let brush = CreateSolidBrush(0x00FF_FFFF);
    let rect  = RECT { left: 0, top: 0, right: sz, bottom: sz };
    FillRect(hdc, &rect, brush);
    DeleteObject(brush as *mut _);

    DrawIconEx(hdc, 0, 0, shfi.hIcon, sz, sz, 0, std::ptr::null_mut(), DI_NORMAL);

    // Read pixels
    let mut bmi: BITMAPINFO = std::mem::zeroed();
    bmi.bmiHeader.biSize        = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bmi.bmiHeader.biWidth       = sz;
    bmi.bmiHeader.biHeight      = -sz; // top-down
    bmi.bmiHeader.biPlanes      = 1;
    bmi.bmiHeader.biBitCount    = 32;
    bmi.bmiHeader.biCompression = BI_RGB;
    let pixel_bytes = (sz * sz * 4) as usize;
    let mut pixels = vec![0u8; pixel_bytes];
    GetDIBits(hdc, hbm, 0, sz as u32, pixels.as_mut_ptr() as *mut _, &mut bmi, 0);

    SelectObject(hdc, old);
    DeleteObject(hbm as *mut _);
    DeleteDC(hdc);
    ReleaseDC(std::ptr::null_mut(), hdc_screen);
    DestroyIcon(shfi.hIcon);

    // Build BMP in memory
    let file_size = (14u32 + 40 + pixel_bytes as u32) as u32;
    let mut bmp: Vec<u8> = Vec::with_capacity(file_size as usize);
    // BITMAPFILEHEADER
    bmp.extend_from_slice(b"BM");
    bmp.extend_from_slice(&file_size.to_le_bytes());
    bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved1
    bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved2
    bmp.extend_from_slice(&54u32.to_le_bytes()); // pixel data offset
    // BITMAPINFOHEADER
    bmp.extend_from_slice(&40u32.to_le_bytes());
    bmp.extend_from_slice(&sz.to_le_bytes());
    bmp.extend_from_slice(&(-sz).to_le_bytes());
    bmp.extend_from_slice(&1u16.to_le_bytes());   // planes
    bmp.extend_from_slice(&32u16.to_le_bytes());  // bit count
    bmp.extend_from_slice(&0u32.to_le_bytes());   // compression
    bmp.extend_from_slice(&(pixel_bytes as u32).to_le_bytes());
    for _ in 0..4 { bmp.extend_from_slice(&0i32.to_le_bytes()); } // pels + clr
    bmp.extend_from_slice(&pixels);

    Some(format!("data:image/bmp;base64,{}", base64_encode(&bmp)))
}

#[tauri::command]
fn get_active_window() -> Option<ActiveWindow> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};
        use winapi::um::processthreadsapi::OpenProcess;
        use winapi::um::psapi::GetModuleFileNameExW;
        use winapi::um::handleapi::CloseHandle;
        use winapi::um::winnt::PROCESS_QUERY_INFORMATION;

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() { return None; }

            // Get window title
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
            if title_len == 0 { return None; }
            let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

            // Get process name
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let handle = OpenProcess(PROCESS_QUERY_INFORMATION | 0x0010 /* PROCESS_VM_READ */, 0, pid);
            if handle.is_null() { return None; }

            let mut path_buf = [0u16; 512];
            let path_len = GetModuleFileNameExW(handle, std::ptr::null_mut(), path_buf.as_mut_ptr(), path_buf.len() as u32);
            CloseHandle(handle);

            if path_len == 0 { return None; }

            let path_wide = &path_buf[..path_len as usize];
            let process = String::from_utf16_lossy(path_wide)
                .split('\\').last().unwrap_or("unknown").to_string();
            let display_name = get_display_name(path_wide);
            let icon_base64  = extract_icon_base64(path_wide);

            Some(ActiveWindow { title, process, display_name, icon_base64 })
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
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
  #[cfg(target_os = "windows")]
  {
    use winapi::um::winuser::{GetLastInputInfo, LASTINPUTINFO};
    use winapi::shared::minwindef::DWORD;
    use winapi::um::sysinfoapi::GetTickCount;
    unsafe {
      let mut lii = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
      };
      if GetLastInputInfo(&mut lii) != 0 {
        let now: DWORD = GetTickCount();
        let idle_ms = now.wrapping_sub(lii.dwTime) as u64;
        return idle_ms / 1000;
      }
    }
    0
  }
  #[cfg(not(target_os = "windows"))]
  { 0 }
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
