use serde::Serialize;
use std::process::Command;

const REPO: &str = "dario1091/POS";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub download_url: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", REPO);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "POS-System-Updater")
        .send()
        .await
        .map_err(|e| format!("Error conectando a GitHub: {}", e))?;

    if !response.status().is_success() {
        return Err("No se pudo verificar actualizaciones".to_string());
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Error parseando respuesta: {}", e))?;

    let latest_tag = data["tag_name"]
        .as_str()
        .unwrap_or("v0.0.0")
        .trim_start_matches('v')
        .to_string();

    let download_url = data["assets"]
        .as_array()
        .and_then(|assets| {
            assets.iter().find(|a| {
                a["name"]
                    .as_str()
                    .map(|n| n.ends_with(".deb"))
                    .unwrap_or(false)
            })
        })
        .and_then(|a| a["browser_download_url"].as_str())
        .map(|s| s.to_string());

    let has_update = version_gt(&latest_tag, CURRENT_VERSION);

    Ok(UpdateInfo {
        current_version: CURRENT_VERSION.to_string(),
        latest_version: latest_tag,
        has_update,
        download_url,
    })
}

#[tauri::command]
pub async fn install_update(download_url: String) -> Result<String, String> {
    // Download .deb to tmp
    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .header("User-Agent", "POS-System-Updater")
        .send()
        .await
        .map_err(|e| format!("Error descargando: {}", e))?;

    if !response.status().is_success() {
        return Err("Error descargando actualización".to_string());
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let tmp_path = "/tmp/pos-system-update.deb";

    std::fs::write(tmp_path, &bytes)
        .map_err(|e| format!("Error guardando archivo: {}", e))?;

    // Install using pkexec (shows password dialog)
    let output = Command::new("pkexec")
        .args(["dpkg", "-i", tmp_path])
        .output()
        .map_err(|e| format!("Error ejecutando instalador: {}", e))?;

    // Clean up
    let _ = std::fs::remove_file(tmp_path);

    if output.status.success() {
        Ok("Actualización instalada. Reinicia la aplicación.".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Error instalando: {}", stderr))
    }
}

/// Compare semver versions (simple: a > b?)
fn version_gt(a: &str, b: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse().ok()).collect()
    };
    let va = parse(a);
    let vb = parse(b);
    for i in 0..3 {
        let na = va.get(i).copied().unwrap_or(0);
        let nb = vb.get(i).copied().unwrap_or(0);
        if na > nb { return true; }
        if na < nb { return false; }
    }
    false
}
