// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK tries to create a default EGL display and logs an abort
    // when none is available (headless/VM/remote-desktop setups). Disabling
    // the DMABUF renderer makes it fall back to software rendering instead.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
    anaru_lib::run()
}
