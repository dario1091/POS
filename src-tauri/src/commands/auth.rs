use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use tauri::State;

use crate::db::models::{LoginRequest, User};
use crate::AppState;

#[tauri::command]
pub fn login(request: LoginRequest, state: State<'_, AppState>) -> Result<User, String> {
    let conn = state.db.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, username, password_hash, full_name, role, active, created_at, updated_at 
             FROM users WHERE username = ?1 AND active = 1",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row(rusqlite::params![request.username], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, bool>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, String>(7)?,
        ))
    });

    match result {
        Ok((id, username, password_hash, full_name, role, active, created_at, updated_at)) => {
            // Verify password
            let parsed_hash =
                PasswordHash::new(&password_hash).map_err(|e| format!("Hash error: {}", e))?;

            Argon2::default()
                .verify_password(request.password.as_bytes(), &parsed_hash)
                .map_err(|_| "Contraseña incorrecta".to_string())?;

            // Store session
            let mut session = state.current_user.lock().map_err(|e| e.to_string())?;
            let user = User {
                id,
                username,
                full_name,
                role,
                active,
                created_at,
                updated_at,
            };
            *session = Some(user.clone());

            Ok(user)
        }
        Err(_) => Err("Usuario no encontrado".to_string()),
    }
}

#[tauri::command]
pub fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let mut session = state.current_user.lock().map_err(|e| e.to_string())?;
    *session = None;
    Ok(())
}

#[tauri::command]
pub fn get_current_user(state: State<'_, AppState>) -> Result<Option<User>, String> {
    let session = state.current_user.lock().map_err(|e| e.to_string())?;
    Ok(session.clone())
}

pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash password: {}", e))?;
    Ok(password_hash.to_string())
}
