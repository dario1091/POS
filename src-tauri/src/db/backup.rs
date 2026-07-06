use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use crate::db::connection::DbPool;

/// Configuration for the backup system
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupConfig {
    pub enabled: bool,
    pub interval_hours: u64,
    pub max_backups: usize,
    pub backup_path: String,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_hours: 4,
            max_backups: 5,
            backup_path: String::new(), // Will be set to app data dir / backups
        }
    }
}

impl BackupConfig {
    pub fn load(config_dir: &Path) -> Self {
        let config_path = config_dir.join("backup_config.json");
        if config_path.exists() {
            match fs::read_to_string(&config_path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => Self::default(),
            }
        } else {
            Self::default()
        }
    }

    pub fn save(&self, config_dir: &Path) -> Result<(), String> {
        let config_path = config_dir.join("backup_config.json");
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(config_path, json).map_err(|e| e.to_string())
    }
}

/// Information about a backup file
#[derive(Debug, serde::Serialize)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

/// Create a backup of the database using VACUUM INTO (safe, consistent copy)
pub fn create_backup(pool: &DbPool, backup_dir: &Path) -> Result<BackupInfo, String> {
    // Ensure backup directory exists
    fs::create_dir_all(backup_dir)
        .map_err(|e| format!("No se pudo crear directorio de backups: {}", e))?;

    // Generate filename with timestamp
    let now = chrono::Local::now();
    let filename = format!("pos_backup_{}.db", now.format("%Y-%m-%d_%H-%M-%S"));
    let backup_path = backup_dir.join(&filename);

    // Use VACUUM INTO for a safe, consistent copy
    let conn = pool.get().map_err(|e| e.to_string())?;
    let backup_path_str = backup_path.to_string_lossy().to_string();

    conn.execute_batch(&format!("VACUUM INTO '{}'", backup_path_str.replace('\'', "''")))
        .map_err(|e| format!("Error creando backup: {}", e))?;

    // Get file size
    let metadata = fs::metadata(&backup_path)
        .map_err(|e| format!("Error leyendo metadata del backup: {}", e))?;

    println!("Backup created: {} ({} bytes)", filename, metadata.len());

    Ok(BackupInfo {
        filename: filename.clone(),
        path: backup_path_str,
        size_bytes: metadata.len(),
        created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

/// Rotate backups: keep only the most recent `max_backups` files
pub fn rotate_backups(backup_dir: &Path, max_backups: usize) -> Result<u32, String> {
    let mut backups = list_backup_files(backup_dir)?;

    if backups.len() <= max_backups {
        return Ok(0);
    }

    // Sort by filename (which includes timestamp) — oldest first
    backups.sort();

    let to_remove = backups.len() - max_backups;
    let mut removed = 0;

    for filename in backups.iter().take(to_remove) {
        let path = backup_dir.join(filename);
        if fs::remove_file(&path).is_ok() {
            println!("Backup rotado (eliminado): {}", filename);
            removed += 1;
        }
    }

    Ok(removed)
}

/// List all backup files in the backup directory
pub fn list_backup_files(backup_dir: &Path) -> Result<Vec<String>, String> {
    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(backup_dir)
        .map_err(|e| format!("Error leyendo directorio de backups: {}", e))?;

    let mut files: Vec<String> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("pos_backup_") && name.ends_with(".db") {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    files.sort_by(|a, b| b.cmp(a)); // Most recent first
    Ok(files)
}

/// Get detailed info about all backups
pub fn list_backups_detailed(backup_dir: &Path) -> Result<Vec<BackupInfo>, String> {
    let files = list_backup_files(backup_dir)?;

    let mut backups: Vec<BackupInfo> = Vec::new();
    for filename in files {
        let path = backup_dir.join(&filename);
        if let Ok(metadata) = fs::metadata(&path) {
            // Extract date from filename: pos_backup_2026-07-06_14-00-00.db
            let created_at = filename
                .strip_prefix("pos_backup_")
                .and_then(|s| s.strip_suffix(".db"))
                .unwrap_or("")
                .replace('_', " ")
                .replacen('-', ":", 2); // Only replace last 2 dashes in time part

            // Better date parsing from filename
            let date_str = filename
                .strip_prefix("pos_backup_")
                .and_then(|s| s.strip_suffix(".db"))
                .unwrap_or("");

            let created_at = if date_str.len() >= 19 {
                // Format: 2026-07-06_14-00-00 → 2026-07-06 14:00:00
                format!("{}:{}", &date_str[..16].replace('_', " "), &date_str[17..])
                    .replacen('-', ":", 1)
            } else {
                date_str.replace('_', " ")
            };

            backups.push(BackupInfo {
                filename: filename.clone(),
                path: path.to_string_lossy().to_string(),
                size_bytes: metadata.len(),
                created_at,
            });
        }
    }

    Ok(backups)
}

/// Start the automatic backup thread
pub fn start_auto_backup(pool: DbPool, backup_dir: PathBuf, config: BackupConfig) {
    if !config.enabled {
        println!("Auto-backup disabled");
        return;
    }

    let interval = Duration::from_secs(config.interval_hours * 3600);
    let max_backups = config.max_backups;

    thread::spawn(move || {
        println!(
            "Auto-backup started: every {}h, max {} backups, path: {:?}",
            config.interval_hours, max_backups, backup_dir
        );

        loop {
            thread::sleep(interval);

            match create_backup(&pool, &backup_dir) {
                Ok(info) => {
                    println!("Auto-backup OK: {} ({} bytes)", info.filename, info.size_bytes);
                    if let Err(e) = rotate_backups(&backup_dir, max_backups) {
                        eprintln!("Error rotating backups: {}", e);
                    }
                }
                Err(e) => {
                    eprintln!("Auto-backup FAILED: {}", e);
                }
            }
        }
    });
}
