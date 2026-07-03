use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;

use crate::db::models::*;

/// HTTP client for connecting to the LAN server
pub struct LanClient {
    client: Client,
    base_url: String,
}

impl LanClient {
    pub fn new(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn health_check(&self) -> Result<(), String> {
        let url = format!("{}/api/health", self.base_url);
        self.client.get(&url).send().await
            .map_err(|e| format!("No se pudo conectar al servidor: {}", e))?;
        Ok(())
    }

    pub async fn login(&self, username: &str, password: &str) -> Result<User, String> {
        let url = format!("{}/api/login", self.base_url);
        let resp = self.client.post(&url)
            .json(&serde_json::json!({ "username": username, "password": password }))
            .send().await.map_err(|e| format!("Error de conexión: {}", e))?;

        if !resp.status().is_success() {
            let msg = resp.text().await.unwrap_or_default();
            return Err(msg);
        }
        resp.json::<User>().await.map_err(|e| e.to_string())
    }

    pub async fn list_products(&self) -> Result<Vec<Product>, String> {
        let url = format!("{}/api/products", self.base_url);
        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn search_product_by_code(&self, code: &str) -> Result<Option<Product>, String> {
        let url = format!("{}/api/products/search-by-code", self.base_url);
        let resp = self.client.post(&url)
            .json(&serde_json::json!({ "code": code }))
            .send().await.map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn search_products_by_name(&self, name: &str) -> Result<Vec<Product>, String> {
        let url = format!("{}/api/products/search-by-name", self.base_url);
        let resp = self.client.post(&url)
            .json(&serde_json::json!({ "name": name }))
            .send().await.map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn list_categories(&self) -> Result<Vec<Category>, String> {
        let url = format!("{}/api/categories", self.base_url);
        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn list_customers(&self) -> Result<Vec<Customer>, String> {
        let url = format!("{}/api/customers", self.base_url);
        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn search_customers(&self, query: &str) -> Result<Vec<Customer>, String> {
        let url = format!("{}/api/customers/search", self.base_url);
        let resp = self.client.post(&url)
            .json(&serde_json::json!({ "name": query }))
            .send().await.map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn create_sale(&self, user_id: i64, sale: &CreateSale) -> Result<Sale, String> {
        let url = format!("{}/api/sales", self.base_url);
        let body = serde_json::json!({
            "customer_id": sale.customer_id,
            "user_id": user_id,
            "items": sale.items,
            "payments": sale.payments,
            "discount": sale.discount,
        });
        let resp = self.client.post(&url)
            .json(&body)
            .send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let msg = resp.text().await.unwrap_or_default();
            return Err(msg);
        }
        resp.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_daily_sales(&self, date: &str) -> Result<Vec<Sale>, String> {
        let url = format!("{}/api/sales/daily", self.base_url);
        let resp = self.client.post(&url)
            .json(&serde_json::json!({ "date": date }))
            .send().await.map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }
}
