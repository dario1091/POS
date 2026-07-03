use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub full_name: String,
    pub role: String,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub active: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: i64,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<i64>,
    pub sale_price: f64,
    pub cost_price: f64,
    pub stock: f64,
    pub unit: String,
    pub min_stock: f64,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Customer {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub credit_limit: f64,
    pub credit_balance: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Sale {
    pub id: i64,
    pub customer_id: Option<i64>,
    pub user_id: i64,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub payment_method: String,
    pub amount_paid: f64,
    pub change_amount: f64,
    pub machine_id: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaleItem {
    pub id: i64,
    pub sale_id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub discount: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InventoryAdjustment {
    pub id: i64,
    pub product_id: i64,
    pub user_id: i64,
    #[serde(rename = "type")]
    pub adjustment_type: String,
    pub quantity: f64,
    pub reason: String,
    pub created_at: String,
}

// --- DTOs for creating/updating ---

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub username: String,
    pub password: String,
    pub full_name: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub id: i64,
    pub username: Option<String>,
    pub password: Option<String>,
    pub full_name: Option<String>,
    pub role: Option<String>,
    pub active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProduct {
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<i64>,
    pub sale_price: f64,
    pub cost_price: f64,
    pub stock: f64,
    pub unit: String,
    pub min_stock: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProduct {
    pub id: i64,
    pub barcode: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub category_id: Option<i64>,
    pub sale_price: Option<f64>,
    pub cost_price: Option<f64>,
    pub stock: Option<f64>,
    pub unit: Option<String>,
    pub min_stock: Option<f64>,
    pub active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCustomer {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub credit_limit: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCustomer {
    pub id: i64,
    pub name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub credit_limit: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaleItemInput {
    pub product_id: i64,
    pub product_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub discount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentInput {
    pub method: String,
    pub amount: f64,
    pub reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSale {
    pub customer_id: Option<i64>,
    pub items: Vec<SaleItemInput>,
    pub payments: Vec<PaymentInput>,
    pub discount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SalePayment {
    pub id: i64,
    pub sale_id: i64,
    pub method: String,
    pub amount: f64,
    pub reference: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductBarcode {
    pub id: i64,
    pub product_id: i64,
    pub barcode: String,
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddBarcode {
    pub product_id: i64,
    pub barcode: String,
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdjustInventory {
    pub product_id: i64,
    pub adjustment_type: String,
    pub quantity: f64,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}
