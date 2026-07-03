# POS System — Design

## Estructura del Proyecto

```
POS/
├── src-tauri/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs                 # Entry point Tauri
│   │   ├── lib.rs                  # Setup y configuración
│   │   ├── commands/               # Tauri commands (bridge frontend ↔ backend)
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs             # Login, logout, sesión
│   │   │   ├── users.rs            # CRUD usuarios
│   │   │   ├── products.rs         # CRUD productos, búsqueda
│   │   │   ├── categories.rs       # CRUD categorías
│   │   │   ├── customers.rs        # CRUD clientes
│   │   │   ├── sales.rs            # Registrar venta, historial
│   │   │   ├── inventory.rs        # Ajustes de stock
│   │   │   ├── reports.rs          # Consultas de reportes
│   │   │   ├── hardware.rs         # Impresora, báscula, cajón
│   │   │   └── config.rs           # Configuración del sistema
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── connection.rs       # Pool de conexión SQLite
│   │   │   ├── migrations.rs       # Migraciones embebidas
│   │   │   └── models.rs           # Structs de BD
│   │   ├── hardware/
│   │   │   ├── mod.rs
│   │   │   ├── printer.rs          # ESC/POS commands
│   │   │   ├── scale.rs            # Lectura puerto serial (báscula)
│   │   │   └── cash_drawer.rs      # Apertura cajón via impresora
│   │   ├── network/
│   │   │   ├── mod.rs
│   │   │   └── server.rs           # Axum HTTP server (modo servidor LAN)
│   │   └── config.rs               # Struct de configuración (rol, IP, puertos)
│   ├── migrations/
│   │   └── 001_initial.sql
│   └── tauri.conf.json
├── src/                             # Frontend React
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── login.tsx
│   │   ├── pos/                    # Pantalla punto de venta
│   │   │   ├── index.tsx
│   │   │   ├── ProductSearch.tsx
│   │   │   ├── Cart.tsx
│   │   │   ├── PaymentDialog.tsx
│   │   │   └── ScaleReader.tsx
│   │   └── admin/                  # Dashboard administrativo
│   │       ├── index.tsx
│   │       ├── products/
│   │       ├── categories/
│   │       ├── customers/
│   │       ├── users/
│   │       ├── inventory/
│   │       └── reports/
│   ├── components/                 # Componentes reutilizables (shadcn)
│   ├── hooks/                      # Custom hooks
│   ├── lib/                        # Utilidades, tipos, API calls a Tauri
│   └── styles/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

## Esquema de Base de Datos

```sql
-- Usuarios del sistema
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'cajero')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categorías de productos
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Productos
CREATE TABLE products (
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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Clientes
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ventas (cabecera)
CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('efectivo', 'tarjeta')),
    amount_paid REAL NOT NULL,
    change_amount REAL NOT NULL DEFAULT 0,
    machine_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Detalle de venta (items)
CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL
);

-- Ajustes de inventario
CREATE TABLE inventory_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('entrada', 'salida')),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configuración del sistema (key-value)
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Cortes de caja
CREATE TABLE cash_cuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expected_cash REAL NOT NULL,
    actual_cash REAL NOT NULL,
    difference REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índices para rendimiento
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
```

## Comunicación Frontend ↔ Backend

El frontend invoca **Tauri commands** (funciones Rust expuestas al frontend via IPC):

```rust
// Ejemplo: comando de búsqueda de producto
#[tauri::command]
async fn search_products(query: String, state: State<'_, AppState>) -> Result<Vec<Product>, String> {
    // query a SQLite, retorna productos
}
```

```typescript
// Desde React
import { invoke } from '@tauri-apps/api/core';

const products = await invoke<Product[]>('search_products', { query: 'coca' });
```

## Modo Servidor vs Cliente

La app detecta su rol desde un archivo de configuración local (`config.json` en el directorio de datos de la app):

```json
// Servidor
{ "role": "server", "port": 3847, "business_name": "Mi Tienda" }

// Cliente
{ "role": "client", "server_ip": "192.168.1.100", "server_port": 3847 }
```

### Servidor
- Inicia SQLite local.
- Inicia servidor Axum en `0.0.0.0:{port}` para atender clientes LAN.
- Los Tauri commands operan directamente contra SQLite.

### Cliente
- NO tiene SQLite local.
- Los Tauri commands hacen HTTP requests al servidor Axum en la LAN.
- Hardware (impresora, cajón, báscula) se maneja localmente.

## Flujo de Venta

```
1. Cajero abre sesión (login)
2. Pantalla POS activa, cursor en campo de búsqueda
3. Escanea código de barras → campo recibe texto → búsqueda automática
4. Producto encontrado → se agrega al carrito (cantidad 1 o peso de báscula)
5. Repite 3-4 hasta completar
6. Click "Cobrar" → modal de pago
7. Selecciona método (efectivo/tarjeta)
8. Si efectivo: ingresa monto recibido → muestra cambio
9. Confirma → Backend: guarda venta + descuenta stock + imprime ticket + abre cajón
10. Carrito se limpia → listo para siguiente venta
```

## Manejo de Hardware

### Impresora (ESC/POS)
- Se escribe directamente al dispositivo USB (`/dev/usb/lp0` o similar).
- Comandos ESC/POS raw: inicializar, texto, corte, apertura cajón.
- Configuración del path del dispositivo en settings.

### Báscula
- Se lee del puerto serial (`/dev/ttyUSB0` o similar).
- Baud rate configurable (9600 por defecto).
- Lectura continua en un thread separado, expone último peso vía Tauri event al frontend.
- El frontend muestra peso en tiempo real en la pantalla POS.

### Cajón de dinero
- Se abre enviando el comando ESC/POS estándar de apertura (`\x1b\x70\x00\x19\x19`) a la impresora.
- Mismo device path que la impresora.
