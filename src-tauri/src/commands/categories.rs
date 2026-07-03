use rusqlite::params;
use tauri::State;

use crate::db::models::Category;
use crate::AppState;

#[derive(serde::Deserialize)]
pub struct CreateCategory {
    pub name: String,
    pub description: Option<String>,
}

#[tauri::command]
pub fn create_category(category: CreateCategory, state: State<'_, AppState>) -> Result<Category, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO categories (name, description) VALUES (?1, ?2)",
        params![category.name, category.description],
    )
    .map_err(|e| format!("Error al crear categoría: {}", e))?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, description, active, created_at FROM categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                active: row.get(3)?,
                created_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_category(id: i64, name: String, description: Option<String>, state: State<'_, AppState>) -> Result<Category, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE categories SET name = ?1, description = ?2 WHERE id = ?3",
        params![name, description, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, name, description, active, created_at FROM categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                active: row.get(3)?,
                created_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, description, active, created_at FROM categories WHERE active = 1 ORDER BY name")
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                active: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
}
