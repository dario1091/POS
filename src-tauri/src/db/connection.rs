use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::path::PathBuf;

pub type DbPool = Pool<SqliteConnectionManager>;

/// Customizer that runs PRAGMAs on every new connection from the pool
#[derive(Debug)]
struct ConnectionCustomizer;

impl r2d2::CustomizeConnection<Connection, rusqlite::Error> for ConnectionCustomizer {
    fn on_acquire(&self, conn: &mut Connection) -> Result<(), rusqlite::Error> {
        conn.execute_batch(
            "PRAGMA foreign_keys=ON;
             PRAGMA busy_timeout=5000;",
        )?;
        Ok(())
    }
}

pub fn create_pool(db_path: &PathBuf) -> Result<DbPool, Box<dyn std::error::Error>> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let manager = SqliteConnectionManager::file(db_path);
    let pool = Pool::builder()
        .max_size(5)
        .connection_customizer(Box::new(ConnectionCustomizer))
        .build(manager)?;

    // Enable WAL mode (only needs to be set once, persists in the DB file)
    let conn = pool.get()?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    Ok(pool)
}
