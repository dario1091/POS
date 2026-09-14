use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

const SUPPLY_COLS: &str = "id, name, unit, stock, cost_per_unit, min_stock, active, track_stock, created_at, updated_at";

#[derive(Debug, Serialize)]
pub struct Supply {
    pub id: i64,
    pub name: String,
    pub unit: String,
    pub stock: f64,
    pub cost_per_unit: f64,
    pub min_stock: f64,
    pub active: bool,
    pub track_stock: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSupply {
    pub name: String,
    pub unit: String,
    pub stock: f64,
    pub cost_per_unit: f64,
    pub min_stock: f64,
    #[serde(default = "default_true")]
    pub track_stock: bool,
}

fn default_true() -> bool { true }

#[derive(Debug, Deserialize)]
pub struct UpdateSupply {
    pub id: i64,
    pub name: Option<String>,
    pub unit: Option<String>,
    pub cost_per_unit: Option<f64>,
    pub min_stock: Option<f64>,
    pub active: Option<bool>,
    pub track_stock: Option<bool>,
}

fn row_to_supply(row: &rusqlite::Row) -> rusqlite::Result<Supply> {
    Ok(Supply {
        id: row.get(0)?,
        name: row.get(1)?,
        unit: row.get(2)?,
        stock: row.get(3)?,
        cost_per_unit: row.get(4)?,
        min_stock: row.get(5)?,
        active: row.get::<_, i64>(6)? != 0,
        track_stock: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

#[tauri::command]
pub fn create_supply(supply: CreateSupply, state: State<'_, AppState>) -> Result<Supply, String> {
    if supply.name.trim().is_empty() {
        return Err("El nombre del insumo es obligatorio".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO supplies (name, unit, stock, cost_per_unit, min_stock, track_stock) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![supply.name.trim(), supply.unit, supply.stock, supply.cost_per_unit, supply.min_stock, supply.track_stock as i64],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        &format!("SELECT {} FROM supplies WHERE id = ?1", SUPPLY_COLS),
        params![id],
        row_to_supply,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_supplies(state: State<'_, AppState>) -> Result<Vec<Supply>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM supplies WHERE active = 1 ORDER BY name ASC", SUPPLY_COLS)
    ).map_err(|e| e.to_string())?;

    let supplies = stmt.query_map([], row_to_supply)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(supplies)
}

#[tauri::command]
pub fn update_supply(supply: UpdateSupply, state: State<'_, AppState>) -> Result<Supply, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    if let Some(name) = &supply.name {
        conn.execute("UPDATE supplies SET name = ?1, updated_at = datetime('now','localtime') WHERE id = ?2", params![name.trim(), supply.id]).map_err(|e| e.to_string())?;
    }
    if let Some(unit) = &supply.unit {
        conn.execute("UPDATE supplies SET unit = ?1, updated_at = datetime('now','localtime') WHERE id = ?2", params![unit, supply.id]).map_err(|e| e.to_string())?;
    }
    if let Some(cost) = supply.cost_per_unit {
        conn.execute("UPDATE supplies SET cost_per_unit = ?1, updated_at = datetime('now','localtime') WHERE id = ?2", params![cost, supply.id]).map_err(|e| e.to_string())?;
    }
    if let Some(min) = supply.min_stock {
        conn.execute("UPDATE supplies SET min_stock = ?1, updated_at = datetime('now','localtime') WHERE id = ?2", params![min, supply.id]).map_err(|e| e.to_string())?;
    }
    if let Some(active) = supply.active {
        conn.execute("UPDATE supplies SET active = ?1, updated_at = datetime('now','localtime') WHERE id = ?2", params![active as i64, supply.id]).map_err(|e| e.to_string())?;
    }
    if let Some(track) = supply.track_stock {
        conn.execute("UPDATE supplies SET track_stock = ?1, updated_at = datetime('now','localtime') WHERE id = ?2", params![track as i64, supply.id]).map_err(|e| e.to_string())?;
    }

    conn.query_row(
        &format!("SELECT {} FROM supplies WHERE id = ?1", SUPPLY_COLS),
        params![supply.id],
        row_to_supply,
    ).map_err(|e| e.to_string())
}

/// Ajuste manual de stock de un insumo (entrada por compra, corrección)
#[tauri::command]
pub fn adjust_supply_stock(supply_id: i64, new_stock: f64, state: State<'_, AppState>) -> Result<Supply, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE supplies SET stock = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
        params![new_stock, supply_id],
    ).map_err(|e| e.to_string())?;

    conn.query_row(
        &format!("SELECT {} FROM supplies WHERE id = ?1", SUPPLY_COLS),
        params![supply_id],
        row_to_supply,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_supply(supply_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    // Soft delete
    conn.execute(
        "UPDATE supplies SET active = 0, updated_at = datetime('now','localtime') WHERE id = ?1",
        params![supply_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
