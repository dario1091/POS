use rusqlite::params;
use tauri::State;

use crate::hardware::printer::{LabelLine, Printer, TicketData, TicketItem, TicketPayment};
use crate::hardware::label_printer::{LabelPrinter, TsplLabelLine};
use crate::hardware::scale;
use crate::AppState;

/// Get label printer device key (VID:PID) from config
fn get_label_printer_path(state: &State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM config WHERE key = 'label_printer_device'",
        [],
        |row| row.get::<_, String>(0),
    )
    .map_err(|_| "Impresora de etiquetas no configurada. Ve a Admin > Configuración de hardware.".to_string())
}

/// Get printer device key (VID:PID) from config
fn get_printer_path(state: &State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM config WHERE key = 'printer_device'",
        [],
        |row| row.get::<_, String>(0),
    )
    .map_err(|_| "Impresora no configurada. Ve a Admin > Configuración de hardware.".to_string())
}

#[tauri::command]
pub fn test_printer(state: State<'_, AppState>) -> Result<String, String> {
    let device_path = get_printer_path(&state)?;
    let printer = Printer::new(&device_path);
    printer.print_test()?;
    Ok("Ticket de prueba impreso correctamente".to_string())
}

#[tauri::command]
pub fn print_ticket(sale_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let device_path = get_printer_path(&state)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    // Get business name from config
    let business_name = conn
        .query_row("SELECT value FROM config WHERE key = 'business_name'", [], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "Mi Negocio".to_string());

    let business_address = conn
        .query_row("SELECT value FROM config WHERE key = 'business_address'", [], |row| row.get::<_, String>(0))
        .ok();

    // Get sale data
    let (customer_id, user_id, subtotal, discount, total, amount_paid, change_amount, created_at): 
        (Option<i64>, i64, f64, f64, f64, f64, f64, String) = conn
        .query_row(
            "SELECT customer_id, user_id, subtotal, discount, total, amount_paid, change_amount, created_at
             FROM sales WHERE id = ?1",
            params![sale_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?)),
        )
        .map_err(|e| format!("Venta no encontrada: {}", e))?;

    // Get cashier name
    let cashier_name: Option<String> = conn
        .query_row("SELECT full_name FROM users WHERE id = ?1", params![user_id], |row| row.get(0))
        .ok();

    // Get customer name
    let customer_name: Option<String> = if let Some(cid) = customer_id {
        conn.query_row("SELECT name FROM customers WHERE id = ?1", params![cid], |row| row.get(0)).ok()
    } else {
        None
    };

    // Get sale items
    let mut stmt = conn
        .prepare("SELECT product_name, quantity, unit_price, subtotal FROM sale_items WHERE sale_id = ?1")
        .map_err(|e| e.to_string())?;

    let items: Vec<TicketItem> = stmt
        .query_map(params![sale_id], |row| {
            Ok(TicketItem {
                name: row.get(0)?,
                quantity: row.get(1)?,
                unit_price: row.get(2)?,
                subtotal: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Get payments
    let payments: Vec<TicketPayment> = conn
        .prepare("SELECT method, amount FROM sale_payments WHERE sale_id = ?1")
        .and_then(|mut stmt| {
            stmt.query_map(params![sale_id], |row| {
                Ok(TicketPayment {
                    method: row.get(0)?,
                    amount: row.get(1)?,
                })
            })
            .and_then(|rows| rows.collect::<Result<Vec<_>, _>>())
        })
        .unwrap_or_else(|_| {
            // Fallback for sales without sale_payments entries
            vec![TicketPayment {
                method: "efectivo".to_string(),
                amount: amount_paid,
            }]
        });

    let ticket = TicketData {
        business_name,
        business_address,
        date: created_at,
        sale_id,
        cashier_name,
        customer_name,
        items,
        subtotal,
        discount,
        total,
        payments,
        change: change_amount,
    };

    let printer = Printer::new(&device_path);
    printer.print_ticket(&ticket)
}

#[tauri::command]
pub fn open_cash_drawer(state: State<'_, AppState>) -> Result<(), String> {
    let device_path = get_printer_path(&state)?;
    crate::hardware::cash_drawer::open_drawer(&device_path)
}

#[tauri::command]
pub fn start_scale(state: State<'_, AppState>) -> Result<(), String> {
    state.scale.start()
}

#[tauri::command]
pub fn stop_scale(state: State<'_, AppState>) -> Result<(), String> {
    state.scale.stop();
    Ok(())
}

#[tauri::command]
pub fn get_scale_weight(state: State<'_, AppState>) -> Result<f64, String> {
    Ok(state.scale.get_weight())
}

#[tauri::command]
pub fn configure_scale(port: String, baud_rate: u32, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('scale_port', ?1)",
        params![port],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('scale_baud', ?1)",
        params![baud_rate.to_string()],
    ).map_err(|e| e.to_string())?;

    state.scale.configure(&port, baud_rate);
    Ok(())
}

#[tauri::command]
pub fn configure_printer(device_key: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('printer_device', ?1)",
        params![device_key],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn configure_business(name: String, address: Option<String>, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('business_name', ?1)",
        params![name],
    ).map_err(|e| e.to_string())?;

    if let Some(addr) = address {
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('business_address', ?1)",
            params![addr],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_hardware_config(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut config = serde_json::Map::new();

    let mut stmt = conn
        .prepare("SELECT key, value FROM config")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        if let Ok((key, value)) = row {
            config.insert(key, serde_json::Value::String(value));
        }
    }

    Ok(serde_json::Value::Object(config))
}

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<String>, String> {
    Ok(scale::list_serial_ports())
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<serde_json::Value>, String> {
    let usb_printers = crate::hardware::usb_printer::list_usb_printers();
    let result: Vec<serde_json::Value> = usb_printers.iter().map(|p| serde_json::json!({
        "path": p.device_key,
        "label": p.label
    })).collect();
    Ok(result)
}



#[tauri::command]
pub fn print_delivery_receipt(
    amount: f64,
    supervisor_name: String,
    delivery_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let device_path = get_printer_path(&state)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let business_name = conn
        .query_row("SELECT value FROM config WHERE key = 'business_name'", [], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "Mi Negocio".to_string());

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let cashier_name = current_user.as_ref().map(|u| u.full_name.clone()).unwrap_or_else(|| "Cajero".to_string());

    let date = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let data = crate::hardware::printer::DeliveryData {
        business_name,
        date,
        amount,
        supervisor_name,
        cashier_name,
        delivery_number: delivery_id,
    };

    let printer = Printer::new(&device_path);
    printer.print_delivery(&data)
}

#[tauri::command]
pub fn print_cash_cut_receipt(
    total_sales: f64,
    transactions: i64,
    cash_total: f64,
    card_total: f64,
    transfer_total: f64,
    credit_total: f64,
    deliveries_total: f64,
    deliveries_count: i64,
    returns_total: f64,
    returns_count: i64,
    cancellations_total: f64,
    cancellations_count: i64,
    cash_in_register: f64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let device_path = get_printer_path(&state)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let business_name = conn
        .query_row("SELECT value FROM config WHERE key = 'business_name'", [], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "Mi Negocio".to_string());

    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let cashier_name = current_user.as_ref().map(|u| u.full_name.clone()).unwrap_or_else(|| "Cajero".to_string());

    let date = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let data = crate::hardware::printer::CashCutPrintData {
        business_name,
        date,
        cashier_name,
        total_sales,
        transactions,
        cash_total,
        card_total,
        transfer_total,
        credit_total,
        deliveries_total,
        deliveries_count,
        returns_total,
        returns_count,
        cancellations_total,
        cancellations_count,
        cash_in_register,
    };

    let printer = Printer::new(&device_path);
    printer.print_cash_cut(&data)
}

#[tauri::command]
pub fn print_label(lines: Vec<TsplLabelLine>, copies: u32, barcode: Option<String>, label_width: Option<u32>, label_height: Option<u32>, barcode_width: Option<u32>, state: State<'_, AppState>) -> Result<(), String> {
    let device_path = get_label_printer_path(&state)?;
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let sensor_type: String = conn
        .query_row("SELECT value FROM config WHERE key = 'label_sensor_type'", [], |row| row.get(0))
        .unwrap_or_else(|_| "bline".to_string());
    let printer = LabelPrinter::new(&device_path);
    printer.print_label(&lines, copies, barcode.as_deref(), label_width.unwrap_or(55), label_height.unwrap_or(33), barcode_width.unwrap_or(4), &sensor_type)
}

#[tauri::command]
pub fn configure_label_printer(device_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('label_printer_device', ?1)",
        params![device_path],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn configure_label_sensor(sensor_type: String, state: State<'_, AppState>) -> Result<(), String> {
    if sensor_type != "gap" && sensor_type != "bline" {
        return Err("Tipo de sensor inválido. Usa 'gap' o 'bline'".to_string());
    }
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('label_sensor_type', ?1)",
        params![sensor_type],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn calibrate_label_printer(state: State<'_, AppState>) -> Result<String, String> {
    let device_key = get_label_printer_path(&state)?;
    let parts: Vec<&str> = device_key.split(':').collect();
    let vendor_id = u16::from_str_radix(parts.get(0).unwrap_or(&"0"), 16)
        .map_err(|_| "Device key inválido".to_string())?;
    let product_id = u16::from_str_radix(parts.get(1).unwrap_or(&"0"), 16)
        .map_err(|_| "Device key inválido".to_string())?;

    let conn = state.db.get().map_err(|e| e.to_string())?;
    let sensor_type: String = conn
        .query_row("SELECT value FROM config WHERE key = 'label_sensor_type'", [], |row| row.get(0))
        .unwrap_or_else(|_| "bline".to_string());

    let (cmd, msg): (&[u8], &str) = if sensor_type == "gap" {
        (b"GAPDETECT\r\n", "Calibración iniciada (GAP) — la impresora avanzará etiquetas para detectar el espacio transparente")
    } else {
        (b"BLINEDETECT\r\n", "Calibración iniciada (BLINE) — la impresora avanzará etiquetas para detectar la marca negra")
    };

    crate::hardware::usb_printer::write_to_usb_printer(vendor_id, product_id, cmd)?;
    Ok(msg.to_string())
}

#[tauri::command]
pub fn test_label_printer(state: State<'_, AppState>) -> Result<String, String> {
    let device_path = get_label_printer_path(&state)?;
    let printer = LabelPrinter::new(&device_path);
    printer.print_test()?;
    Ok("Etiqueta de prueba impresa correctamente".to_string())
}

#[tauri::command]
pub fn list_label_printers() -> Result<Vec<serde_json::Value>, String> {
    list_printers()
}
