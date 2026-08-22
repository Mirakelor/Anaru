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

pub fn run() {
    #[cfg(target_os = "linux")]
    stderr_guard::quiet();
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            stderr_guard::restore();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
