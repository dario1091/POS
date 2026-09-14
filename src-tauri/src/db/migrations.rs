use rusqlite::Connection;

const MIGRATIONS: &[&str] = &[MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004, MIGRATION_005, MIGRATION_006, MIGRATION_007, MIGRATION_008];

// Legacy migration count: number of migrations that were previously in the array
// before the consolidation. This offset ensures new migrations get IDs that don't
// conflict with already-applied migrations in existing databases.
const LEGACY_OFFSET: i64 = 11;

const MIGRATION_001: &str = r#"
-- ============================================================
-- POS System — Schema completo (consolidado)
-- ============================================================

-- Usuarios
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

-- Categorías
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Productos
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
    price_type TEXT NOT NULL DEFAULT 'fijo' CHECK(price_type IN ('fijo', 'bascula', 'monto')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Múltiples códigos de barras por producto
CREATE TABLE IF NOT EXISTS product_barcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL UNIQUE,
    label TEXT
);

-- Clientes
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    credit_limit REAL NOT NULL DEFAULT 0,
    credit_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Ventas (cabecera)
CREATE TABLE IF NOT EXISTS sales (
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
    cancelled INTEGER NOT NULL DEFAULT 0,
    cancelled_at TEXT,
    cancelled_by INTEGER,
    cancel_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Detalle de venta (items)
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

-- Pagos de venta (para pagos mixtos)
CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    method TEXT NOT NULL CHECK(method IN ('efectivo', 'tarjeta', 'transferencia', 'credito')),
    amount REAL NOT NULL,
    reference TEXT
);

-- Ajustes de inventario
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('entrada', 'salida')),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Configuración del sistema (key-value)
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Cortes de caja
CREATE TABLE IF NOT EXISTS cash_cuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expected_cash REAL NOT NULL,
    actual_cash REAL NOT NULL,
    difference REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Entregas parciales de efectivo
CREATE TABLE IF NOT EXISTS cash_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    supervisor_name TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Devoluciones
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

-- Abonos a crédito
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

-- ============================================================
-- Índices para rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_cash_deliveries_user_id ON cash_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_deliveries_created_at ON cash_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_created ON credit_payments(created_at);

-- ============================================================
-- Categorías predefinidas para supermercado
-- ============================================================
INSERT OR IGNORE INTO categories (name, description) VALUES ('General', 'Categoría por defecto');
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

-- ============================================================
-- Productos por defecto del sistema (IDs 1-6)
-- ============================================================
INSERT INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (1, 'Bolsa pequeña', 200, 100, 9999, 'pieza', 0, 'fijo', 1);
INSERT INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (2, 'Bolsa grande', 400, 200, 9999, 'pieza', 0, 'fijo', 1);
INSERT INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (3, 'Frutas y Verduras', 0, 0, 9999, 'kg', 0, 'monto', 1);
INSERT INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (4, 'Carnes', 0, 0, 9999, 'kg', 0, 'monto', 1);
INSERT INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (5, 'Pollo', 0, 0, 9999, 'kg', 0, 'monto', 1);
INSERT INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (6, 'Pescados', 0, 0, 9999, 'kg', 0, 'monto', 1);
"#;

const MIGRATION_002: &str = r#"
-- Pagos a proveedores desde caja
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    supplier_name TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_created_at ON supplier_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_user_id ON supplier_payments(user_id);
"#;

const MIGRATION_003: &str = r#"
-- Snapshot completo del corte de caja
ALTER TABLE cash_cuts ADD COLUMN total_sales REAL NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN cash_sales REAL NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN card_sales REAL NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN transfer_sales REAL NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN credit_sales REAL NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN transactions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN deliveries_total REAL NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN deliveries_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN supplier_payments_total REAL NOT NULL DEFAULT 0;
ALTER TABLE cash_cuts ADD COLUMN supplier_payments_count INTEGER NOT NULL DEFAULT 0;
"#;

const MIGRATION_004: &str = r#"
-- Instalaciones existentes: si ya hay productos y no hay business_type definido,
-- se asume 'abarrotes' para no romper el flujo actual.
INSERT OR IGNORE INTO config (key, value)
SELECT 'business_type', 'abarrotes'
WHERE EXISTS (SELECT 1 FROM products WHERE id > 6);
"#;

const MIGRATION_005: &str = r#"
-- Insumos / materias primas (para panadería)
CREATE TABLE IF NOT EXISTS supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg' CHECK(unit IN ('kg', 'g', 'l', 'ml', 'unidad')),
    stock REAL NOT NULL DEFAULT 0,
    cost_per_unit REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_supplies_name ON supplies(name);
"#;

const MIGRATION_006: &str = r#"
-- Producciones (para panadería): consume insumos, genera productos terminados
CREATE TABLE IF NOT EXISTS productions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    total_supply_cost REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Insumos consumidos en una producción
CREATE TABLE IF NOT EXISTS production_supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL REFERENCES productions(id),
    supply_id INTEGER NOT NULL REFERENCES supplies(id),
    supply_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0
);

-- Productos terminados generados en una producción
CREATE TABLE IF NOT EXISTS production_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL REFERENCES productions(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_productions_created_at ON productions(created_at);
CREATE INDEX IF NOT EXISTS idx_production_supplies_production ON production_supplies(production_id);
CREATE INDEX IF NOT EXISTS idx_production_items_production ON production_items(production_id);
"#;

const MIGRATION_007: &str = r#"
-- Recetas (para panadería): definen insumos y rendimiento de un producto
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    yield_quantity REAL NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Insumos que consume una receta (para el rendimiento indicado)
CREATE TABLE IF NOT EXISTS recipe_supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    supply_id INTEGER NOT NULL REFERENCES supplies(id),
    supply_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_supplies_recipe ON recipe_supplies(recipe_id);
"#;

const MIGRATION_008: &str = r#"
-- Procedimiento / pasos de la receta (know-how del negocio)
ALTER TABLE recipes ADD COLUMN procedure TEXT;
"#;

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Create migrations tracking table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );",
    )?;

    // Check the highest applied migration ID
    let max_applied: i64 =
        conn.query_row("SELECT COALESCE(MAX(id), 0) FROM _migrations", [], |row| row.get(0))?;

    // Run pending migrations.
    // Migration IDs: MIGRATION_001 = 1, MIGRATION_002 = LEGACY_OFFSET + 1 (12), etc.
    // This ensures new migrations don't conflict with legacy DBs that had multiple
    // migrations consolidated into MIGRATION_001.
    for (i, migration) in MIGRATIONS.iter().enumerate() {
        let migration_id = if i == 0 { 1 } else { LEGACY_OFFSET + i as i64 };
        if migration_id > max_applied {
            conn.execute_batch("BEGIN TRANSACTION;")?;

            match conn.execute_batch(migration) {
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
