use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct RecipeSupplyInput {
    pub supply_id: i64,
    pub quantity: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateRecipe {
    pub product_id: i64,
    pub yield_quantity: f64,
    pub procedure: Option<String>,
    pub supplies: Vec<RecipeSupplyInput>,
}

#[derive(Debug, Serialize)]
pub struct RecipeSupplyLine {
    pub supply_id: i64,
    pub supply_name: String,
    pub quantity: f64,
    pub unit: String,
}

#[derive(Debug, Serialize)]
pub struct Recipe {
    pub id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub yield_quantity: f64,
    pub procedure: Option<String>,
    pub supplies: Vec<RecipeSupplyLine>,
    pub created_at: String,
}

#[tauri::command]
pub fn create_recipe(recipe: CreateRecipe, state: State<'_, AppState>) -> Result<i64, String> {
    if recipe.yield_quantity <= 0.0 {
        return Err("El rendimiento debe ser mayor a 0".to_string());
    }
    if recipe.supplies.is_empty() {
        return Err("Agrega al menos un insumo a la receta".to_string());
    }

    let conn = state.db.get().map_err(|e| e.to_string())?;

    let product_name: String = conn.query_row(
        "SELECT name FROM products WHERE id = ?1",
        params![recipe.product_id],
        |row| row.get(0),
    ).map_err(|_| "Producto no encontrado".to_string())?;

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<i64, String> {
        conn.execute(
            "INSERT INTO recipes (product_id, product_name, yield_quantity, procedure) VALUES (?1, ?2, ?3, ?4)",
            params![recipe.product_id, product_name, recipe.yield_quantity, recipe.procedure],
        ).map_err(|e| e.to_string())?;
        let recipe_id = conn.last_insert_rowid();

        for s in &recipe.supplies {
            let (name, unit): (String, String) = conn.query_row(
                "SELECT name, unit FROM supplies WHERE id = ?1",
                params![s.supply_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            ).map_err(|_| format!("Insumo no encontrado (id {})", s.supply_id))?;

            conn.execute(
                "INSERT INTO recipe_supplies (recipe_id, supply_id, supply_name, quantity, unit) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![recipe_id, s.supply_id, name, s.quantity, unit],
            ).map_err(|e| e.to_string())?;
        }

        Ok(recipe_id)
    })();

    match result {
        Ok(id) => { conn.execute("COMMIT", []).ok(); Ok(id) }
        Err(e) => { conn.execute("ROLLBACK", []).ok(); Err(e) }
    }
}

fn list_recipes_internal(conn: &rusqlite::Connection) -> Result<Vec<Recipe>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, product_id, product_name, yield_quantity, procedure, created_at FROM recipes WHERE active = 1 ORDER BY product_name ASC"
    ).map_err(|e| e.to_string())?;

    let recipe_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, f64>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, String>(5)?,
        ))
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    let mut recipes = Vec::new();
    for (id, product_id, product_name, yield_quantity, procedure, created_at) in recipe_rows {
        let mut sstmt = conn.prepare(
            "SELECT supply_id, supply_name, quantity, unit FROM recipe_supplies WHERE recipe_id = ?1"
        ).map_err(|e| e.to_string())?;
        let supplies_rows = sstmt.query_map(params![id], |row| {
            Ok(RecipeSupplyLine {
                supply_id: row.get(0)?,
                supply_name: row.get(1)?,
                quantity: row.get(2)?,
                unit: row.get(3)?,
            })
        }).map_err(|e| e.to_string())?;
        let supplies = supplies_rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

        recipes.push(Recipe { id, product_id, product_name, yield_quantity, procedure, supplies, created_at });
    }

    Ok(recipes)
}

#[tauri::command]
pub fn list_recipes(state: State<'_, AppState>) -> Result<Vec<Recipe>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    list_recipes_internal(&conn)
}

#[tauri::command]
pub fn delete_recipe(recipe_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE recipes SET active = 0, updated_at = datetime('now','localtime') WHERE id = ?1",
        params![recipe_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// --- Cálculo de producción posible ---

#[derive(Debug, Serialize)]
pub struct PossibleProduction {
    pub recipe_id: i64,
    pub product_name: String,
    pub max_units: f64,
    pub limiting_supply: Option<String>,
    pub details: Vec<PossibleDetail>,
}

#[derive(Debug, Serialize)]
pub struct PossibleDetail {
    pub supply_name: String,
    pub available: f64,
    pub needed_per_batch: f64,
    pub unit: String,
    pub possible_batches: f64,
}

#[tauri::command]
pub fn calculate_possible_production(state: State<'_, AppState>) -> Result<Vec<PossibleProduction>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let recipes = list_recipes_internal(&conn)?;

    let mut results = Vec::new();

    for recipe in recipes {
        if recipe.supplies.is_empty() { continue; }

        let mut min_batches = f64::INFINITY;
        let mut limiting: Option<String> = None;
        let mut details = Vec::new();

        for s in &recipe.supplies {
            let available: f64 = conn.query_row(
                "SELECT stock FROM supplies WHERE id = ?1",
                params![s.supply_id],
                |row| row.get(0),
            ).unwrap_or(0.0);

            // Cuántas "recetas completas" puedo hacer con este insumo
            let possible_batches = if s.quantity > 0.0 { available / s.quantity } else { f64::INFINITY };

            if possible_batches < min_batches {
                min_batches = possible_batches;
                limiting = Some(s.supply_name.clone());
            }

            details.push(PossibleDetail {
                supply_name: s.supply_name.clone(),
                available,
                needed_per_batch: s.quantity,
                unit: s.unit.clone(),
                possible_batches,
            });
        }

        let max_units = if min_batches.is_finite() {
            (min_batches * recipe.yield_quantity).floor()
        } else {
            0.0
        };

        results.push(PossibleProduction {
            recipe_id: recipe.id,
            product_name: recipe.product_name,
            max_units,
            limiting_supply: limiting,
            details,
        });
    }

    Ok(results)
}
