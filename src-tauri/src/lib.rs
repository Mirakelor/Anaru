#[cfg_attr(mobile, tauri::mobile_entry_point)]

#[cfg(target_os = "linux")]
mod stderr_guard {
    use std::sync::atomic::{AtomicI32, Ordering};

    static SAVED_FD: AtomicI32 = AtomicI32::new(-1);
    static DEVNULL_FD: AtomicI32 = AtomicI32::new(-1);

    /// Redirect fd 2 to /dev/null, keeping the original fd for restore.
    /// WebKitGTK writes a non-fatal "Could not create default EGL display …
    /// Aborting…" line straight to stderr during WebView initialization;
    /// that output is not routable through GLib's log system.
    pub fn quiet() {
        unsafe {
            let saved = libc::dup(2);
            let devnull = libc::open(c"/dev/null".as_ptr(), libc::O_WRONLY);
            if saved >= 0 && devnull >= 0 {
                libc::dup2(devnull, 2);
                SAVED_FD.store(saved, Ordering::Relaxed);
                DEVNULL_FD.store(devnull, Ordering::Relaxed);
            } else {
                if saved >= 0 {
                    libc::close(saved);
                }
                if devnull >= 0 {
                    libc::close(devnull);
                }
            }
        }
    }

    pub fn restore() {
        let saved = SAVED_FD.swap(-1, Ordering::Relaxed);
        let devnull = DEVNULL_FD.swap(-1, Ordering::Relaxed);
        if saved >= 0 {
            unsafe {
                libc::dup2(saved, 2);
                libc::close(saved);
                if devnull >= 0 {
                    libc::close(devnull);
                }
            }
        }
    }
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}

/// Synthesize Japanese speech for the desktop shell (WebKitGTK has no
/// speechSynthesis). Prefers the edge-tts CLI for natural voices, falls back
/// to espeak-ng for offline use. Returns the audio bytes as base64.
#[tauri::command]
async fn tts_speak(text: String) -> Result<String, String> {
    use tokio::process::Command;

    fn b64(bytes: &[u8]) -> String {
        const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
        for chunk in bytes.chunks(3) {
            let n = (chunk[0] as u32) << 16
                | (chunk.get(1).copied().unwrap_or(0) as u32) << 8
                | chunk.get(2).copied().unwrap_or(0) as u32;
            out.push(TABLE[(n >> 18) as usize & 63] as char);
            out.push(TABLE[(n >> 12) as usize & 63] as char);
            out.push(if chunk.len() > 1 { TABLE[(n >> 6) as usize & 63] as char } else { '=' });
            out.push(if chunk.len() > 2 { TABLE[n as usize & 63] as char } else { '=' });
        }
        out
    }

    let short = text.chars().take(100).collect::<String>();
    if let Ok(out) = Command::new("edge-tts")
        .args(["--voice", "ja-JP-KeitaNeural", "--text", &short, "--write-media", "-"])
        .output()
        .await
    {
        if out.status.success() && !out.stdout.is_empty() {
            return Ok(b64(&out.stdout));
        }
    }
    if let Ok(out) = Command::new("espeak-ng")
        .args(["-v", "ja", "-w", "/dev/stdout", &short])
        .output()
        .await
    {
        if out.status.success() && !out.stdout.is_empty() {
            return Ok(b64(&out.stdout));
        }
    }
    Err("No speech engine available (install edge-tts or espeak-ng).".into())
}

pub fn run() {
    #[cfg(target_os = "linux")]
    stderr_guard::quiet();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![fetch_text, tts_speak])
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            stderr_guard::restore();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
