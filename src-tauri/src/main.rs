// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn quiet_startup_noise() {
    use std::path::Path;

    // WebKitGTK tries to create a default EGL display and logs an abort
    // when none is available (headless/VM/remote-desktop setups). Disabling
    // the DMABUF renderer makes it fall back to software rendering instead.
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    // Inside an AppImage, GLib scans the *host's* gio module directory and
    // trips over a mismatched gvfs build ("undefined symbol …", "Failed to
    // load module: …"). Point it at the AppImage's own modules instead.
    if let Ok(appdir) = std::env::var("APPDIR") {
        let modules = Path::new(&appdir).join("usr/lib/x86_64-linux-gnu/gio/modules");
        if modules.is_dir() && std::env::var_os("GIO_MODULE_DIR").is_none() {
            std::env::set_var("GIO_MODULE_DIR", modules);
        }
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    quiet_startup_noise();
    anaru_lib::run()
}
