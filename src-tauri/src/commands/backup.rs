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

#[tauri::command]
pub fn copy_backup_to_desktop(filename: String, state: State<'_, AppState>) -> Result<String, String> {
    let backup_dir = state.config_path.parent()
        .unwrap_or(state.config_path.as_path())
        .join("backups");

    let source = backup_dir.join(&filename);
    if !source.exists() {
        return Err(format!("Backup no encontrado: {}", filename));
    }

    let desktop = dirs::desktop_dir()
        .ok_or("No se pudo determinar la ruta del Escritorio")?;

    let dest = desktop.join(&filename);
    std::fs::copy(&source, &dest)
        .map_err(|e| format!("Error copiando al escritorio: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_backup(filename: String, state: State<'_, AppState>) -> Result<String, String> {
    let app_dir = state.config_path.parent()
        .unwrap_or(state.config_path.as_path());
    let backup_dir = app_dir.join("backups");
    let source = backup_dir.join(&filename);

    restore_from_path(&source, state)
}

#[tauri::command]
pub fn restore_backup_from_file(file_path: String, state: State<'_, AppState>) -> Result<String, String> {
    let source = std::path::PathBuf::from(&file_path);
    restore_from_path(&source, state)
}

fn restore_from_path(source: &std::path::Path, state: State<'_, AppState>) -> Result<String, String> {
    let app_dir = state.config_path.parent()
        .unwrap_or(state.config_path.as_path());
    let backup_dir = app_dir.join("backups");
    let db_path = app_dir.join("pos.db");

    if !source.exists() {
        return Err(format!("Archivo no encontrado: {}", source.display()));
    }

    // Validate it's a valid SQLite file
    let header = std::fs::read(source)
        .map_err(|e| format!("Error leyendo archivo: {}", e))?;
    if header.len() < 16 || &header[0..16] != b"SQLite format 3\0" {
        return Err("El archivo no es una base de datos SQLite válida".to_string());
    }

    // Create a safety backup of current DB before overwriting
    let safety_name = format!("pos_pre_restore_{}.db", chrono::Local::now().format("%Y-%m-%d_%H-%M-%S"));
    let safety_path = backup_dir.join(&safety_name);
    std::fs::create_dir_all(&backup_dir).ok();
    let _ = std::fs::copy(&db_path, &safety_path);

    // Replace the database file
    drop(state.db.get().ok());
    std::fs::copy(source, &db_path)
        .map_err(|e| format!("Error restaurando: {}", e))?;

    Ok(format!("Restaurado correctamente. Respaldo de seguridad: {}. Reinicia la aplicación.", safety_name))
}
