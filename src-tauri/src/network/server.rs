use axum::{
    extract::State as AxumState,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

use crate::db::connection::DbPool;
use crate::db::models::*;
use crate::commands::auth::hash_password;

/// Shared state for Axum handlers
pub struct ServerState {
    pub db: DbPool,
}

type AppState = Arc<ServerState>;

/// Start the HTTP server on the specified port
pub async fn start_server(db: DbPool, port: u16) -> Result<(), String> {
    let state = Arc::new(ServerState { db });

    let app = Router::new()
        // Health
        .route("/api/health", get(health))
        // Auth
        .route("/api/login", post(login))
        // Products
        .route("/api/products", get(list_products))
        .route("/api/products/search-by-code", post(search_product_by_code))
        .route("/api/products/search-by-name", post(search_products_by_name))
        // Categories
        .route("/api/categories", get(list_categories))
        // Customers
        .route("/api/customers", get(list_customers))
        .route("/api/customers/search", post(search_customers))
        // Sales
        .route("/api/sales", post(create_sale))
        .route("/api/sales/daily", post(get_daily_sales))
        // Config
        .route("/api/config", get(get_config))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    println!("LAN Server starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| format!("Server error: {}", e))
}

// --- Handlers ---

async fn health() -> &'static str {
    "ok"
}

#[derive(Deserialize)]
struct LoginReq {
    username: String,
    password: String,
}

async fn login(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<LoginReq>,
) -> Result<Json<User>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = conn.query_row(
        "SELECT id, username, password_hash, full_name, role, active, created_at, updated_at 
         FROM users WHERE username = ?1 AND active = 1",
        rusqlite::params![req.username],
        |row| Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, bool>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, String>(7)?,
        )),
    ).map_err(|_| (StatusCode::UNAUTHORIZED, "Usuario no encontrado".to_string()))?;

    let (id, username, password_hash, full_name, role, active, created_at, updated_at) = result;

    // Verify password
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    use argon2::Argon2;
    let parsed_hash = PasswordHash::new(&password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hash error".to_string()))?;
    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Contraseña incorrecta".to_string()))?;

    Ok(Json(User { id, username, full_name, role, active, created_at, updated_at }))
}

async fn list_products(
    AxumState(state): AxumState<AppState>,
) -> Result<Json<Vec<Product>>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, barcode, name, description, category_id, sale_price, cost_price, 
                stock, unit, min_stock, price_type, active, created_at, updated_at 
         FROM products WHERE active = 1 ORDER BY name"
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let products = stmt.query_map([], |row| {
        Ok(Product {
            id: row.get(0)?, barcode: row.get(1)?, name: row.get(2)?,
            description: row.get(3)?, category_id: row.get(4)?,
            sale_price: row.get(5)?, cost_price: row.get(6)?,
            stock: row.get(7)?, unit: row.get(8)?, min_stock: row.get(9)?,
            price_type: row.get(10)?, active: row.get(11)?, created_at: row.get(12)?, updated_at: row.get(13)?,
        })
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(products))
}

#[derive(Deserialize)]
struct CodeQuery { code: String }

async fn search_product_by_code(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<CodeQuery>,
) -> Result<Json<Option<Product>>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = conn.query_row(
        "SELECT id, barcode, name, description, category_id, sale_price, cost_price, 
                stock, unit, min_stock, price_type, active, created_at, updated_at 
         FROM products WHERE (barcode = ?1 OR id = ?2) AND active = 1 LIMIT 1",
        rusqlite::params![req.code, req.code.parse::<i64>().unwrap_or(-1)],
        |row| Ok(Product {
            id: row.get(0)?, barcode: row.get(1)?, name: row.get(2)?,
            description: row.get(3)?, category_id: row.get(4)?,
            sale_price: row.get(5)?, cost_price: row.get(6)?,
            stock: row.get(7)?, unit: row.get(8)?, min_stock: row.get(9)?,
            price_type: row.get(10)?, active: row.get(11)?, created_at: row.get(12)?, updated_at: row.get(13)?,
        }),
    );

    match result {
        Ok(p) => Ok(Json(Some(p))),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(Json(None)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
struct NameQuery { name: String }

async fn search_products_by_name(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<NameQuery>,
) -> Result<Json<Vec<Product>>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let term = format!("%{}%", req.name);

    let mut stmt = conn.prepare(
        "SELECT id, barcode, name, description, category_id, sale_price, cost_price, 
                stock, unit, min_stock, price_type, active, created_at, updated_at 
         FROM products WHERE name LIKE ?1 AND active = 1 ORDER BY name LIMIT 20"
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let products = stmt.query_map(rusqlite::params![term], |row| {
        Ok(Product {
            id: row.get(0)?, barcode: row.get(1)?, name: row.get(2)?,
            description: row.get(3)?, category_id: row.get(4)?,
            sale_price: row.get(5)?, cost_price: row.get(6)?,
            stock: row.get(7)?, unit: row.get(8)?, min_stock: row.get(9)?,
            price_type: row.get(10)?, active: row.get(11)?, created_at: row.get(12)?, updated_at: row.get(13)?,
        })
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(products))
}

async fn list_categories(
    AxumState(state): AxumState<AppState>,
) -> Result<Json<Vec<Category>>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, name, description, active, created_at FROM categories WHERE active = 1 ORDER BY name"
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let cats = stmt.query_map([], |row| {
        Ok(Category { id: row.get(0)?, name: row.get(1)?, description: row.get(2)?, active: row.get(3)?, created_at: row.get(4)? })
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(cats))
}

async fn list_customers(
    AxumState(state): AxumState<AppState>,
) -> Result<Json<Vec<Customer>>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, name, phone, email, address, credit_limit, credit_balance, created_at, updated_at FROM customers ORDER BY name"
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let customers = stmt.query_map([], |row| {
        Ok(Customer { id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, email: row.get(3)?, address: row.get(4)?, credit_limit: row.get(5)?, credit_balance: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(customers))
}

async fn search_customers(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<NameQuery>,
) -> Result<Json<Vec<Customer>>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let term = format!("%{}%", req.name);

    let mut stmt = conn.prepare(
        "SELECT id, name, phone, email, address, credit_limit, credit_balance, created_at, updated_at 
         FROM customers WHERE name LIKE ?1 OR phone LIKE ?1 ORDER BY name LIMIT 20"
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let customers = stmt.query_map(rusqlite::params![term], |row| {
        Ok(Customer { id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, email: row.get(3)?, address: row.get(4)?, credit_limit: row.get(5)?, credit_balance: row.get(6)?, created_at: row.get(7)?, updated_at: row.get(8)? })
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(customers))
}

#[derive(Deserialize)]
struct CreateSaleReq {
    customer_id: Option<i64>,
    user_id: i64,
    items: Vec<SaleItemInput>,
    payments: Vec<PaymentInput>,
    discount: f64,
}

async fn create_sale(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<CreateSaleReq>,
) -> Result<Json<Sale>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let subtotal: f64 = req.items.iter().map(|i| (i.quantity * i.unit_price) - i.discount).sum();
    let total = subtotal - req.discount;
    let total_paid: f64 = req.payments.iter().map(|p| p.amount).sum();
    let payment_method = if req.payments.len() == 1 { req.payments[0].method.clone() } else { "mixto".to_string() };
    let change = if total_paid > total { total_paid - total } else { 0.0 };

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = (|| -> Result<Sale, String> {
        conn.execute(
            "INSERT INTO sales (customer_id, user_id, subtotal, discount, total, payment_method, amount_paid, change_amount)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![req.customer_id, req.user_id, subtotal, req.discount, total, payment_method, total_paid, change],
        ).map_err(|e| e.to_string())?;

        let sale_id = conn.last_insert_rowid();

        for item in &req.items {
            let sub = (item.quantity * item.unit_price) - item.discount;
            conn.execute(
                "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount, subtotal) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                rusqlite::params![sale_id, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount, sub],
            ).map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE products SET stock = stock - ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
                rusqlite::params![item.quantity, item.product_id],
            ).map_err(|e| e.to_string())?;
        }

        for p in &req.payments {
            conn.execute(
                "INSERT INTO sale_payments (sale_id, method, amount) VALUES (?1,?2,?3)",
                rusqlite::params![sale_id, p.method, p.amount],
            ).map_err(|e| e.to_string())?;
        }

        conn.query_row(
            "SELECT id, customer_id, user_id, subtotal, discount, total, payment_method, amount_paid, change_amount, machine_id, created_at FROM sales WHERE id = ?1",
            rusqlite::params![sale_id],
            |row| Ok(Sale { id: row.get(0)?, customer_id: row.get(1)?, user_id: row.get(2)?, subtotal: row.get(3)?, discount: row.get(4)?, total: row.get(5)?, payment_method: row.get(6)?, amount_paid: row.get(7)?, change_amount: row.get(8)?, machine_id: row.get(9)?, created_at: row.get(10)? }),
        ).map_err(|e| e.to_string())
    })();

    match result {
        Ok(sale) => { conn.execute("COMMIT", []).ok(); Ok(Json(sale)) }
        Err(e) => { conn.execute("ROLLBACK", []).ok(); Err((StatusCode::INTERNAL_SERVER_ERROR, e)) }
    }
}

#[derive(Deserialize)]
struct DateQuery { date: String }

async fn get_daily_sales(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<DateQuery>,
) -> Result<Json<Vec<Sale>>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, customer_id, user_id, subtotal, discount, total, payment_method, amount_paid, change_amount, machine_id, created_at FROM sales WHERE date(created_at) = date(?1) ORDER BY created_at DESC"
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let sales = stmt.query_map(rusqlite::params![req.date], |row| {
        Ok(Sale { id: row.get(0)?, customer_id: row.get(1)?, user_id: row.get(2)?, subtotal: row.get(3)?, discount: row.get(4)?, total: row.get(5)?, payment_method: row.get(6)?, amount_paid: row.get(7)?, change_amount: row.get(8)?, machine_id: row.get(9)?, created_at: row.get(10)? })
    }).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(sales))
}

async fn get_config(
    AxumState(state): AxumState<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let conn = state.db.get().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut config = serde_json::Map::new();
    let mut stmt = conn.prepare("SELECT key, value FROM config").map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_,String>(0)?, row.get::<_,String>(1)?))).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for row in rows { if let Ok((k,v)) = row { config.insert(k, serde_json::Value::String(v)); } }
    Ok(Json(serde_json::Value::Object(config)))
}
