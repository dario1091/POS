use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::AppState;

#[derive(Debug, Serialize)]
pub struct DailySummary {
    pub total_sales: f64,
    pub total_transactions: i64,
    pub total_cash: f64,
    pub total_card: f64,
    pub total_transfer: f64,
    pub total_items_sold: f64,
}

#[derive(Debug, Serialize)]
pub struct SalesByRange {
    pub date: String,
    pub total: f64,
    pub transactions: i64,
}

#[derive(Debug, Serialize)]
pub struct TopProduct {
    pub product_id: i64,
    pub product_name: String,
    pub total_quantity: f64,
    pub total_revenue: f64,
    pub times_sold: i64,
}

#[derive(Debug, Serialize)]
pub struct CashCutSummary {
    pub total_sales: f64,
    pub cash_sales: f64,
    pub card_sales: f64,
    pub transfer_sales: f64,
    pub transactions: i64,
    pub last_cut_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CashCut {
    pub id: i64,
    pub user_id: i64,
    pub expected_cash: f64,
    pub actual_cash: f64,
    pub difference: f64,
    pub notes: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub fn get_daily_summary(date: String, state: State<'_, AppState>) -> Result<DailySummary, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let (total_sales, total_transactions): (f64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE date(created_at) = date(?1)",
            params![date],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let total_cash: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE date(s.created_at) = date(?1) AND sp.method = 'efectivo'",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_card: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE date(s.created_at) = date(?1) AND sp.method = 'tarjeta'",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_transfer: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE date(s.created_at) = date(?1) AND sp.method = 'transferencia'",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_items_sold: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE date(s.created_at) = date(?1)",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    Ok(DailySummary {
        total_sales,
        total_transactions,
        total_cash,
        total_card,
        total_transfer,
        total_items_sold,
    })
}

#[tauri::command]
pub fn get_sales_by_range(from: String, to: String, state: State<'_, AppState>) -> Result<Vec<SalesByRange>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT date(created_at) as sale_date, SUM(total) as day_total, COUNT(*) as day_count
             FROM sales
             WHERE date(created_at) >= date(?1) AND date(created_at) <= date(?2)
             GROUP BY date(created_at)
             ORDER BY sale_date DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![from, to], |row| {
            Ok(SalesByRange {
                date: row.get(0)?,
                total: row.get(1)?,
                transactions: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
pub fn get_top_products(from: String, to: String, limit: i64, state: State<'_, AppState>) -> Result<Vec<TopProduct>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT si.product_id, si.product_name, 
                    SUM(si.quantity) as total_qty,
                    SUM(si.subtotal) as total_rev,
                    COUNT(DISTINCT si.sale_id) as times
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE date(s.created_at) >= date(?1) AND date(s.created_at) <= date(?2)
             GROUP BY si.product_id, si.product_name
             ORDER BY total_qty DESC
             LIMIT ?3",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![from, to, limit], |row| {
            Ok(TopProduct {
                product_id: row.get(0)?,
                product_name: row.get(1)?,
                total_quantity: row.get(2)?,
                total_revenue: row.get(3)?,
                times_sold: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
pub fn get_cash_cut_summary(state: State<'_, AppState>) -> Result<CashCutSummary, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    // Get last cut date
    let last_cut_date: Option<String> = conn
        .query_row(
            "SELECT created_at FROM cash_cuts ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    // Get sales since last cut (or all sales if no cuts yet)
    let (total_sales, transactions): (f64, i64) = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE created_at > ?1",
            params![cut_date],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?
    };

    let cash_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE s.created_at > ?1 AND sp.method = 'efectivo'",
            params![cut_date],
            |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'efectivo'",
            [],
            |row| row.get(0),
        ).unwrap_or(0.0)
    };

    let card_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE s.created_at > ?1 AND sp.method = 'tarjeta'",
            params![cut_date],
            |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'tarjeta'",
            [],
            |row| row.get(0),
        ).unwrap_or(0.0)
    };

    let transfer_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE s.created_at > ?1 AND sp.method = 'transferencia'",
            params![cut_date],
            |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'transferencia'",
            [],
            |row| row.get(0),
        ).unwrap_or(0.0)
    };

    Ok(CashCutSummary {
        total_sales,
        cash_sales,
        card_sales,
        transfer_sales,
        transactions,
        last_cut_date,
    })
}

#[tauri::command]
pub fn create_cash_cut(actual_cash: f64, notes: Option<String>, state: State<'_, AppState>) -> Result<CashCut, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user.as_ref().ok_or("No hay sesión activa")?;
    let user_id = user.id;

    // Calculate expected cash
    let summary = get_cash_cut_summary_internal(&conn)?;
    let expected_cash = summary.cash_sales;
    let difference = actual_cash - expected_cash;

    conn.execute(
        "INSERT INTO cash_cuts (user_id, expected_cash, actual_cash, difference, notes) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![user_id, expected_cash, actual_cash, difference, notes],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, user_id, expected_cash, actual_cash, difference, notes, created_at FROM cash_cuts WHERE id = ?1",
        params![id],
        |row| {
            Ok(CashCut {
                id: row.get(0)?,
                user_id: row.get(1)?,
                expected_cash: row.get(2)?,
                actual_cash: row.get(3)?,
                difference: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cash_cuts(from: String, to: String, state: State<'_, AppState>) -> Result<Vec<CashCut>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, expected_cash, actual_cash, difference, notes, created_at
             FROM cash_cuts
             WHERE date(created_at) >= date(?1) AND date(created_at) <= date(?2)
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let cuts = stmt
        .query_map(params![from, to], |row| {
            Ok(CashCut {
                id: row.get(0)?,
                user_id: row.get(1)?,
                expected_cash: row.get(2)?,
                actual_cash: row.get(3)?,
                difference: row.get(4)?,
                notes: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(cuts)
}

// Internal helper (not a Tauri command)
fn get_cash_cut_summary_internal(conn: &rusqlite::Connection) -> Result<CashCutSummary, String> {
    let last_cut_date: Option<String> = conn
        .query_row("SELECT created_at FROM cash_cuts ORDER BY id DESC LIMIT 1", [], |row| row.get(0))
        .ok();

    let (total_sales, transactions): (f64, i64) = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE created_at > ?1",
            params![cut_date], |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?
    } else {
        conn.query_row("SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales", [], |row| Ok((row.get(0)?, row.get(1)?))).map_err(|e| e.to_string())?
    };

    let cash_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.created_at > ?1 AND sp.method = 'efectivo'",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'efectivo'", [], |row| row.get(0)).unwrap_or(0.0)
    };

    let card_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.created_at > ?1 AND sp.method = 'tarjeta'",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'tarjeta'", [], |row| row.get(0)).unwrap_or(0.0)
    };

    let transfer_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.created_at > ?1 AND sp.method = 'transferencia'",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'transferencia'", [], |row| row.get(0)).unwrap_or(0.0)
    };

    Ok(CashCutSummary { total_sales, cash_sales, card_sales, transfer_sales, transactions, last_cut_date })
}

// --- Cash deliveries (entregas parciales) ---

#[derive(Debug, Serialize)]
pub struct CashDelivery {
    pub id: i64,
    pub user_id: i64,
    pub amount: f64,
    pub supervisor_name: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct QuickCashCutResult {
    pub total_sales: f64,
    pub transactions: i64,
    pub cash_total: f64,
    pub card_total: f64,
    pub transfer_total: f64,
    pub credit_total: f64,
    pub deliveries_total: f64,
    pub deliveries_count: i64,
    pub cash_in_register: f64,
    pub date: String,
}

#[tauri::command]
pub fn create_cash_delivery(
    amount: f64,
    supervisor_name: Option<String>,
    notes: Option<String>,
    state: State<'_, AppState>,
) -> Result<CashDelivery, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user.as_ref().ok_or("No hay sesión activa")?;
    let user_id = user.id;

    conn.execute(
        "INSERT INTO cash_deliveries (user_id, amount, supervisor_name, notes) VALUES (?1, ?2, ?3, ?4)",
        params![user_id, amount, supervisor_name, notes],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, user_id, amount, supervisor_name, notes, created_at FROM cash_deliveries WHERE id = ?1",
        params![id],
        |row| Ok(CashDelivery {
            id: row.get(0)?,
            user_id: row.get(1)?,
            amount: row.get(2)?,
            supervisor_name: row.get(3)?,
            notes: row.get(4)?,
            created_at: row.get(5)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_today_deliveries(state: State<'_, AppState>) -> Result<Vec<CashDelivery>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, user_id, amount, supervisor_name, notes, created_at 
         FROM cash_deliveries WHERE date(created_at) = date('now', 'localtime') ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let deliveries = stmt.query_map([], |row| {
        Ok(CashDelivery {
            id: row.get(0)?,
            user_id: row.get(1)?,
            amount: row.get(2)?,
            supervisor_name: row.get(3)?,
            notes: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(deliveries)
}

#[tauri::command]
pub fn quick_cash_cut(state: State<'_, AppState>) -> Result<QuickCashCutResult, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let (total_sales, transactions): (f64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE date(created_at) = date('now', 'localtime')",
        [], |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    let cash_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE date(s.created_at) = date('now', 'localtime') AND sp.method = 'efectivo'",
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let card_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE date(s.created_at) = date('now', 'localtime') AND sp.method = 'tarjeta'",
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let transfer_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE date(s.created_at) = date('now', 'localtime') AND sp.method = 'transferencia'",
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let credit_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE date(s.created_at) = date('now', 'localtime') AND sp.method = 'credito'",
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let (deliveries_total, deliveries_count): (f64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM cash_deliveries WHERE date(created_at) = date('now', 'localtime')",
        [], |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    let cash_in_register = cash_total - deliveries_total;

    Ok(QuickCashCutResult {
        total_sales,
        transactions,
        cash_total,
        card_total,
        transfer_total,
        credit_total,
        deliveries_total,
        deliveries_count,
        cash_in_register,
        date: today,
    })
}

// --- Returns/Refunds ---

#[derive(Debug, Serialize)]
pub struct ReturnResult {
    pub id: i64,
    pub total: f64,
    pub items_count: i64,
    pub created_at: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct ReturnItemInput {
    pub product_id: i64,
    pub product_name: String,
    pub quantity: f64,
    pub unit_price: f64,
}

#[tauri::command]
pub fn create_return(items: Vec<ReturnItemInput>, reason: Option<String>, state: State<'_, AppState>) -> Result<ReturnResult, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user.as_ref().ok_or("No hay sesión activa")?;
    let user_id = user.id;

    if items.is_empty() {
        return Err("No hay productos para devolver".to_string());
    }

    let total: f64 = items.iter().map(|i| i.quantity * i.unit_price).sum();

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<ReturnResult, String> {
        conn.execute(
            "INSERT INTO returns (user_id, total, reason) VALUES (?1, ?2, ?3)",
            params![user_id, total, reason],
        ).map_err(|e| e.to_string())?;

        let return_id = conn.last_insert_rowid();

        for item in &items {
            let subtotal = item.quantity * item.unit_price;
            conn.execute(
                "INSERT INTO return_items (return_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![return_id, item.product_id, item.product_name, item.quantity, item.unit_price, subtotal],
            ).map_err(|e| e.to_string())?;

            // Restore stock
            conn.execute(
                "UPDATE products SET stock = stock + ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
                params![item.quantity, item.product_id],
            ).map_err(|e| e.to_string())?;
        }

        let created_at: String = conn.query_row(
            "SELECT created_at FROM returns WHERE id = ?1", params![return_id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;

        Ok(ReturnResult {
            id: return_id,
            total,
            items_count: items.len() as i64,
            created_at,
        })
    })();

    match result {
        Ok(r) => { conn.execute("COMMIT", []).ok(); Ok(r) }
        Err(e) => { conn.execute("ROLLBACK", []).ok(); Err(e) }
    }
}
