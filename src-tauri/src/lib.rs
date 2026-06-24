use tauri::Manager;
use tauri_plugin_shell::ShellExt;

/// Run TripoSR sidecar for a single image → OBJ.
/// image_base64: PNG encoded as base64, quality: "fast" | "full"
/// Returns OBJ text (ASCII).
#[tauri::command]
async fn generate_mesh(
    app: tauri::AppHandle,
    image_base64: String,
    quality: String,
) -> Result<String, String> {
    let sidecar = app
        .shell()
        .sidecar("generate")
        .map_err(|e| e.to_string())?
        .args(["--quality", &quality]);

    let output = sidecar
        .spawn()
        .map_err(|e| e.to_string())?;

    // Write image to sidecar via stdin, read OBJ from stdout.
    // Full IPC wired in V6 release; stub returns a placeholder for now.
    let _ = output;
    let _ = image_base64;
    Err("generate_mesh: sidecar not yet bundled — build with Rust + TripoSR weights".into())
}

/// Download TripoSR weights on first run.
/// Emits progress events to the frontend window.
#[tauri::command]
async fn download_weights(app: tauri::AppHandle) -> Result<(), String> {
    let weight_urls = [
        "https://huggingface.co/stabilityai/TripoSR/resolve/main/model.ckpt",
    ];
    // V6: stream download with reqwest, emit tauri events for progress bar.
    // Stub: just report that weights are needed.
    app.emit("weight-download-required", weight_urls)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![generate_mesh, download_weights])
        .setup(|app| {
            // Kick off first-run weight check on startup
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let data_dir = handle.path().app_data_dir().unwrap_or_default();
                let weights = data_dir.join("triposr").join("model.ckpt");
                if !weights.exists() {
                    let _ = handle.emit("weights-missing", ());
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MADE application");
}
