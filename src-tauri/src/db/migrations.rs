use rusqlite::Connection;

const MIGRATIONS: &[&str] = &[MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004, MIGRATION_005, MIGRATION_006, MIGRATION_007, MIGRATION_008, MIGRATION_009, MIGRATION_010, MIGRATION_011, MIGRATION_012];

const MIGRATION_001: &str = r#"
-- Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'cajero')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    sale_price REAL NOT NULL,
    cost_price REAL NOT NULL DEFAULT 0,
    stock REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'pieza' CHECK(unit IN ('pieza', 'kg')),
    min_stock REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sales header
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('efectivo', 'tarjeta', 'transferencia')),
    amount_paid REAL NOT NULL,
    change_amount REAL NOT NULL DEFAULT 0,
    machine_id TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sale items
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL
);

-- Inventory adjustments
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('entrada', 'salida')),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- System config (key-value)
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Cash cuts
CREATE TABLE IF NOT EXISTS cash_cuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expected_cash REAL NOT NULL,
    actual_cash REAL NOT NULL,
    difference REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
"#;

const MIGRATION_002: &str = r#"
-- Sale payments table for mixed payments
CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    method TEXT NOT NULL CHECK(method IN ('efectivo', 'tarjeta', 'transferencia')),
    amount REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);

-- Update sales.payment_method to allow 'mixto'
-- SQLite doesn't support ALTER CHECK, but we can just allow the value in code
"#;

const MIGRATION_003: &str = r#"
-- Multiple barcodes per product
CREATE TABLE IF NOT EXISTS product_barcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL UNIQUE,
    label TEXT
);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON product_barcodes(product_id);

-- Migrate existing barcodes from products table to product_barcodes
INSERT OR IGNORE INTO product_barcodes (product_id, barcode, label)
SELECT id, barcode, 'Principal' FROM products WHERE barcode IS NOT NULL AND barcode != '';

-- Add reference field to sale_payments for transaction/authorization numbers
ALTER TABLE sale_payments ADD COLUMN reference TEXT;
"#;

const MIGRATION_004: &str = r#"
-- Recreate sales table to allow 'mixto' in payment_method CHECK
DROP TABLE IF EXISTS sales_new;
CREATE TABLE sales_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'mixto')),
    amount_paid REAL NOT NULL,
    change_amount REAL NOT NULL DEFAULT 0,
    machine_id TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT INTO sales_new SELECT * FROM sales;
DROP TABLE sales;
ALTER TABLE sales_new RENAME TO sales;

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
"#;

const MIGRATION_005: &str = r#"
-- Credit system for customers
ALTER TABLE customers ADD COLUMN credit_limit REAL NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN credit_balance REAL NOT NULL DEFAULT 0;

-- Recreate sales table to allow 'credito' in payment_method
DROP TABLE IF EXISTS sales_new;
CREATE TABLE sales_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'mixto', 'credito')),
    amount_paid REAL NOT NULL,
    change_amount REAL NOT NULL DEFAULT 0,
    machine_id TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT INTO sales_new SELECT * FROM sales;
DROP TABLE sales;
ALTER TABLE sales_new RENAME TO sales;

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
"#;

const MIGRATION_006: &str = r#"
-- Cash deliveries (entregas parciales de efectivo al supervisor)
CREATE TABLE IF NOT EXISTS cash_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    supervisor_name TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_cash_deliveries_user_id ON cash_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_deliveries_created_at ON cash_deliveries(created_at);
"#;

const MIGRATION_007: &str = r#"
-- Returns/refunds
CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total REAL NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES returns(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
"#;

const MIGRATION_008: &str = r#"
-- Price type for products: fijo (default), bascula (reads weight), monto (asks for amount)
ALTER TABLE products ADD COLUMN price_type TEXT NOT NULL DEFAULT 'fijo' CHECK(price_type IN ('fijo', 'bascula', 'monto'));
"#;

const MIGRATION_009: &str = r#"
-- Categorías predefinidas para supermercado
INSERT OR IGNORE INTO categories (name, description) VALUES ('Víveres', 'Arroz, aceite, granos, enlatados');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Bebidas', 'Gaseosas, jugos, agua, energizantes');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Snacks', 'Papas, galletas, dulces, mecato');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Lácteos', 'Leche, queso, yogurt, mantequilla');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Frutas y Verduras', 'Productos frescos');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Carnes y Embutidos', 'Pollo, res, cerdo, jamón, salchichas');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Panadería', 'Pan, tortas, ponqués');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Aseo Personal', 'Jabón, shampoo, desodorante, crema dental');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Limpieza del Hogar', 'Detergente, desinfectante, escobas');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Medicamentos', 'Pastillas, jarabes, primeros auxilios');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Papelería', 'Cuadernos, lápices, bolígrafos');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Mascotas', 'Concentrado, arena, accesorios');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Licores', 'Cerveza, aguardiente, vino, whisky');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Congelados', 'Helados, verduras congeladas, pizzas');
INSERT OR IGNORE INTO categories (name, description) VALUES ('Condimentos y Salsas', 'Sal, pimienta, salsa de tomate, mayonesa');
"#;

const MIGRATION_010: &str = r#"
-- Credit payments (abonos a crédito)
CREATE TABLE IF NOT EXISTS credit_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('efectivo', 'tarjeta', 'transferencia')),
    reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_created ON credit_payments(created_at);

-- Sale cancellations (anulaciones)
ALTER TABLE sales ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN cancelled_at TEXT;
ALTER TABLE sales ADD COLUMN cancelled_by INTEGER;
ALTER TABLE sales ADD COLUMN cancel_reason TEXT;
"#;

const MIGRATION_011: &str = include_str!("migration_011_products.sql");

const MIGRATION_012: &str = include_str!("migration_012_default_products.sql");

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Create migrations tracking table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );",
    )?;

    // Check which migrations have been applied
    let applied_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM _migrations", [], |row| row.get(0))?;

    // Run pending migrations (each in its own transaction)
    for (i, migration) in MIGRATIONS.iter().enumerate() {
        let migration_id = (i + 1) as i64;
        if migration_id > applied_count {
            conn.execute_batch("BEGIN TRANSACTION;")?;

            // Migration 011 is large (4371 products) — execute line by line
            let result = if migration_id == 11 {
                run_large_migration(conn, migration)
            } else {
                conn.execute_batch(migration).map(|_| ())
            };

            match result {
                Ok(()) => {
                    conn.execute(
                        "INSERT INTO _migrations (id) VALUES (?1)",
                        rusqlite::params![migration_id],
                    )?;
                    conn.execute_batch("COMMIT;")?;
                    println!("Applied migration {}", migration_id);
                }
                Err(e) => {
                    let _ = conn.execute_batch("ROLLBACK;");
                    return Err(e);
                }
            }
        }
    }

    Ok(())
}

/// Execute a large migration statement by statement to avoid parser limits
fn run_large_migration(conn: &Connection, sql: &str) -> Result<(), rusqlite::Error> {
    for line in sql.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("--") {
            continue;
        }
        conn.execute_batch(trimmed)?;
    }
    Ok(())
}
