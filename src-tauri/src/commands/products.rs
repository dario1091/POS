use rusqlite::params;
use tauri::State;

use crate::db::models::{CreateProduct, Product, UpdateProduct};
use crate::AppState;

#[tauri::command]
pub fn create_product(product: CreateProduct, state: State<'_, AppState>) -> Result<Product, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO products (barcode, name, description, category_id, sale_price, cost_price, stock, unit, min_stock, price_type)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            product.barcode,
            product.name,
            product.description,
            product.category_id,
            product.sale_price,
            product.cost_price,
            product.stock,
            product.unit,
            product.min_stock,
            product.price_type.as_deref().unwrap_or("fijo"),
        ],
    )
    .map_err(|e| format!("Error al crear producto: {}", e))?;

    let id = conn.last_insert_rowid();
    get_product_by_id(id, &conn)
}

#[tauri::command]
pub fn update_product(product: UpdateProduct, state: State<'_, AppState>) -> Result<Product, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    // Build dynamic update
    let mut updates = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref barcode) = product.barcode {
        updates.push("barcode = ?");
        values.push(Box::new(barcode.clone()));
    }
    if let Some(ref name) = product.name {
        updates.push("name = ?");
        values.push(Box::new(name.clone()));
    }
    if let Some(ref description) = product.description {
        updates.push("description = ?");
        values.push(Box::new(description.clone()));
    }
    if let Some(category_id) = product.category_id {
        updates.push("category_id = ?");
        values.push(Box::new(category_id));
    }
    if let Some(sale_price) = product.sale_price {
        updates.push("sale_price = ?");
        values.push(Box::new(sale_price));
    }
    if let Some(cost_price) = product.cost_price {
        updates.push("cost_price = ?");
        values.push(Box::new(cost_price));
    }
    if let Some(stock) = product.stock {
        updates.push("stock = ?");
        values.push(Box::new(stock));
    }
    if let Some(ref unit) = product.unit {
        updates.push("unit = ?");
        values.push(Box::new(unit.clone()));
    }
    if let Some(min_stock) = product.min_stock {
        updates.push("min_stock = ?");
        values.push(Box::new(min_stock));
    }
    if let Some(active) = product.active {
        updates.push("active = ?");
        values.push(Box::new(active));
    }

    if updates.is_empty() {
        return get_product_by_id(product.id, &conn);
    }

    updates.push("updated_at = datetime('now', 'localtime')");
    values.push(Box::new(product.id));

    let sql = format!(
        "UPDATE products SET {} WHERE id = ?",
        updates.join(", ")
    );

    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())
        .map_err(|e| e.to_string())?;

    get_product_by_id(product.id, &conn)
}

#[tauri::command]
pub fn list_products(state: State<'_, AppState>) -> Result<Vec<Product>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, barcode, name, description, category_id, sale_price, cost_price, 
                    stock, unit, min_stock, price_type, active, created_at, updated_at 
             FROM products WHERE active = 1 ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let products = stmt
        .query_map([], |row| row_to_product(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(products)
}

#[tauri::command]
pub fn search_product_by_code(code: String, state: State<'_, AppState>) -> Result<Option<Product>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    // Search in product_barcodes table first, then fallback to product ID
    let result = conn.query_row(
        "SELECT p.id, p.barcode, p.name, p.description, p.category_id, p.sale_price, p.cost_price, 
                p.stock, p.unit, p.min_stock, p.price_type, p.active, p.created_at, p.updated_at 
         FROM products p
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id
         WHERE (pb.barcode = ?1 OR p.barcode = ?1 OR p.id = ?2) AND p.active = 1
         LIMIT 1",
        params![code, code.parse::<i64>().unwrap_or(-1)],
        |row| row_to_product(row),
    );

    match result {
        Ok(product) => Ok(Some(product)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn search_products_by_name(name: String, state: State<'_, AppState>) -> Result<Vec<Product>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let search_term = format!("%{}%", name);

    let mut stmt = conn
        .prepare(
            "SELECT id, barcode, name, description, category_id, sale_price, cost_price, 
                    stock, unit, min_stock, price_type, active, created_at, updated_at 
             FROM products WHERE name LIKE ?1 AND active = 1 ORDER BY name LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let products = stmt
        .query_map(params![search_term], |row| row_to_product(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(products)
}

fn get_product_by_id(id: i64, conn: &rusqlite::Connection) -> Result<Product, String> {
    conn.query_row(
        "SELECT id, barcode, name, description, category_id, sale_price, cost_price, 
                stock, unit, min_stock, price_type, active, created_at, updated_at 
         FROM products WHERE id = ?1",
        params![id],
        |row| row_to_product(row),
    )
    .map_err(|e| e.to_string())
}

fn row_to_product(row: &rusqlite::Row) -> Result<Product, rusqlite::Error> {
    Ok(Product {
        id: row.get(0)?,
        barcode: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        category_id: row.get(4)?,
        sale_price: row.get(5)?,
        cost_price: row.get(6)?,
        stock: row.get(7)?,
        unit: row.get(8)?,
        min_stock: row.get(9)?,
        price_type: row.get(10)?,
        active: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

// --- Barcode management ---

use crate::db::models::{ProductBarcode, AddBarcode};

#[tauri::command]
pub fn get_product_barcodes(product_id: i64, state: State<'_, AppState>) -> Result<Vec<ProductBarcode>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, product_id, barcode, label FROM product_barcodes WHERE product_id = ?1 ORDER BY id")
        .map_err(|e| e.to_string())?;

    let barcodes = stmt
        .query_map(params![product_id], |row| {
            Ok(ProductBarcode {
                id: row.get(0)?,
                product_id: row.get(1)?,
                barcode: row.get(2)?,
                label: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(barcodes)
}

#[tauri::command]
pub fn add_product_barcode(data: AddBarcode, state: State<'_, AppState>) -> Result<ProductBarcode, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO product_barcodes (product_id, barcode, label) VALUES (?1, ?2, ?3)",
        params![data.product_id, data.barcode, data.label],
    )
    .map_err(|e| format!("Error al agregar código de barras (¿ya existe?): {}", e))?;

    let id = conn.last_insert_rowid();
    Ok(ProductBarcode {
        id,
        product_id: data.product_id,
        barcode: data.barcode,
        label: data.label,
    })
}

#[tauri::command]
pub fn remove_product_barcode(barcode_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM product_barcodes WHERE id = ?1", params![barcode_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
