use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct ProductionSupplyInput {
    pub supply_id: i64,
    pub quantity: f64,
}

#[derive(Debug, Deserialize)]
pub struct ProductionItemInput {
    pub product_id: i64,
    pub quantity: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateProduction {
    pub supplies: Vec<ProductionSupplyInput>,
    pub items: Vec<ProductionItemInput>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProductionResult {
    pub id: i64,
    pub total_supply_cost: f64,
    pub supplies_count: i64,
    pub items_count: i64,
    pub warnings: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ProductionSummary {
    pub id: i64,
    pub notes: Option<String>,
    pub total_supply_cost: f64,
    pub supplies_count: i64,
    pub items_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ProductionDetail {
    pub id: i64,
    pub notes: Option<String>,
    pub total_supply_cost: f64,
    pub created_at: String,
    pub supplies: Vec<ProductionSupplyLine>,
    pub items: Vec<ProductionItemLine>,
}

#[derive(Debug, Serialize)]
pub struct ProductionSupplyLine {
    pub supply_name: String,
    pub quantity: f64,
    pub unit: String,
    pub cost: f64,
}

#[derive(Debug, Serialize)]
pub struct ProductionItemLine {
    pub product_name: String,
    pub quantity: f64,
}

#[tauri::command]
pub fn create_production(production: CreateProduction, state: State<'_, AppState>) -> Result<ProductionResult, String> {
    if production.supplies.is_empty() && production.items.is_empty() {
        return Err("Registra al menos un insumo consumido o un producto generado".to_string());
    }

    let conn = state.db.get().map_err(|e| e.to_string())?;
    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user.as_ref().ok_or("No hay sesión activa")?;
    let user_id = user.id;

    let mut warnings: Vec<String> = Vec::new();

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<ProductionResult, String> {
        // Insert header
        conn.execute(
            "INSERT INTO productions (user_id, notes, total_supply_cost) VALUES (?1, ?2, 0)",
            params![user_id, production.notes],
        ).map_err(|e| e.to_string())?;
        let production_id = conn.last_insert_rowid();

        let mut total_cost = 0.0;

        // Process consumed supplies
        for s in &production.supplies {
            let (name, unit, cost_per_unit, stock): (String, String, f64, f64) = conn.query_row(
                "SELECT name, unit, cost_per_unit, stock FROM supplies WHERE id = ?1",
                params![s.supply_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            ).map_err(|_| format!("Insumo no encontrado (id {})", s.supply_id))?;

            if s.quantity > stock {
                warnings.push(format!("{}: consumiste {} {} pero solo había {} {} (quedó en negativo)", name, s.quantity, unit, stock, unit));
            }

            let line_cost = s.quantity * cost_per_unit;
            total_cost += line_cost;

            conn.execute(
                "INSERT INTO production_supplies (production_id, supply_id, supply_name, quantity, unit, cost) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![production_id, s.supply_id, name, s.quantity, unit, line_cost],
            ).map_err(|e| e.to_string())?;

            // Deduct from supply stock
            conn.execute(
                "UPDATE supplies SET stock = stock - ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
                params![s.quantity, s.supply_id],
            ).map_err(|e| e.to_string())?;
        }

        // Process generated products
        for item in &production.items {
            let product_name: String = conn.query_row(
                "SELECT name FROM products WHERE id = ?1",
                params![item.product_id],
                |row| row.get(0),
            ).map_err(|_| format!("Producto no encontrado (id {})", item.product_id))?;

            conn.execute(
                "INSERT INTO production_items (production_id, product_id, product_name, quantity) VALUES (?1, ?2, ?3, ?4)",
                params![production_id, item.product_id, product_name, item.quantity],
            ).map_err(|e| e.to_string())?;

            // Add to product stock
            conn.execute(
                "UPDATE products SET stock = stock + ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
                params![item.quantity, item.product_id],
            ).map_err(|e| e.to_string())?;
        }

        // Update total cost
        conn.execute(
            "UPDATE productions SET total_supply_cost = ?1 WHERE id = ?2",
            params![total_cost, production_id],
        ).map_err(|e| e.to_string())?;

        let created_at: String = conn.query_row(
            "SELECT created_at FROM productions WHERE id = ?1", params![production_id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;

        Ok(ProductionResult {
            id: production_id,
            total_supply_cost: total_cost,
            supplies_count: production.supplies.len() as i64,
            items_count: production.items.len() as i64,
            warnings: warnings.clone(),
            created_at,
        })
    })();

    match result {
        Ok(r) => { conn.execute("COMMIT", []).ok(); Ok(r) }
        Err(e) => { conn.execute("ROLLBACK", []).ok(); Err(e) }
    }
}

#[tauri::command]
pub fn list_productions(limit: i64, state: State<'_, AppState>) -> Result<Vec<ProductionSummary>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT p.id, p.notes, p.total_supply_cost, p.created_at,
                (SELECT COUNT(*) FROM production_supplies WHERE production_id = p.id) as sc,
                (SELECT COUNT(*) FROM production_items WHERE production_id = p.id) as ic
         FROM productions p ORDER BY p.id DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![limit], |row| {
        Ok(ProductionSummary {
            id: row.get(0)?,
            notes: row.get(1)?,
            total_supply_cost: row.get(2)?,
            created_at: row.get(3)?,
            supplies_count: row.get(4)?,
            items_count: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn get_production_detail(production_id: i64, state: State<'_, AppState>) -> Result<ProductionDetail, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let (notes, total_supply_cost, created_at): (Option<String>, f64, String) = conn.query_row(
        "SELECT notes, total_supply_cost, created_at FROM productions WHERE id = ?1",
        params![production_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).map_err(|_| "Producción no encontrada".to_string())?;

    let supplies: Vec<ProductionSupplyLine> = {
        let mut stmt = conn.prepare(
            "SELECT supply_name, quantity, unit, cost FROM production_supplies WHERE production_id = ?1"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![production_id], |row| {
            Ok(ProductionSupplyLine {
                supply_name: row.get(0)?,
                quantity: row.get(1)?,
                unit: row.get(2)?,
                cost: row.get(3)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let items: Vec<ProductionItemLine> = {
        let mut stmt = conn.prepare(
            "SELECT product_name, quantity FROM production_items WHERE production_id = ?1"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![production_id], |row| {
            Ok(ProductionItemLine {
                product_name: row.get(0)?,
                quantity: row.get(1)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    Ok(ProductionDetail { id: production_id, notes, total_supply_cost, created_at, supplies, items })
}
