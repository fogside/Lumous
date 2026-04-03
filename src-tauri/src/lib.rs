use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let dest = dst.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir_recursive(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), &dest)?;
        }
    }
    Ok(())
}

fn get_data_path(app: &tauri::AppHandle) -> PathBuf {
    let mut dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    if cfg!(debug_assertions) {
        dir = dir.with_file_name(format!("{}-dev", dir.file_name().unwrap().to_string_lossy()));
    }
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

/// Strip transient wizard fields (proposed cards, highlights) from all board files.
/// Called before git sync so wizard-local state doesn't get committed.
#[tauri::command]
fn strip_wizard_transient(app: tauri::AppHandle) -> Result<(), String> {
    let boards_dir = get_data_path(&app).join("boards");
    let entries = fs::read_dir(&boards_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let mut board: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let mut changed = false;
        if let Some(cards) = board.get_mut("cards").and_then(|c| c.as_object_mut()) {
            // Collect IDs of proposed cards to remove entirely
            let proposed_ids: Vec<String> = cards.iter()
                .filter(|(_, v)| v.get("proposed").and_then(|p| p.as_bool()).unwrap_or(false))
                .map(|(k, _)| k.clone())
                .collect();

            for id in &proposed_ids {
                cards.remove(id);
                changed = true;
            }

            // Strip highlight fields from remaining cards
            for (_, card) in cards.iter_mut() {
                if let Some(obj) = card.as_object_mut() {
                    if obj.remove("highlighted").is_some() { changed = true; }
                    if obj.remove("highlightReason").is_some() { changed = true; }
                }
            }

            // Remove proposed card IDs from column cardIds arrays
            if !proposed_ids.is_empty() {
                if let Some(columns) = board.get_mut("columns").and_then(|c| c.as_array_mut()) {
                    for col in columns.iter_mut() {
                        if let Some(card_ids) = col.get_mut("cardIds").and_then(|c| c.as_array_mut()) {
                            let before = card_ids.len();
                            card_ids.retain(|id| {
                                id.as_str().map(|s| !proposed_ids.contains(&s.to_string())).unwrap_or(true)
                            });
                            if card_ids.len() != before { changed = true; }
                        }
                    }
                }
            }
        }

        if changed {
            let clean = serde_json::to_string_pretty(&board).map_err(|e| e.to_string())?;
            fs::write(&path, clean).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
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
async fn run_claude(system_prompt: String, user_prompt: String) -> Result<String, String> {
    // Build a PATH that includes common CLI install locations
    // macOS app bundles don't inherit shell PATH, so we must set it explicitly
    let home = std::env::var("HOME").unwrap_or_default();
    let extra_paths = [
        format!("{}/.local/bin", home),
        format!("{}/.nvm/versions/node/v20/bin", home),  // nvm
        format!("{}/.cargo/bin", home),
        "/usr/local/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
    ];
    let sys_path = std::env::var("PATH").unwrap_or_default();
    let full_path = format!("{}:{}", extra_paths.join(":"), sys_path);

    let output = Command::new("claude")
        .arg("-p")
        .arg(&user_prompt)
        .arg("--system-prompt")
        .arg(&system_prompt)
        .arg("--output-format")
        .arg("text")
        .arg("--model")
        .arg("claude-opus-4-6")
        .env("PATH", &full_path)
        .current_dir(&home) // avoid network volume prompts from cwd
        .output()
        .map_err(|e| format!("Failed to run claude: {}. Is Claude Code installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Claude CLI error: {}", stderr));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn get_board_mtime(app: tauri::AppHandle, id: String) -> Result<u64, String> {
    let path = get_data_path(&app).join("boards").join(format!("{}.json", id));
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    Ok(modified
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64)
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Migrate data from old identifier (com.zenja.todo) if it exists
            let new_dir = app.handle().path().app_data_dir().expect("app data dir");
            if !new_dir.join("meta.json").exists() {
                if let Some(parent) = new_dir.parent() {
                    let old_dir = parent.join("com.zenja.todo");
                    if old_dir.join("meta.json").exists() {
                        fs::create_dir_all(&new_dir).ok();
                        // Copy all files from old dir to new dir
                        if let Ok(entries) = fs::read_dir(&old_dir) {
                            for entry in entries.flatten() {
                                let dest = new_dir.join(entry.file_name());
                                if entry.path().is_dir() {
                                    let _ = copy_dir_recursive(&entry.path(), &dest);
                                } else {
                                    let _ = fs::copy(entry.path(), &dest);
                                }
                            }
                        }
                    }
                }
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
            get_board_mtime,
            strip_wizard_transient,
            run_claude,
            git_run,
            check_online,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
