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
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE date(created_at) = date(?1) AND cancelled = 0",
            params![date],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let total_cash: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE date(s.created_at) = date(?1) AND sp.method = 'efectivo' AND s.cancelled = 0",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_card: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE date(s.created_at) = date(?1) AND sp.method = 'tarjeta' AND s.cancelled = 0",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_transfer: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE date(s.created_at) = date(?1) AND sp.method = 'transferencia' AND s.cancelled = 0",
            params![date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_items_sold: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE date(s.created_at) = date(?1) AND s.cancelled = 0",
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
             WHERE date(created_at) >= date(?1) AND date(created_at) <= date(?2) AND cancelled = 0
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
             WHERE date(s.created_at) >= date(?1) AND date(s.created_at) <= date(?2) AND s.cancelled = 0
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
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE created_at > ?1 AND cancelled = 0",
            params![cut_date],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE cancelled = 0",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?
    };

    let cash_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        // Pure cash sales
        let pure: f64 = conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM sales WHERE created_at > ?1 AND cancelled = 0 AND payment_method = 'efectivo'",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0);
        // Cash portion of mixed sales
        let mixed: f64 = conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.created_at > ?1 AND s.cancelled = 0 AND s.payment_method = 'mixto' AND sp.method = 'efectivo'",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0);
        pure + mixed
    } else {
        let pure: f64 = conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM sales WHERE cancelled = 0 AND payment_method = 'efectivo'",
            [], |row| row.get(0),
        ).unwrap_or(0.0);
        let mixed: f64 = conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.cancelled = 0 AND s.payment_method = 'mixto' AND sp.method = 'efectivo'",
            [], |row| row.get(0),
        ).unwrap_or(0.0);
        pure + mixed
    };

    let card_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE s.created_at > ?1 AND sp.method = 'tarjeta' AND s.cancelled = 0",
            params![cut_date],
            |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'tarjeta' AND s.cancelled = 0",
            [],
            |row| row.get(0),
        ).unwrap_or(0.0)
    };

    let transfer_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id
             WHERE s.created_at > ?1 AND sp.method = 'transferencia' AND s.cancelled = 0",
            params![cut_date],
            |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp
             JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'transferencia' AND s.cancelled = 0",
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

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<CashCut, String> {
        // Calculate expected cash INSIDE the transaction
        let summary = get_cash_cut_summary_internal(&conn)?;
        let expected_cash = summary.cash_sales;
        let difference = actual_cash - expected_cash;

        conn.execute(
            "INSERT INTO cash_cuts (user_id, expected_cash, actual_cash, difference, notes) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![user_id, expected_cash, actual_cash, difference, notes],
        ).map_err(|e| e.to_string())?;

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
        ).map_err(|e| e.to_string())
    })();

    match result {
        Ok(cut) => { conn.execute("COMMIT", []).ok(); Ok(cut) }
        Err(e) => { conn.execute("ROLLBACK", []).ok(); Err(e) }
    }
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
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE created_at > ?1 AND cancelled = 0",
            params![cut_date], |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?
    } else {
        conn.query_row("SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales WHERE cancelled = 0", [], |row| Ok((row.get(0)?, row.get(1)?))).map_err(|e| e.to_string())?
    };

    let cash_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        let pure: f64 = conn.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM sales WHERE created_at > ?1 AND cancelled = 0 AND payment_method = 'efectivo'",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0);
        let mixed: f64 = conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.created_at > ?1 AND s.cancelled = 0 AND s.payment_method = 'mixto' AND sp.method = 'efectivo'",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0);
        pure + mixed
    } else {
        let pure: f64 = conn.query_row("SELECT COALESCE(SUM(total), 0) FROM sales WHERE cancelled = 0 AND payment_method = 'efectivo'", [], |row| row.get(0)).unwrap_or(0.0);
        let mixed: f64 = conn.query_row("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.cancelled = 0 AND s.payment_method = 'mixto' AND sp.method = 'efectivo'", [], |row| row.get(0)).unwrap_or(0.0);
        pure + mixed
    };

    let card_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.created_at > ?1 AND sp.method = 'tarjeta' AND s.cancelled = 0",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'tarjeta' AND s.cancelled = 0", [], |row| row.get(0)).unwrap_or(0.0)
    };

    let transfer_sales: f64 = if let Some(ref cut_date) = last_cut_date {
        conn.query_row(
            "SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.created_at > ?1 AND sp.method = 'transferencia' AND s.cancelled = 0",
            params![cut_date], |row| row.get(0),
        ).unwrap_or(0.0)
    } else {
        conn.query_row("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE sp.method = 'transferencia' AND s.cancelled = 0", [], |row| row.get(0)).unwrap_or(0.0)
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

// --- Supplier payments (pagos a proveedores) ---

#[derive(Debug, Serialize)]
pub struct SupplierPayment {
    pub id: i64,
    pub user_id: i64,
    pub amount: f64,
    pub supplier_name: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct SupplierPaymentSummary {
    pub supplier_name: String,
    pub amount: f64,
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
    pub supplier_payments_total: f64,
    pub supplier_payments_count: i64,
    pub supplier_payments: Vec<SupplierPaymentSummary>,
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
pub fn create_supplier_payment(
    amount: f64,
    supplier_name: String,
    notes: Option<String>,
    state: State<'_, AppState>,
) -> Result<SupplierPayment, String> {
    if amount <= 0.0 {
        return Err("El monto debe ser mayor a 0".to_string());
    }
    let trimmed = supplier_name.trim().to_string();
    if trimmed.is_empty() {
        return Err("El nombre del proveedor es obligatorio".to_string());
    }

    let conn = state.db.get().map_err(|e| e.to_string())?;

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user.as_ref().ok_or("No hay sesión activa")?;
    let user_id = user.id;

    conn.execute(
        "INSERT INTO supplier_payments (user_id, amount, supplier_name, notes) VALUES (?1, ?2, ?3, ?4)",
        params![user_id, amount, trimmed, notes],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, user_id, amount, supplier_name, notes, created_at FROM supplier_payments WHERE id = ?1",
        params![id],
        |row| Ok(SupplierPayment {
            id: row.get(0)?,
            user_id: row.get(1)?,
            amount: row.get(2)?,
            supplier_name: row.get(3)?,
            notes: row.get(4)?,
            created_at: row.get(5)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quick_cash_cut(state: State<'_, AppState>) -> Result<QuickCashCutResult, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Get last cash cut time (if any today)
    let last_cut_time: Option<String> = conn.query_row(
        "SELECT created_at FROM cash_cuts WHERE date(created_at) = date('now', 'localtime') ORDER BY id DESC LIMIT 1",
        [], |row| row.get(0),
    ).ok();

    // Build WHERE clause: since last cut OR since start of today
    let time_filter = if let Some(ref cut_time) = last_cut_time {
        format!("s.created_at > '{}'", cut_time)
    } else {
        "date(s.created_at) = date('now', 'localtime')".to_string()
    };

    let time_filter_simple = if let Some(ref cut_time) = last_cut_time {
        format!("created_at > '{}'", cut_time)
    } else {
        "date(created_at) = date('now', 'localtime')".to_string()
    };

    let (total_sales, transactions): (f64, i64) = conn.query_row(
        &format!("SELECT COALESCE(SUM(total), 0), COUNT(*) FROM sales s WHERE {} AND cancelled = 0", time_filter),
        [], |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    // Cash in register: for pure cash sales = sale total; for mixed = cash portion from sale_payments
    let pure_cash: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE {} AND s.cancelled = 0 AND s.payment_method = 'efectivo'", time_filter),
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let mixed_cash: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE {} AND s.cancelled = 0 AND s.payment_method = 'mixto' AND sp.method = 'efectivo'", time_filter),
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let cash_total = pure_cash + mixed_cash;

    let card_total: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE {} AND sp.method = 'tarjeta' AND s.cancelled = 0", time_filter),
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let transfer_total: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE {} AND sp.method = 'transferencia' AND s.cancelled = 0", time_filter),
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let credit_total: f64 = conn.query_row(
        &format!("SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE {} AND sp.method = 'credito' AND s.cancelled = 0", time_filter),
        [], |row| row.get(0),
    ).unwrap_or(0.0);

    let (deliveries_total, deliveries_count): (f64, i64) = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM cash_deliveries WHERE {}", time_filter_simple),
        [], |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    let (supplier_payments_total, supplier_payments_count): (f64, i64) = conn.query_row(
        &format!("SELECT COALESCE(SUM(amount), 0), COUNT(*) FROM supplier_payments WHERE {}", time_filter_simple),
        [], |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    let supplier_payments: Vec<SupplierPaymentSummary> = {
        let mut stmt = conn.prepare(
            &format!(
                "SELECT supplier_name, amount, created_at FROM supplier_payments WHERE {} ORDER BY created_at ASC",
                time_filter_simple
            ),
        ).map_err(|e| e.to_string())?;

        let results = stmt.query_map([], |row| {
            Ok(SupplierPaymentSummary {
                supplier_name: row.get(0)?,
                amount: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

        results
    };

    let cash_in_register = cash_total - deliveries_total - supplier_payments_total;

    Ok(QuickCashCutResult {
        total_sales,
        transactions,
        cash_total,
        card_total,
        transfer_total,
        credit_total,
        deliveries_total,
        deliveries_count,
        supplier_payments_total,
        supplier_payments_count,
        supplier_payments,
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

// --- Credit payments (abonos) ---

#[derive(Debug, Serialize)]
pub struct CreditPaymentResult {
    pub id: i64,
    pub customer_name: String,
    pub amount: f64,
    pub new_balance: f64,
    pub created_at: String,
}

#[tauri::command]
pub fn create_credit_payment(
    customer_id: i64,
    amount: f64,
    payment_method: String,
    reference: Option<String>,
    state: State<'_, AppState>,
) -> Result<CreditPaymentResult, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user.as_ref().ok_or("No hay sesión activa")?;
    let user_id = user.id;

    if amount <= 0.0 {
        return Err("El monto debe ser mayor a 0".to_string());
    }

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<CreditPaymentResult, String> {
        // Get customer info
        let (customer_name, credit_balance): (String, f64) = conn.query_row(
            "SELECT name, credit_balance FROM customers WHERE id = ?1",
            params![customer_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|_| "Cliente no encontrado".to_string())?;

        if amount > credit_balance + 0.01 {
            return Err(format!("El abono (${:.2}) es mayor a la deuda (${:.2})", amount, credit_balance));
        }

        // Register payment
        conn.execute(
            "INSERT INTO credit_payments (customer_id, user_id, amount, payment_method, reference) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![customer_id, user_id, amount, payment_method, reference],
        ).map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();

        // Reduce balance
        conn.execute(
            "UPDATE customers SET credit_balance = credit_balance - ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![amount, customer_id],
        ).map_err(|e| e.to_string())?;

        let new_balance = credit_balance - amount;

        let created_at: String = conn.query_row(
            "SELECT created_at FROM credit_payments WHERE id = ?1", params![id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;

        Ok(CreditPaymentResult { id, customer_name, amount, new_balance, created_at })
    })();

    match result {
        Ok(r) => { conn.execute("COMMIT", []).ok(); Ok(r) }
        Err(e) => { conn.execute("ROLLBACK", []).ok(); Err(e) }
    }
}

// --- Cancel sale (anular venta) ---

#[derive(Debug, Serialize)]
pub struct CancelSaleResult {
    pub sale_id: i64,
    pub total_restored: f64,
    pub items_restored: i64,
}

#[tauri::command]
pub fn cancel_sale(sale_id: i64, reason: String, state: State<'_, AppState>) -> Result<CancelSaleResult, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user.as_ref().ok_or("No hay sesión activa")?;
    let user_id = user.id;

    // Check sale exists and is not already cancelled
    let (total, cancelled, payment_method, customer_id): (f64, i64, String, Option<i64>) = conn.query_row(
        "SELECT total, cancelled, payment_method, customer_id FROM sales WHERE id = ?1",
        params![sale_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ).map_err(|_| "Venta no encontrada".to_string())?;

    if cancelled != 0 {
        return Err("Esta venta ya fue anulada".to_string());
    }

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<CancelSaleResult, String> {
        // Mark as cancelled
        conn.execute(
            "UPDATE sales SET cancelled = 1, cancelled_at = datetime('now', 'localtime'), cancelled_by = ?1, cancel_reason = ?2 WHERE id = ?3",
            params![user_id, reason, sale_id],
        ).map_err(|e| e.to_string())?;

        // Restore stock for each item
        let mut stmt = conn.prepare(
            "SELECT product_id, quantity FROM sale_items WHERE sale_id = ?1"
        ).map_err(|e| e.to_string())?;

        let items: Vec<(i64, f64)> = stmt.query_map(params![sale_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

        let items_count = items.len() as i64;

        for (product_id, quantity) in &items {
            conn.execute(
                "UPDATE products SET stock = stock + ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
                params![quantity, product_id],
            ).map_err(|e| e.to_string())?;
        }

        // If it was a credit sale, restore the customer's credit balance
        if payment_method == "credito" {
            if let Some(cid) = customer_id {
                conn.execute(
                    "UPDATE customers SET credit_balance = credit_balance - ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
                    params![total, cid],
                ).map_err(|e| e.to_string())?;
            }
        }

        Ok(CancelSaleResult { sale_id, total_restored: total, items_restored: items_count })
    })();

    match result {
        Ok(r) => { conn.execute("COMMIT", []).ok(); Ok(r) }
        Err(e) => { conn.execute("ROLLBACK", []).ok(); Err(e) }
    }
}

// --- Quick history for cashier ---

#[derive(Debug, Serialize)]
pub struct SaleHistoryItem {
    pub id: i64,
    pub total: f64,
    pub payment_method: String,
    pub items_count: i64,
    pub cancelled: bool,
    pub created_at: String,
}

#[tauri::command]
pub fn get_recent_sales(limit: i64, state: State<'_, AppState>) -> Result<Vec<SaleHistoryItem>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT s.id, s.total, s.payment_method, s.cancelled, s.created_at,
                (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
         FROM sales s
         WHERE date(s.created_at) = date('now', 'localtime')
         ORDER BY s.created_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let sales = stmt.query_map(params![limit], |row| {
        Ok(SaleHistoryItem {
            id: row.get(0)?,
            total: row.get(1)?,
            payment_method: row.get(2)?,
            cancelled: row.get::<_, i64>(3)? != 0,
            created_at: row.get(4)?,
            items_count: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(sales)
}

// --- Sales by category report ---

#[derive(Debug, Serialize)]
pub struct SalesByCategory {
    pub category_id: i64,
    pub category_name: String,
    pub total_revenue: f64,
    pub total_quantity: f64,
    pub total_transactions: i64,
}

#[tauri::command]
pub fn get_sales_by_category(
    from: String,
    to: String,
    state: State<'_, AppState>,
) -> Result<Vec<SalesByCategory>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(p.category_id, 0) as cat_id,
                    COALESCE(c.name, 'Sin categoría') as cat_name,
                    SUM(si.subtotal) as revenue,
                    SUM(si.quantity) as qty,
                    COUNT(DISTINCT si.sale_id) as txns
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             LEFT JOIN products p ON p.id = si.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE date(s.created_at) >= date(?1)
               AND date(s.created_at) <= date(?2)
               AND s.cancelled = 0
             GROUP BY cat_id, cat_name
             ORDER BY revenue DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![from, to], |row| {
            Ok(SalesByCategory {
                category_id: row.get(0)?,
                category_name: row.get(1)?,
                total_revenue: row.get(2)?,
                total_quantity: row.get(3)?,
                total_transactions: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}
