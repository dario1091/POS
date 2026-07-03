use rusqlite::params;
use tauri::State;

use crate::db::models::{CreateSale, Sale, SaleItem};
use crate::AppState;

#[tauri::command]
pub fn create_sale(sale: CreateSale, state: State<'_, AppState>) -> Result<Sale, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    // Get current user
    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user
        .as_ref()
        .ok_or("No hay sesión activa".to_string())?;
    let user_id = user.id;

    // Calculate totals
    let subtotal: f64 = sale.items.iter().map(|item| {
        (item.quantity * item.unit_price) - item.discount
    }).sum();
    let total = subtotal - sale.discount;

    // Validate payments cover the total
    let total_paid: f64 = sale.payments.iter().map(|p| p.amount).sum();
    if total_paid < total - 0.01 {
        return Err(format!("El monto pagado ({:.2}) es menor al total ({:.2})", total_paid, total));
    }

    // Validate credit if any payment is 'credito'
    let credit_amount: f64 = sale.payments.iter()
        .filter(|p| p.method == "credito")
        .map(|p| p.amount)
        .sum();

    if credit_amount > 0.0 {
        let customer_id = sale.customer_id
            .ok_or("Se requiere un cliente para ventas a crédito".to_string())?;

        let (credit_limit, credit_balance): (f64, f64) = conn
            .query_row(
                "SELECT credit_limit, credit_balance FROM customers WHERE id = ?1",
                params![customer_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| "Cliente no encontrado".to_string())?;

        let available_credit = credit_limit - credit_balance;
        if credit_amount > available_credit + 0.01 {
            return Err(format!(
                "Crédito insuficiente. Disponible: ${:.2}, solicitado: ${:.2}",
                available_credit, credit_amount
            ));
        }
    }

    // Determine payment method label
    let payment_method = if sale.payments.len() == 1 {
        sale.payments[0].method.clone()
    } else {
        // Check if all payments use the same method
        let first_method = &sale.payments[0].method;
        let all_same = sale.payments.iter().all(|p| &p.method == first_method);
        if all_same {
            first_method.clone()
        } else {
            "mixto".to_string()
        }
    };

    let change_amount = if payment_method == "efectivo" || payment_method == "mixto" {
        let cash_paid: f64 = sale.payments.iter()
            .filter(|p| p.method == "efectivo")
            .map(|p| p.amount)
            .sum();
        let non_cash: f64 = sale.payments.iter()
            .filter(|p| p.method != "efectivo")
            .map(|p| p.amount)
            .sum();
        let expected_cash = total - non_cash;
        if cash_paid > expected_cash { cash_paid - expected_cash } else { 0.0 }
    } else {
        0.0
    };

    // Start transaction
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<Sale, String> {
        conn.execute(
            "INSERT INTO sales (customer_id, user_id, subtotal, discount, total, payment_method, amount_paid, change_amount)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                sale.customer_id,
                user_id,
                subtotal,
                sale.discount,
                total,
                payment_method,
                total_paid,
                change_amount,
            ],
        )
        .map_err(|e| e.to_string())?;

        let sale_id = conn.last_insert_rowid();

        // Insert sale items and update stock
        for item in &sale.items {
            let item_subtotal = (item.quantity * item.unit_price) - item.discount;

            conn.execute(
                "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount, subtotal)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    sale_id,
                    item.product_id,
                    item.product_name,
                    item.quantity,
                    item.unit_price,
                    item.discount,
                    item_subtotal,
                ],
            )
            .map_err(|e| e.to_string())?;

            // Decrease stock
            conn.execute(
                "UPDATE products SET stock = stock - ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
                params![item.quantity, item.product_id],
            )
            .map_err(|e| e.to_string())?;
        }

        // Insert payment details
        for payment in &sale.payments {
            conn.execute(
                "INSERT INTO sale_payments (sale_id, method, amount, reference) VALUES (?1, ?2, ?3, ?4)",
                params![sale_id, payment.method, payment.amount, payment.reference],
            )
            .map_err(|e| e.to_string())?;
        }

        // Update customer credit balance if credit was used
        if credit_amount > 0.0 {
            if let Some(customer_id) = sale.customer_id {
                conn.execute(
                    "UPDATE customers SET credit_balance = credit_balance + ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
                    params![credit_amount, customer_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        // Fetch the created sale
        conn.query_row(
            "SELECT id, customer_id, user_id, subtotal, discount, total, payment_method, amount_paid, change_amount, machine_id, created_at
             FROM sales WHERE id = ?1",
            params![sale_id],
            |row| {
                Ok(Sale {
                    id: row.get(0)?,
                    customer_id: row.get(1)?,
                    user_id: row.get(2)?,
                    subtotal: row.get(3)?,
                    discount: row.get(4)?,
                    total: row.get(5)?,
                    payment_method: row.get(6)?,
                    amount_paid: row.get(7)?,
                    change_amount: row.get(8)?,
                    machine_id: row.get(9)?,
                    created_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| e.to_string())
    })();

    match result {
        Ok(sale) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(sale)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn get_sale_items(sale_id: i64, state: State<'_, AppState>) -> Result<Vec<SaleItem>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, sale_id, product_id, product_name, quantity, unit_price, discount, subtotal
             FROM sale_items WHERE sale_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![sale_id], |row| {
            Ok(SaleItem {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                quantity: row.get(4)?,
                unit_price: row.get(5)?,
                discount: row.get(6)?,
                subtotal: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub fn get_daily_sales(date: String, state: State<'_, AppState>) -> Result<Vec<Sale>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, customer_id, user_id, subtotal, discount, total, payment_method, amount_paid, change_amount, machine_id, created_at
             FROM sales WHERE date(created_at) = date(?1) ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let sales = stmt
        .query_map(params![date], |row| {
            Ok(Sale {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                user_id: row.get(2)?,
                subtotal: row.get(3)?,
                discount: row.get(4)?,
                total: row.get(5)?,
                payment_method: row.get(6)?,
                amount_paid: row.get(7)?,
                change_amount: row.get(8)?,
                machine_id: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(sales)
}
