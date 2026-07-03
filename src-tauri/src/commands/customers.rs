use rusqlite::params;
use tauri::State;

use crate::db::models::{CreateCustomer, Customer, UpdateCustomer};
use crate::AppState;

#[tauri::command]
pub fn create_customer(customer: CreateCustomer, state: State<'_, AppState>) -> Result<Customer, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO customers (name, phone, email, address, credit_limit) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![customer.name, customer.phone, customer.email, customer.address, customer.credit_limit.unwrap_or(0.0)],
    )
    .map_err(|e| format!("Error al crear cliente: {}", e))?;

    let id = conn.last_insert_rowid();
    get_customer_by_id(id, &conn)
}

#[tauri::command]
pub fn update_customer(customer: UpdateCustomer, state: State<'_, AppState>) -> Result<Customer, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    if let Some(ref name) = customer.name {
        conn.execute(
            "UPDATE customers SET name = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![name, customer.id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(ref phone) = customer.phone {
        conn.execute(
            "UPDATE customers SET phone = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![phone, customer.id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(ref email) = customer.email {
        conn.execute(
            "UPDATE customers SET email = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![email, customer.id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(ref address) = customer.address {
        conn.execute(
            "UPDATE customers SET address = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![address, customer.id],
        ).map_err(|e| e.to_string())?;
    }
    if let Some(credit_limit) = customer.credit_limit {
        conn.execute(
            "UPDATE customers SET credit_limit = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![credit_limit, customer.id],
        ).map_err(|e| e.to_string())?;
    }

    get_customer_by_id(customer.id, &conn)
}

#[tauri::command]
pub fn list_customers(state: State<'_, AppState>) -> Result<Vec<Customer>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone, email, address, credit_limit, credit_balance, created_at, updated_at 
             FROM customers ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let customers = stmt
        .query_map([], |row| row_to_customer(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(customers)
}

#[tauri::command]
pub fn search_customers(query: String, state: State<'_, AppState>) -> Result<Vec<Customer>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let search_term = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone, email, address, credit_limit, credit_balance, created_at, updated_at 
             FROM customers WHERE name LIKE ?1 OR phone LIKE ?1 ORDER BY name LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let customers = stmt
        .query_map(params![search_term], |row| row_to_customer(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(customers)
}

fn get_customer_by_id(id: i64, conn: &rusqlite::Connection) -> Result<Customer, String> {
    conn.query_row(
        "SELECT id, name, phone, email, address, credit_limit, credit_balance, created_at, updated_at FROM customers WHERE id = ?1",
        params![id],
        |row| row_to_customer(row),
    )
    .map_err(|e| e.to_string())
}

fn row_to_customer(row: &rusqlite::Row) -> Result<Customer, rusqlite::Error> {
    Ok(Customer {
        id: row.get(0)?,
        name: row.get(1)?,
        phone: row.get(2)?,
        email: row.get(3)?,
        address: row.get(4)?,
        credit_limit: row.get(5)?,
        credit_balance: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}
