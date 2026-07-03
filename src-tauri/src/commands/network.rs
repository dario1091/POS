use tauri::State;

use crate::network::config::NetworkConfig;
use crate::AppState;

#[tauri::command]
pub fn get_network_config(state: State<'_, AppState>) -> Result<NetworkConfig, String> {
    let config = state.network_config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn set_network_config(
    role: String,
    port: u16,
    server_ip: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.network_config.lock().map_err(|e| e.to_string())?;
    config.role = role;
    config.port = port;
    config.server_ip = server_ip;
    config.save(&state.config_path)?;
    Ok(())
}

#[tauri::command]
pub async fn check_server_connection(state: State<'_, AppState>) -> Result<bool, String> {
    let config = state.network_config.lock().map_err(|e| e.to_string())?.clone();

    if !config.is_client() {
        return Ok(true); // Server/standalone is always "connected"
    }

    match config.server_url() {
        Some(url) => {
            let client = crate::network::client::LanClient::new(&url);
            match client.health_check().await {
                Ok(_) => Ok(true),
                Err(_) => Ok(false),
            }
        }
        None => Ok(false),
    }
}

#[tauri::command]
pub fn is_configured(state: State<'_, AppState>) -> Result<bool, String> {
    let config = state.network_config.lock().map_err(|e| e.to_string())?;
    Ok(config.role != "standalone")
}
