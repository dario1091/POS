use rusqlite::params;
use tauri::State;

use crate::db::models::{AdjustInventory, InventoryAdjustment};
use crate::AppState;

#[tauri::command]
pub fn adjust_inventory(adjustment: AdjustInventory, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    // Get current user
    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user
        .as_ref()
        .ok_or("No hay sesión activa".to_string())?;
    let user_id = user.id;

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        // Record adjustment
        conn.execute(
            "INSERT INTO inventory_adjustments (product_id, user_id, type, quantity, reason)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                adjustment.product_id,
                user_id,
                adjustment.adjustment_type,
                adjustment.quantity,
                adjustment.reason,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Update stock
        let stock_change = if adjustment.adjustment_type == "entrada" {
            adjustment.quantity
        } else {
            -adjustment.quantity
        };

        conn.execute(
            "UPDATE products SET stock = stock + ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![stock_change, adjustment.product_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn list_adjustments(product_id: Option<i64>, state: State<'_, AppState>) -> Result<Vec<InventoryAdjustment>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(pid) = product_id {
        (
            "SELECT id, product_id, user_id, type, quantity, reason, created_at 
             FROM inventory_adjustments WHERE product_id = ?1 ORDER BY created_at DESC LIMIT 100".to_string(),
            vec![Box::new(pid) as Box<dyn rusqlite::types::ToSql>],
        )
    } else {
        (
            "SELECT id, product_id, user_id, type, quantity, reason, created_at 
             FROM inventory_adjustments ORDER BY created_at DESC LIMIT 100".to_string(),
            vec![],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let adjustments = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(InventoryAdjustment {
                id: row.get(0)?,
                product_id: row.get(1)?,
                user_id: row.get(2)?,
                adjustment_type: row.get(3)?,
                quantity: row.get(4)?,
                reason: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(adjustments)
}
