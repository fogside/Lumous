use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

fn get_data_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    let boards_dir = dir.join("boards");
    fs::create_dir_all(&boards_dir).ok();
    dir
}

#[tauri::command]
fn load_meta(app: tauri::AppHandle) -> Result<String, String> {
    let path = get_data_path(&app).join("meta.json");
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(_) => {
            let default = serde_json::json!({
                "boardOrder": [],
                "settings": {
                    "syncRepoUrl": "",
                    "syncIntervalMinutes": 5,
                    "lastSyncedAt": null
                }
            });
            let s = serde_json::to_string_pretty(&default).unwrap();
            fs::write(&path, &s).map_err(|e| e.to_string())?;
            Ok(s)
        }
    }
}

#[tauri::command]
fn save_meta(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let path = get_data_path(&app).join("meta.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_board(app: tauri::AppHandle, id: String) -> Result<String, String> {
    let path = get_data_path(&app).join("boards").join(format!("{}.json", id));
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_board(app: tauri::AppHandle, id: String, data: String) -> Result<(), String> {
    let path = get_data_path(&app).join("boards").join(format!("{}.json", id));
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_board_file(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let path = get_data_path(&app).join("boards").join(format!("{}.json", id));
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = get_data_path(&app);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn git_run(app: tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
    let dir = get_data_path(&app);
    let output = Command::new("git")
        .args(&args)
        .current_dir(&dir)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("{}\n{}", stdout, stderr))
    }
}

#[tauri::command]
fn check_online() -> bool {
    Command::new("curl")
        .args(["--silent", "--head", "--max-time", "3", "https://github.com"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Ensure data directory exists on startup
            get_data_path(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_meta,
            save_meta,
            load_board,
            save_board,
            delete_board_file,
            get_data_dir,
            git_run,
            check_online,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
