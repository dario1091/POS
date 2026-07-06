use rusqlite::params;
use tauri::State;

use crate::db::models::{AdjustInventory, BulkAdjustItem, InventoryAdjustment};
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

#[tauri::command]
pub fn bulk_adjust_inventory(
    items: Vec<BulkAdjustItem>,
    reason: String,
    state: State<'_, AppState>,
) -> Result<u64, String> {
    if items.is_empty() {
        return Err("No hay productos para ajustar".to_string());
    }

    let conn = state.db.get().map_err(|e| e.to_string())?;

    // Get current user
    let current_user = state.current_user.lock().map_err(|e| e.to_string())?;
    let user = current_user
        .as_ref()
        .ok_or("No hay sesión activa".to_string())?;
    let user_id = user.id;

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<u64, String> {
        let mut count: u64 = 0;

        for item in &items {
            // Record inventory adjustment (entrada = set stock to quantity)
            conn.execute(
                "INSERT INTO inventory_adjustments (product_id, user_id, type, quantity, reason)
                 VALUES (?1, ?2, 'entrada', ?3, ?4)",
                params![item.product_id, user_id, item.quantity, reason],
            )
            .map_err(|e| e.to_string())?;

            // Update product: stock, sale_price, cost_price
            conn.execute(
                "UPDATE products SET stock = ?1, sale_price = ?2, cost_price = ?3, updated_at = datetime('now', 'localtime') WHERE id = ?4",
                params![item.quantity, item.sale_price, item.cost_price, item.product_id],
            )
            .map_err(|e| e.to_string())?;

            count += 1;
        }

        Ok(count)
    })();

    match result {
        Ok(count) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(count)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

// --- CSV Bulk Import ---

#[derive(Debug, serde::Serialize)]
pub struct CsvValidationResult {
    pub valid_count: usize,
    pub error_count: usize,
    pub warnings: Vec<String>,
    pub errors: Vec<CsvRowError>,
    pub rows: Vec<CsvProductRow>,
}

#[derive(Debug, serde::Serialize)]
pub struct CsvRowError {
    pub row: usize,
    pub field: String,
    pub message: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct CsvProductRow {
    pub row_number: usize,
    pub barcode: Option<String>,
    pub name: String,
    pub sale_price: f64,
    pub cost_price: f64,
    pub stock: f64,
    pub category: String,
    pub unit: String,
    pub price_type: String,
    pub valid: bool,
}

#[tauri::command]
pub fn validate_csv_products(csv_content: String, state: State<'_, AppState>) -> Result<CsvValidationResult, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut rows: Vec<CsvProductRow> = Vec::new();
    let mut errors: Vec<CsvRowError> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut seen_barcodes: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Get existing barcodes from DB
    let mut existing_barcodes: std::collections::HashSet<String> = std::collections::HashSet::new();
    {
        let mut stmt = conn.prepare(
            "SELECT barcode FROM products WHERE barcode IS NOT NULL AND barcode != ''
             UNION SELECT barcode FROM product_barcodes"
        ).map_err(|e| e.to_string())?;
        let barcodes = stmt.query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for b in barcodes {
            if let Ok(code) = b {
                existing_barcodes.insert(code);
            }
        }
    }

    // Get existing categories
    let mut existing_categories: std::collections::HashSet<String> = std::collections::HashSet::new();
    {
        let mut stmt = conn.prepare("SELECT name FROM categories").map_err(|e| e.to_string())?;
        let cats = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        for c in cats {
            if let Ok(name) = c {
                existing_categories.insert(name.to_lowercase());
            }
        }
    }

    let mut new_categories: std::collections::HashSet<String> = std::collections::HashSet::new();

    let lines: Vec<&str> = csv_content.lines().collect();
    if lines.is_empty() {
        return Err("El archivo está vacío".to_string());
    }

    // Skip header row (first line)
    let data_lines = if lines.len() > 1 { &lines[1..] } else { return Err("El archivo solo tiene encabezados".to_string()); };

    for (i, line) in data_lines.iter().enumerate() {
        let row_num = i + 2; // +2 because 1-indexed and skip header
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Parse CSV (handle both comma and semicolon separators)
        let separator = if trimmed.contains(';') { ';' } else { ',' };
        let fields: Vec<&str> = trimmed.split(separator).map(|f| f.trim().trim_matches('"')).collect();

        if fields.len() < 3 {
            errors.push(CsvRowError {
                row: row_num,
                field: "general".to_string(),
                message: format!("Fila con menos de 3 columnas (tiene {})", fields.len()),
            });
            continue;
        }

        let barcode = fields.first().map(|s| s.to_string()).filter(|s| !s.is_empty());
        // Handle scientific notation from Excel (e.g., 7.7024E+12 → 7702400000000)
        let barcode = barcode.map(|b| {
            if b.to_uppercase().contains('E') {
                // Try to parse as scientific notation and convert to integer string
                let normalized = b.replace(',', ".");
                if let Ok(num) = normalized.parse::<f64>() {
                    format!("{:.0}", num)
                } else {
                    b
                }
            } else {
                b
            }
        }).filter(|s| !s.is_empty());
        let name = fields.get(1).unwrap_or(&"").to_string();
        let sale_price_str = fields.get(2).unwrap_or(&"0");
        let cost_price_str = fields.get(3).unwrap_or(&"0");
        let stock_str = fields.get(4).unwrap_or(&"0");
        let category = fields.get(5).map(|s| s.to_string()).unwrap_or_else(|| "General".to_string());
        let category = if category.is_empty() { "General".to_string() } else { category };
        let unit = fields.get(6).map(|s| s.to_string()).unwrap_or_else(|| "pieza".to_string());
        let unit = if unit.is_empty() { "pieza".to_string() } else { unit.to_lowercase() };
        let price_type = fields.get(7).map(|s| s.to_string()).unwrap_or_else(|| "fijo".to_string());
        let price_type = if price_type.is_empty() { "fijo".to_string() } else { price_type.to_lowercase() };

        let mut row_valid = true;

        // Validate name
        if name.is_empty() {
            errors.push(CsvRowError { row: row_num, field: "nombre".to_string(), message: "Nombre vacío".to_string() });
            row_valid = false;
        }

        // Validate sale_price
        let sale_price = sale_price_str.replace(',', ".").parse::<f64>().unwrap_or(-1.0);
        if sale_price < 0.0 {
            errors.push(CsvRowError { row: row_num, field: "precio_venta".to_string(), message: format!("Precio inválido: '{}'", sale_price_str) });
            row_valid = false;
        }

        // Parse cost_price and stock
        let cost_price = cost_price_str.replace(',', ".").parse::<f64>().unwrap_or(0.0).max(0.0);
        let stock = stock_str.replace(',', ".").parse::<f64>().unwrap_or(0.0).max(0.0);

        // Validate unit
        if unit != "pieza" && unit != "kg" {
            errors.push(CsvRowError { row: row_num, field: "unidad".to_string(), message: format!("Unidad inválida: '{}'. Debe ser 'pieza' o 'kg'", unit) });
            row_valid = false;
        }

        // Validate price_type
        if price_type != "fijo" && price_type != "bascula" && price_type != "monto" {
            errors.push(CsvRowError { row: row_num, field: "tipo_precio".to_string(), message: format!("Tipo inválido: '{}'. Debe ser 'fijo', 'bascula' o 'monto'", price_type) });
            row_valid = false;
        }

        // Validate barcode uniqueness
        if let Some(ref code) = barcode {
            if existing_barcodes.contains(code) {
                errors.push(CsvRowError { row: row_num, field: "código_barras".to_string(), message: format!("Código '{}' ya existe en la BD", code) });
                row_valid = false;
            } else if seen_barcodes.contains(code) {
                errors.push(CsvRowError { row: row_num, field: "código_barras".to_string(), message: format!("Código '{}' duplicado en el archivo", code) });
                row_valid = false;
            } else {
                seen_barcodes.insert(code.clone());
            }
        }

        // Check category
        if !existing_categories.contains(&category.to_lowercase()) && !new_categories.contains(&category.to_lowercase()) {
            new_categories.insert(category.to_lowercase());
            warnings.push(format!("Fila {}: categoría '{}' no existe — se creará", row_num, category));
        }

        rows.push(CsvProductRow {
            row_number: row_num,
            barcode,
            name,
            sale_price: if sale_price >= 0.0 { sale_price } else { 0.0 },
            cost_price,
            stock,
            category,
            unit,
            price_type,
            valid: row_valid,
        });
    }

    let valid_count = rows.iter().filter(|r| r.valid).count();
    let error_count = rows.iter().filter(|r| !r.valid).count();

    Ok(CsvValidationResult {
        valid_count,
        error_count,
        warnings,
        errors,
        rows,
    })
}

#[tauri::command]
pub fn import_csv_products(rows: Vec<CsvProductRow>, state: State<'_, AppState>) -> Result<u64, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let valid_rows: Vec<&CsvProductRow> = rows.iter().filter(|r| r.valid).collect();
    if valid_rows.is_empty() {
        return Err("No hay productos válidos para importar".to_string());
    }

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<u64, String> {
        let mut count: u64 = 0;

        for row in &valid_rows {
            // Ensure category exists
            let category_id: i64 = match conn.query_row(
                "SELECT id FROM categories WHERE LOWER(name) = LOWER(?1)",
                params![row.category],
                |r| r.get(0),
            ) {
                Ok(id) => id,
                Err(_) => {
                    conn.execute(
                        "INSERT INTO categories (name, description) VALUES (?1, ?2)",
                        params![row.category, format!("Creada desde importación CSV")],
                    ).map_err(|e| e.to_string())?;
                    conn.last_insert_rowid()
                }
            };

            // Insert product
            conn.execute(
                "INSERT INTO products (barcode, name, category_id, sale_price, cost_price, stock, unit, min_stock, price_type, active)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, 1)",
                params![
                    row.barcode,
                    row.name,
                    category_id,
                    row.sale_price,
                    row.cost_price,
                    row.stock,
                    row.unit,
                    row.price_type,
                ],
            ).map_err(|e| format!("Error insertando '{}': {}", row.name, e))?;

            // If barcode exists, also add to product_barcodes table
            if let Some(ref barcode) = row.barcode {
                let product_id = conn.last_insert_rowid();
                conn.execute(
                    "INSERT OR IGNORE INTO product_barcodes (product_id, barcode, label) VALUES (?1, ?2, 'Principal')",
                    params![product_id, barcode],
                ).map_err(|e| e.to_string())?;
            }

            count += 1;
        }

        Ok(count)
    })();

    match result {
        Ok(count) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(count)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}
