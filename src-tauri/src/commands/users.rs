use rusqlite::params;
use tauri::State;

use crate::commands::auth::hash_password;
use crate::db::models::{CreateUser, UpdateUser, User};
use crate::AppState;

#[tauri::command]
pub fn create_user(user: CreateUser, state: State<'_, AppState>) -> Result<User, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    let password_hash = hash_password(&user.password)?;

    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES (?1, ?2, ?3, ?4)",
        params![user.username, password_hash, user.full_name, user.role],
    )
    .map_err(|e| format!("Error al crear usuario: {}", e))?;

    let id = conn.last_insert_rowid();

    let created = conn
        .query_row(
            "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?1",
            params![id],
            |row| {
                Ok(User {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    full_name: row.get(2)?,
                    role: row.get(3)?,
                    active: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(created)
}

#[tauri::command]
pub fn update_user(user: UpdateUser, state: State<'_, AppState>) -> Result<User, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    if let Some(ref username) = user.username {
        conn.execute(
            "UPDATE users SET username = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![username, user.id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(ref password) = user.password {
        let hash = hash_password(password)?;
        conn.execute(
            "UPDATE users SET password_hash = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![hash, user.id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(ref full_name) = user.full_name {
        conn.execute(
            "UPDATE users SET full_name = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![full_name, user.id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(ref role) = user.role {
        conn.execute(
            "UPDATE users SET role = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![role, user.id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(active) = user.active {
        conn.execute(
            "UPDATE users SET active = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2",
            params![active, user.id],
        )
        .map_err(|e| e.to_string())?;
    }

    let updated = conn
        .query_row(
            "SELECT id, username, full_name, role, active, created_at, updated_at FROM users WHERE id = ?1",
            params![user.id],
            |row| {
                Ok(User {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    full_name: row.get(2)?,
                    role: row.get(3)?,
                    active: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn list_users(state: State<'_, AppState>) -> Result<Vec<User>, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, username, full_name, role, active, created_at, updated_at FROM users ORDER BY id")
        .map_err(|e| e.to_string())?;

    let users = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                full_name: row.get(2)?,
                role: row.get(3)?,
                active: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(users)
}

#[tauri::command]
pub fn toggle_user_active(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE users SET active = NOT active, updated_at = datetime('now', 'localtime') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
