use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub role: String, // "server" or "client"
    pub port: u16,
    pub server_ip: Option<String>, // Only for clients
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            role: "standalone".to_string(),
            port: 3847,
            server_ip: None,
        }
    }
}

impl NetworkConfig {
    pub fn load(config_path: &PathBuf) -> Self {
        if config_path.exists() {
            match fs::read_to_string(config_path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => Self::default(),
            }
        } else {
            Self::default()
        }
    }

    pub fn save(&self, config_path: &PathBuf) -> Result<(), String> {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(config_path, json).map_err(|e| e.to_string())
    }

    pub fn is_server(&self) -> bool {
        self.role == "server"
    }

    pub fn is_client(&self) -> bool {
        self.role == "client"
    }

    pub fn server_url(&self) -> Option<String> {
        if self.is_client() {
            self.server_ip.as_ref().map(|ip| format!("http://{}:{}", ip, self.port))
        } else {
            None
        }
    }
}
