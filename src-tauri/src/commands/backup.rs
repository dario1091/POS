use tauri::State;

use crate::db::backup::{self, BackupConfig, BackupInfo};
use crate::AppState;

#[tauri::command]
pub fn create_backup(state: State<'_, AppState>) -> Result<BackupInfo, String> {
    let backup_dir = state.config_path.parent()
        .unwrap_or(state.config_path.as_path())
        .join("backups");

    let info = backup::create_backup(&state.db, &backup_dir)?;

    // Rotate after manual backup too
    let config = BackupConfig::load(state.config_path.parent().unwrap_or(state.config_path.as_path()));
    backup::rotate_backups(&backup_dir, config.max_backups)?;

    Ok(info)
}

#[tauri::command]
pub fn list_backups(state: State<'_, AppState>) -> Result<Vec<BackupInfo>, String> {
    let backup_dir = state.config_path.parent()
        .unwrap_or(state.config_path.as_path())
        .join("backups");

    backup::list_backups_detailed(&backup_dir)
}

#[tauri::command]
pub fn get_backup_config(state: State<'_, AppState>) -> Result<BackupConfig, String> {
    let config_dir = state.config_path.parent()
        .unwrap_or(state.config_path.as_path());
    Ok(BackupConfig::load(config_dir))
}

#[tauri::command]
pub fn set_backup_config(config: BackupConfig, state: State<'_, AppState>) -> Result<(), String> {
    let config_dir = state.config_path.parent()
        .unwrap_or(state.config_path.as_path());
    config.save(config_dir)
}
