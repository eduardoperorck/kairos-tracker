use tauri::{Emitter, Manager};
use std::collections::HashMap;
use std::sync::{Mutex, Condvar, OnceLock};
use std::sync::Arc;

/// Global signal: WinEvent hook → background capture thread (Task 5 — sub-second detection).
static FOREGROUND_SIGNAL: OnceLock<Arc<(Mutex<bool>, Condvar)>> = OnceLock::new();

/// WinEvent hook callback — called by the OS on EVENT_SYSTEM_FOREGROUND.
/// Signals the background capture thread to wake immediately.
/// Parameters match the Windows WINEVENTPROC signature exactly.
#[cfg(target_os = "windows")]
unsafe extern "system" fn foreground_changed_hook(
    _hook: winapi::shared::windef::HWINEVENTHOOK,
    _event: winapi::shared::minwindef::DWORD,
    _hwnd: winapi::shared::windef::HWND,
    _id_object: winapi::shared::ntdef::LONG,
    _id_child: winapi::shared::ntdef::LONG,
    _id_event_thread: winapi::shared::minwindef::DWORD,
    _dwms_event_time: winapi::shared::minwindef::DWORD,
) {
    if let Some(signal) = FOREGROUND_SIGNAL.get() {
        let (lock, cvar) = signal.as_ref();
        if let Ok(mut triggered) = lock.lock() {
            *triggered = true;
            cvar.notify_one();
        }
    }
}

/// Accumulated input activity since last drain — filled by background polling thread.
pub struct InputAccumulator {
    pub keystrokes: u64,
    pub mouse_clicks: u64,
    pub mouse_distance_px: u64,
    pub window_start_ms: u64,
    #[cfg(target_os = "windows")]
    pub last_cursor_x: i32,
    #[cfg(target_os = "windows")]
    pub last_cursor_y: i32,
    /// Per-key "was down last poll" bitmask to detect edges (key-down transitions).
    #[cfg(target_os = "windows")]
    pub key_state: [bool; 256],
}

impl Default for InputAccumulator {
    fn default() -> Self {
        Self {
            keystrokes: 0,
            mouse_clicks: 0,
            mouse_distance_px: 0,
            window_start_ms: 0,
            #[cfg(target_os = "windows")]
            last_cursor_x: 0,
            #[cfg(target_os = "windows")]
            last_cursor_y: 0,
            #[cfg(target_os = "windows")]
            key_state: [false; 256],
        }
    }
}

/// Tauri application state — icon cache + input accumulator + context receivers.
pub struct AppState {
    icon_cache: Mutex<HashMap<String, Option<String>>>,
    input: Mutex<InputAccumulator>,
    browser_ctx: Mutex<Option<BrowserContext>>,   // M-C1: latest URL from browser extension
    editor_ctx: Mutex<Option<EditorContext>>,      // M-C2: latest workspace from VS Code extension
    window_rules_json: Mutex<String>,             // M-BG2: user rules synced from frontend (JSON)
    capture_buffer: Mutex<Vec<CaptureTickPayload>>, // M-BG3: ring buffer for webview wake-up recovery
}

#[derive(serde::Serialize, Clone)]
pub struct ActiveWindow {
    pub title: String,
    pub process: String,
    pub display_name: String,
    pub icon_base64: Option<String>,
}

/// Active browser tab context — posted by the browser extension (M-C1).
/// Stores only the hostname (never the full URL) to avoid leaking auth tokens
/// or sensitive query parameters. (Security fix: Fix-2)
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct BrowserContext {
    pub hostname: String,  // e.g. "github.com" — no path, no query, no fragment
    pub title: String,
}

/// Active VS Code editor context — posted by the VS Code extension (M-C2).
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct EditorContext {
    pub workspace: String,
    pub file: String,
    pub language: String,
}

// ─── M-C1/C2: HTTP context receiver ─────────────────────────────────────────

/// M77: Typed payloads for the browser and editor HTTP endpoints.
/// Replaces the hand-rolled extract_json_str parser with serde_json deserialization.
#[derive(serde::Deserialize)]
struct BrowserPayload { url: String, title: String }

#[derive(serde::Deserialize)]
struct EditorPayload {
    workspace: String,
    #[serde(default)]
    file: String,
    #[serde(default)]
    language: String,
}

/// Fix-2: Extracts only the hostname from a URL, stripping path, query and fragment.
/// Returns None for non-HTTP(S) URLs or malformed input.
///
/// Examples:
///   "https://github.com/user/repo?token=abc" → Some("github.com")
///   "chrome://newtab"                         → None
///   "about:blank"                              → None
fn extract_hostname(url: &str) -> Option<String> {
    // Only handle http/https
    let rest = url.strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    // Drop path, query string and fragment
    let host = rest
        .split('/')
        .next()?
        .split('?')
        .next()?
        .split('#')
        .next()?
        .trim();
    if host.is_empty() { return None; }
    Some(host.to_ascii_lowercase())
}

/// Fix-1: Returns true when the HTTP Origin is from a trusted source.
///
/// Trusted sources:
///   - No Origin header → local tool (VS Code extension via Node http, curl, etc.)
///   - chrome-extension:// → our browser extension
///   - moz-extension://    → Firefox variant
///   - edge-extension://   → Edge variant
///
/// Any web page (http:// or https://) is rejected — prevents CSRF attacks
/// where a malicious site POSTs fake context to manipulate the classifier.
fn is_trusted_origin(request: &str) -> bool {
    let origin_line = request
        .lines()
        .find(|l| l.to_ascii_lowercase().starts_with("origin:"));

    match origin_line {
        None => true, // No Origin header — local tool (VS Code, curl, etc.)
        Some(line) => {
            let origin = line[7..].trim().to_ascii_lowercase();
            origin.starts_with("chrome-extension://")
                || origin.starts_with("moz-extension://")
                || origin.starts_with("edge-extension://")
        }
    }
}

/// Handles a single HTTP connection from the browser or VS Code extension.
/// Expects POST /browser {url, title} or POST /editor {workspace, file, language}.
/// Also handles CORS preflight (OPTIONS).
fn handle_http_connection(stream: std::net::TcpStream, handle: tauri::AppHandle) {
    use std::io::{Read, Write};
    let mut stream = stream;
    stream.set_read_timeout(Some(std::time::Duration::from_millis(500))).ok();
    stream.set_write_timeout(Some(std::time::Duration::from_millis(500))).ok();

    let mut buf = [0u8; 8192];
    let n = match stream.read(&mut buf) {
        Ok(n) if n > 0 => n,
        _ => return,
    };
    let request = String::from_utf8_lossy(&buf[..n]);

    let first_line = request.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path   = parts.next().unwrap_or("");

    // CORS preflight — respond before origin check so the browser can send the real request
    if method == "OPTIONS" {
        let _ = stream.write_all(
            b"HTTP/1.1 204 No Content\r\n\
              Access-Control-Allow-Origin: *\r\n\
              Access-Control-Allow-Methods: POST, OPTIONS\r\n\
              Access-Control-Allow-Headers: Content-Type\r\n\
              Content-Length: 0\r\n\r\n"
        );
        return;
    }

    if method != "POST" { return; }

    // Fix-1: Reject requests from untrusted origins (web pages)
    if !is_trusted_origin(&request) {
        let _ = stream.write_all(
            b"HTTP/1.1 403 Forbidden\r\n\
              Content-Type: text/plain\r\n\
              Content-Length: 9\r\n\r\nForbidden"
        );
        return;
    }

    let body = request.find("\r\n\r\n")
        .map(|pos| &request[pos + 4..])
        .unwrap_or("");

    let state = handle.state::<AppState>();

    match path {
        "/browser" => {
            // Fix-2: extract only hostname — never store the full URL
            if let Ok(p) = serde_json::from_str::<BrowserPayload>(body) {
                if let Some(hostname) = extract_hostname(&p.url) {
                    *state.browser_ctx.lock().unwrap() = Some(BrowserContext { hostname, title: p.title });
                }
            }
        }
        "/editor" => {
            if let Ok(p) = serde_json::from_str::<EditorPayload>(body) {
                if !p.workspace.is_empty() {
                    *state.editor_ctx.lock().unwrap() = Some(EditorContext {
                        workspace: p.workspace,
                        file:      p.file,
                        language:  p.language,
                    });
                }
            }
        }
        _ => {}
    }

    let _ = stream.write_all(
        b"HTTP/1.1 200 OK\r\n\
          Access-Control-Allow-Origin: *\r\n\
          Content-Type: text/plain\r\n\
          Content-Length: 2\r\n\r\nOK"
    );
}

// ─── M-BG: Background capture ────────────────────────────────────────────────

/// Minimal window rule shape for deserializing rules synced from the frontend.
/// Only the fields needed for process/title matching are included.
#[derive(serde::Deserialize)]
struct BgWindowRule {
    #[serde(rename = "matchType")]
    match_type: String,
    pattern: String,
    #[serde(rename = "categoryId")]
    category_id: Option<String>,
    mode: String,
    enabled: bool,
}

/// Payload emitted as a Tauri event every poll cycle.
/// The frontend hook listens to "capture_tick" and runs classification from there.
#[derive(serde::Serialize, Clone)]
pub struct CaptureTickPayload {
    pub ts: i64,
    pub process: String,
    pub title: String,
    pub hostname: Option<String>,
    /// Pre-matched categoryId from the synced user rules (auto mode only).
    /// null when no auto rule matches — frontend scores further with domain/workspace signals.
    pub category_id: Option<String>,
    pub display_name: String,
}

/// Apply the first matching auto rule from JSON-encoded rules.
/// Returns the categoryId if an auto rule matches, None otherwise (ignore or suggest).
fn apply_rules_json(rules_json: &str, process: &str, title: &str) -> Option<String> {
    let rules: Vec<BgWindowRule> = serde_json::from_str(rules_json).unwrap_or_default();
    for rule in &rules {
        if !rule.enabled { continue; }
        let matches = match rule.match_type.as_str() {
            "process" => rule.pattern.to_lowercase() == process.to_lowercase(),
            "title"   => title.to_lowercase().contains(&rule.pattern.to_lowercase()),
            _         => false,
        };
        if matches {
            if rule.mode == "ignore" { return None; }
            if rule.mode == "auto" {
                if rule.category_id.is_some() { return rule.category_id.clone(); }
            }
        }
    }
    None
}

/// Lightweight foreground-window query used by the background thread.
/// Returns (process_exe, title) without icon extraction (too heavy for a background loop).
#[cfg(target_os = "windows")]
fn foreground_window_basic() -> Option<(String, String)> {
    use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::psapi::GetModuleFileNameExW;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::winnt::PROCESS_QUERY_INFORMATION;
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() { return None; }
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
        if title_len == 0 { return None; }
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | 0x0010, 0, pid);
        if handle.is_null() { return None; }
        let mut path_buf = [0u16; 512];
        let path_len = GetModuleFileNameExW(handle, std::ptr::null_mut(), path_buf.as_mut_ptr(), path_buf.len() as u32);
        CloseHandle(handle);
        if path_len == 0 { return None; }
        let path_wide = &path_buf[..path_len as usize];
        let process = String::from_utf16_lossy(path_wide)
            .split('\\').last().unwrap_or("unknown").to_string();
        Some((process, title))
    }
}

#[cfg(not(target_os = "windows"))]
fn foreground_window_basic() -> Option<(String, String)> { None }

/// Sync window rules from the frontend so the background thread can pre-classify.
#[tauri::command]
fn sync_window_rules(rules_json: String, state: tauri::State<AppState>) {
    *state.window_rules_json.lock().unwrap() = rules_json;
}

// ─── Windows helpers ─────────────────────────────────────────────────────────

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
    use winapi::um::winuser::{DrawIconEx, DestroyIcon, GetDC, ReleaseDC, FillRect};
    const DI_NORMAL: u32 = 0x0003;
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

/// M76: Shared HWND → ActiveWindow resolver.
/// Extracts title, process name, display name and cached icon from a single HWND.
/// Used by both `get_active_window` and `get_visible_windows` to eliminate duplication.
#[cfg(target_os = "windows")]
unsafe fn resolve_hwnd(
    hwnd: winapi::shared::windef::HWND,
    icon_cache: &mut HashMap<String, Option<String>>,
) -> Option<ActiveWindow> {
    use winapi::um::winuser::{GetWindowTextW, GetWindowThreadProcessId};
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::psapi::GetModuleFileNameExW;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::winnt::PROCESS_QUERY_INFORMATION;

    let mut title_buf = [0u16; 512];
    let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
    if title_len == 0 { return None; }
    let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, &mut pid);
    let handle = OpenProcess(PROCESS_QUERY_INFORMATION | 0x0010, 0, pid);
    if handle.is_null() { return None; }

    let mut path_buf = [0u16; 512];
    let path_len = GetModuleFileNameExW(handle, std::ptr::null_mut(), path_buf.as_mut_ptr(), path_buf.len() as u32);
    CloseHandle(handle);
    if path_len == 0 { return None; }

    let path_wide = &path_buf[..path_len as usize];
    let process = String::from_utf16_lossy(path_wide)
        .split('\\').last().unwrap_or("unknown").to_string();
    let display_name = get_display_name(path_wide);

    let icon_base64 = if let Some(cached) = icon_cache.get(&process) {
        cached.clone()
    } else {
        let icon = extract_icon_base64(path_wide);
        icon_cache.insert(process.clone(), icon.clone());
        icon
    };

    Some(ActiveWindow { title, process, display_name, icon_base64 })
}

#[tauri::command]
fn get_active_window(state: tauri::State<AppState>) -> Option<ActiveWindow> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::GetForegroundWindow;
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() { return None; }
            let mut cache = state.icon_cache.lock().unwrap();
            resolve_hwnd(hwnd, &mut cache)
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = state;
        None
    }
}

#[derive(serde::Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub timestamp: String,
    pub subject: String,
}

/// Returns the latest browser tab context posted by the browser extension (M-C1).
#[tauri::command]
fn get_browser_context(state: tauri::State<AppState>) -> Option<BrowserContext> {
    state.browser_ctx.lock().unwrap().clone()
}

/// Returns the latest VS Code editor context posted by the extension (M-C2).
#[tauri::command]
fn get_editor_context(state: tauri::State<AppState>) -> Option<EditorContext> {
    state.editor_ctx.lock().unwrap().clone()
}

// ─── M-C3: Multi-monitor visible window enumeration ───────────────────────────

/// EnumWindows callback — collects HWNDs into a Vec passed via lparam.
#[cfg(target_os = "windows")]
unsafe extern "system" fn collect_hwnds(
    hwnd: winapi::shared::windef::HWND,
    lparam: winapi::shared::minwindef::LPARAM,
) -> winapi::shared::minwindef::BOOL {
    let list = &mut *(lparam as *mut Vec<winapi::shared::windef::HWND>);
    list.push(hwnd);
    1
}

/// Returns up to `max_count` visible, non-minimised top-level windows.
/// The first entry is the foreground window; the rest are in Z-order.
#[tauri::command]
fn get_visible_windows(state: tauri::State<AppState>) -> Vec<ActiveWindow> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{
            EnumWindows, GetForegroundWindow, IsWindowVisible, IsIconic,
        };

        const MAX: usize = 5;

        unsafe {
            let mut hwnds: Vec<winapi::shared::windef::HWND> = Vec::with_capacity(64);
            EnumWindows(
                Some(collect_hwnds),
                &mut hwnds as *mut _ as winapi::shared::minwindef::LPARAM,
            );

            let fg = GetForegroundWindow();
            if !fg.is_null() {
                hwnds.retain(|&h| h != fg);
                hwnds.insert(0, fg);
            }

            let mut results = Vec::with_capacity(MAX);

            for &hwnd in hwnds.iter().take(MAX * 4) {
                if results.len() >= MAX { break; }
                if IsWindowVisible(hwnd) == 0 { continue; }
                if IsIconic(hwnd) != 0 { continue; }

                let mut cache = state.icon_cache.lock().unwrap();
                if let Some(win) = resolve_hwnd(hwnd, &mut cache) {
                    // Skip system/shell windows
                    let title_lc = win.title.to_ascii_lowercase();
                    if title_lc == "program manager"
                        || title_lc.contains("windows taskbar")
                        || title_lc.is_empty()
                    {
                        continue;
                    }
                    results.push(win);
                }
            }

            results
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = state;
        vec![]
    }
}

#[tauri::command]
fn get_git_log(repo_path: String, since_date: String) -> Vec<GitCommit> {
    // Validate path — reject traversal attempts
    if repo_path.contains("..") || repo_path.is_empty() {
        return vec![];
    }

    // Validate date format: must be YYYY-MM-DD (prevents shell/git arg injection)
    let date_valid = since_date.len() == 10
        && since_date.chars().enumerate().all(|(i, c)| match i {
            4 | 7 => c == '-',
            _ => c.is_ascii_digit(),
        });
    if !date_valid {
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

/// M-BG3: Drain the in-memory capture buffer — called by the frontend on mount
/// to replay events that arrived while the webview was initializing.
#[tauri::command]
fn drain_capture_buffer(state: tauri::State<AppState>) -> Vec<CaptureTickPayload> {
  let mut buf = state.capture_buffer.lock().unwrap();
  std::mem::take(&mut *buf)
}

#[tauri::command]
fn update_tray_status(app: tauri::AppHandle, category: String, elapsed: String) {
  #[cfg(target_os = "windows")]
  if let Some(tray) = app.tray_by_id("kairos") {
    let tooltip = if category.is_empty() {
      "Kairos — idle".to_string()
    } else {
      format!("Kairos — {} ({})", category, elapsed)
    };
    let _ = tray.set_tooltip(Some(&tooltip));
  }
  #[cfg(not(target_os = "windows"))]
  let _ = (app, category, elapsed);
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
    // Path is passed via environment variable to avoid any PowerShell injection risk.
    let script = r#"Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
$path=$env:SCREENSHOT_OUT_PATH;
$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$bmp=New-Object System.Drawing.Bitmap($s.Width,$s.Height);
$g=[System.Drawing.Graphics]::FromImage($bmp);
$g.CopyFromScreen($s.Location,[System.Drawing.Point]::Empty,$s.Size);
$enc=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType -eq 'image/jpeg'};
$p=New-Object System.Drawing.Imaging.EncoderParameters(1);
$p.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]60);
$bmp.Save($path, $enc, $p);"#;
    let out = std::process::Command::new("powershell")
      .args(["-NonInteractive", "-Command", script])
      .env("SCREENSHOT_OUT_PATH", &output_path)
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

/// Keyboard + mouse activity for the current measurement window.
/// Populated by a background polling thread (GetAsyncKeyState + GetCursorPos).
#[derive(serde::Serialize)]
pub struct InputActivity {
  pub keystrokes: u64,
  pub mouse_clicks: u64,
  pub mouse_distance_px: u64,
  pub window_ms: u64,
}

/// Drain and return accumulated input events since the last call.
#[tauri::command]
fn get_input_activity(state: tauri::State<AppState>) -> InputActivity {
  let mut acc = state.input.lock().unwrap();
  let now_ms = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis() as u64;
  let window_ms = if acc.window_start_ms > 0 {
    now_ms.saturating_sub(acc.window_start_ms)
  } else { 0 };
  let result = InputActivity {
    keystrokes:        acc.keystrokes,
    mouse_clicks:      acc.mouse_clicks,
    mouse_distance_px: acc.mouse_distance_px,
    window_ms,
  };
  // Reset accumulator; set window_start so next call computes correct duration
  acc.keystrokes        = 0;
  acc.mouse_clicks      = 0;
  acc.mouse_distance_px = 0;
  acc.window_start_ms   = now_ms;
  result
}

// DEAD CODE PLACEHOLDER — kept so old callers still compile
#[allow(dead_code)]
fn _get_input_activity_old() -> InputActivity {
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

/// Set or remove the app's Windows startup registry entry.
/// Key: HKCU\Software\Microsoft\Windows\CurrentVersion\Run
#[tauri::command]
fn set_startup_enabled(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winreg::{RegOpenKeyExW, RegSetValueExW, RegDeleteValueW, HKEY_CURRENT_USER};
        use winapi::um::winnt::{KEY_SET_VALUE, REG_SZ};
        use winapi::shared::minwindef::HKEY;
        let sub_key: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Run\0"
            .encode_utf16().collect();
        let value_name: Vec<u16> = "TimeTracker\0".encode_utf16().collect();
        unsafe {
            let mut hkey: HKEY = std::ptr::null_mut();
            let res = RegOpenKeyExW(HKEY_CURRENT_USER, sub_key.as_ptr(), 0, KEY_SET_VALUE, &mut hkey);
            if res != 0 { return Err(format!("RegOpenKeyExW failed: {}", res)); }
            if enabled {
                // Get current exe path
                let mut buf = vec![0u16; 1024];
                let len = winapi::um::libloaderapi::GetModuleFileNameW(
                    std::ptr::null_mut(), buf.as_mut_ptr(), buf.len() as u32
                );
                buf.truncate(len as usize);
                let path_bytes = std::slice::from_raw_parts(
                    buf.as_ptr() as *const u8, buf.len() * 2
                );
                let r = RegSetValueExW(hkey, value_name.as_ptr(), 0, REG_SZ,
                    path_bytes.as_ptr(), path_bytes.len() as u32);
                winapi::um::winreg::RegCloseKey(hkey);
                if r != 0 { return Err(format!("RegSetValueExW failed: {}", r)); }
            } else {
                RegDeleteValueW(hkey, value_name.as_ptr());
                winapi::um::winreg::RegCloseKey(hkey);
            }
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = enabled; Err("Startup on login only supported on Windows".into()) }
}

/// Returns whether the startup registry entry exists.
#[tauri::command]
fn get_startup_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winreg::{RegOpenKeyExW, RegQueryValueExW, RegCloseKey, HKEY_CURRENT_USER};
        use winapi::um::winnt::KEY_READ;
        use winapi::shared::minwindef::HKEY;
        let sub_key: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Run\0"
            .encode_utf16().collect();
        let value_name: Vec<u16> = "TimeTracker\0".encode_utf16().collect();
        unsafe {
            let mut hkey: HKEY = std::ptr::null_mut();
            if RegOpenKeyExW(HKEY_CURRENT_USER, sub_key.as_ptr(), 0, KEY_READ, &mut hkey) != 0 {
                return false;
            }
            let exists = RegQueryValueExW(hkey, value_name.as_ptr(),
                std::ptr::null_mut(), std::ptr::null_mut(),
                std::ptr::null_mut(), std::ptr::null_mut()) == 0;
            RegCloseKey(hkey);
            exists
        }
    }
    #[cfg(not(target_os = "windows"))]
    { false }
}

/// Store a secret in the Windows Credential Manager (user-scoped, encrypted by OS).
/// Falls back to returning an error on non-Windows platforms.
#[tauri::command]
fn save_secret(service: String, value: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::wincred::{CredWriteW, CREDENTIALW, CRED_TYPE_GENERIC, CRED_PERSIST_LOCAL_MACHINE};
        let target: Vec<u16> = service.encode_utf16().chain(std::iter::once(0)).collect();
        let blob = value.as_bytes();
        unsafe {
            let mut cred: CREDENTIALW = std::mem::zeroed();
            cred.Type             = CRED_TYPE_GENERIC;
            cred.TargetName       = target.as_ptr() as *mut _;
            cred.CredentialBlobSize = blob.len() as u32;
            cred.CredentialBlob   = blob.as_ptr() as *mut u8;
            cred.Persist          = CRED_PERSIST_LOCAL_MACHINE;
            if CredWriteW(&mut cred, 0) == 0 {
                return Err("CredWriteW failed".into());
            }
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = (service, value); Err("Credential storage only supported on Windows".into()) }
}

/// Read a secret from the Windows Credential Manager.
#[tauri::command]
fn load_secret(service: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::wincred::{CredReadW, CredFree, PCREDENTIALW, CRED_TYPE_GENERIC};
        let target: Vec<u16> = service.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            let mut pcred: PCREDENTIALW = std::ptr::null_mut();
            let ok = CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut pcred);
            if ok == 0 || pcred.is_null() {
                return Ok(None);
            }
            let cred = &*pcred;
            let blob = std::slice::from_raw_parts(cred.CredentialBlob, cred.CredentialBlobSize as usize);
            let value = String::from_utf8_lossy(blob).into_owned();
            CredFree(pcred as *mut _);
            Ok(Some(value))
        }
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = service; Ok(None) }
}

/// Delete a secret from the Windows Credential Manager.
#[tauri::command]
fn delete_secret(service: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::wincred::{CredDeleteW, CRED_TYPE_GENERIC};
        let target: Vec<u16> = service.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0); }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = service; Ok(()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let now_ms = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis() as u64;
  let app_state = AppState {
    icon_cache: Mutex::new(HashMap::new()),
    input: Mutex::new(InputAccumulator {
      window_start_ms: now_ms,
      ..Default::default()
    }),
    browser_ctx: Mutex::new(None),
    editor_ctx: Mutex::new(None),
    window_rules_json: Mutex::new("[]".to_string()),
    capture_buffer: Mutex::new(Vec::new()),
  };

  tauri::Builder::default()
    .manage(app_state)
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

      // Background input-activity polling (Windows only).
      // Polls GetAsyncKeyState for all 256 virtual keys and GetCursorPos
      // every 100ms to accumulate keystrokes/mouse events into AppState.
      #[cfg(target_os = "windows")]
      {
        let state = app.state::<AppState>();
        let input_arc = state.input.lock().unwrap();
        drop(input_arc); // just verifying access; arc is held via AppState
        let handle = app.handle().clone();
        std::thread::spawn(move || {
          use winapi::um::winuser::{GetAsyncKeyState, GetCursorPos};
          use winapi::shared::windef::POINT;
          let mut key_state = [false; 256];
          let mut last_x: i32 = 0;
          let mut last_y: i32 = 0;
          // Initialize cursor position
          unsafe {
            let mut pt = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut pt) != 0 { last_x = pt.x; last_y = pt.y; }
          }
          loop {
            std::thread::sleep(std::time::Duration::from_millis(100));
            let state = handle.state::<AppState>();
            let mut acc = state.input.lock().unwrap();

            unsafe {
              // Count keystroke edges (key newly pressed since last poll)
              // Scan printable keys + common non-printable (skip mouse buttons counted separately)
              for vk in 8u8..=254u8 {
                // Skip mouse buttons (1=LB, 2=RB, 4=MB)
                if vk == 1 || vk == 2 || vk == 4 { continue; }
                let s = GetAsyncKeyState(vk as i32);
                let is_down = (s >> 15) != 0;
                if is_down && !key_state[vk as usize] {
                  acc.keystrokes += 1;
                }
                key_state[vk as usize] = is_down;
              }

              // Left + right mouse button clicks (new-press edges)
              for &mb in &[1i32, 2i32] {
                let s = GetAsyncKeyState(mb);
                let vk = mb as usize;
                let is_down = (s >> 15) != 0;
                if is_down && !key_state[vk] {
                  acc.mouse_clicks += 1;
                }
                key_state[vk] = is_down;
              }

              // Mouse travel distance
              let mut pt = POINT { x: 0, y: 0 };
              if GetCursorPos(&mut pt) != 0 {
                let dx = (pt.x - last_x) as f64;
                let dy = (pt.y - last_y) as f64;
                let dist = (dx * dx + dy * dy).sqrt() as u64;
                if dist > 0 { acc.mouse_distance_px += dist; }
                last_x = pt.x;
                last_y = pt.y;
              }
            }
          }
        });
      }

      // M-BG1: Background window capture thread.
      // Wakes immediately on foreground change (WinEvent) + 2 s fallback poll.
      // Runs regardless of whether the app window is visible — enables system-wide tracking.
      {
        let bg_handle = app.handle().clone();
        #[cfg(target_os = "windows")]
        let bg_signal = std::sync::Arc::clone(
          FOREGROUND_SIGNAL.get_or_init(|| std::sync::Arc::new((std::sync::Mutex::new(false), std::sync::Condvar::new())))
        );
        std::thread::spawn(move || {
          loop {
            #[cfg(target_os = "windows")]
            {
              let (lock, cvar) = bg_signal.as_ref();
              let guard = lock.lock().unwrap();
              let (mut guard, _) = cvar.wait_timeout(guard, std::time::Duration::from_secs(2)).unwrap();
              *guard = false; // clear the signal so next iteration waits properly
            }
            #[cfg(not(target_os = "windows"))]
            std::thread::sleep(std::time::Duration::from_secs(2));

            let Some((process, title)) = foreground_window_basic() else { continue };

            let state = bg_handle.state::<AppState>();

            // M-C1: attach latest browser hostname if available
            let hostname = state.browser_ctx.lock().unwrap()
              .as_ref().map(|c| c.hostname.clone());

            // M-BG2: pre-classify with synced user rules
            let rules_json = state.window_rules_json.lock().unwrap().clone();
            let category_id = apply_rules_json(&rules_json, &process, &title);

            // Display name: cached icon lookup (no icon in BG — too heavy)
            let display_name = process.trim_end_matches(".exe").trim_end_matches(".EXE").to_string();

            let ts = std::time::SystemTime::now()
              .duration_since(std::time::UNIX_EPOCH)
              .unwrap_or_default()
              .as_millis() as i64;

            let payload = CaptureTickPayload {
              ts,
              process,
              title,
              hostname,
              category_id,
              display_name,
            };

            // M-BG3: push to ring buffer (max 300 events) for wake-up recovery
            {
              let state = bg_handle.state::<AppState>();
              let mut buf = state.capture_buffer.lock().unwrap();
              if buf.len() >= 300 { buf.remove(0); }
              buf.push(payload.clone());
            }

            let _ = bg_handle.emit("capture_tick", payload);
          }
        });
      }

      // Task 5: WinEvent hook thread — sets up EVENT_SYSTEM_FOREGROUND hook and runs a
      // message loop so the OS can deliver foreground-change notifications sub-second.
      #[cfg(target_os = "windows")]
      {
        // Ensure the signal is initialized before the hook thread starts
        FOREGROUND_SIGNAL.get_or_init(|| std::sync::Arc::new((std::sync::Mutex::new(false), std::sync::Condvar::new())));
        std::thread::spawn(move || {
          use winapi::um::winuser::{
            SetWinEventHook, UnhookWinEvent, GetMessageW, TranslateMessage, DispatchMessageW,
            EVENT_SYSTEM_FOREGROUND, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS, MSG,
          };
          unsafe {
            let hook = SetWinEventHook(
              EVENT_SYSTEM_FOREGROUND,
              EVENT_SYSTEM_FOREGROUND,
              std::ptr::null_mut(),
              Some(foreground_changed_hook),
              0,
              0,
              WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );
            if hook.is_null() { return; }
            let mut msg: MSG = std::mem::zeroed();
            // Message loop — required for WinEvent hook delivery
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
              TranslateMessage(&msg);
              DispatchMessageW(&msg);
            }
            UnhookWinEvent(hook);
          }
        });
      }

      // M-C1/C2: HTTP context receiver — accepts browser URL and VS Code workspace.
      // Listens on 127.0.0.1:27183 for POST /browser and POST /editor.
      {
        let http_handle = app.handle().clone();
        std::thread::spawn(move || {
          let Ok(listener) = std::net::TcpListener::bind("127.0.0.1:27183") else { return };
          for stream in listener.incoming().flatten() {
            let h = http_handle.clone();
            std::thread::spawn(move || handle_http_connection(stream, h));
          }
        });
      }

      // System tray — minimize-to-tray support.
      #[cfg(target_os = "windows")]
      {
        use tauri::menu::{MenuBuilder, MenuItemBuilder};
        use tauri::tray::TrayIconBuilder;

        let show_item = MenuItemBuilder::with_id("show", "Show Kairos").build(app)?;
        let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
        let menu = MenuBuilder::new(app)
          .items(&[&show_item, &quit_item])
          .build()?;

        let tray_handle = app.handle().clone();
        TrayIconBuilder::with_id("kairos")
          .tooltip("Kairos")
          .menu(&menu)
          .on_menu_event(move |_tray, event| match event.id().as_ref() {
            "show" => {
              if let Some(win) = tray_handle.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
              }
            }
            "quit" => std::process::exit(0),
            _ => {}
          })
          .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
              let app = tray.app_handle();
              if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
              }
            }
          })
          .build(app)?;
      }

      // Minimize to tray on close (Windows only).
      #[cfg(target_os = "windows")]
      {
        let main_win = app.get_webview_window("main").expect("no main window");
        let win_for_close = main_win.clone();
        main_win.on_window_event(move |event| {
          if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = win_for_close.hide();
          }
        });
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      update_tray_status,
      drain_capture_buffer,
      sync_window_rules,
      get_idle_seconds,
      set_always_on_top,
      get_active_window,
      get_visible_windows,
      get_browser_context,
      get_editor_context,
      get_git_log,
      capture_screenshot,
      list_screenshots,
      delete_screenshots_before,
      get_input_activity,
      save_secret,
      load_secret,
      delete_secret,
      set_startup_enabled,
      get_startup_enabled,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
