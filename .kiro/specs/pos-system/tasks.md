# POS System — Tasks

## Fase 1: Fundación (MVP una máquina)

### 1.1 Setup del proyecto
- [ ] Inicializar proyecto Tauri v2 con template React + TypeScript + Vite
- [ ] Configurar Tailwind CSS + shadcn/ui
- [ ] Configurar Cargo.toml con dependencias Rust (rusqlite, serde, tokio, argon2)
- [ ] Crear estructura de directorios (commands/, db/, hardware/, network/)
- [ ] Configurar tauri.conf.json (permisos, ventana, nombre de app)

### 1.2 Base de datos
- [ ] Implementar módulo de conexión SQLite (pool con r2d2 o similar)
- [ ] Crear migración inicial (001_initial.sql) con todas las tablas
- [ ] Implementar sistema de migraciones embebidas (ejecutar al arranque)
- [ ] Seed inicial: usuario admin por defecto, categoría "General", cliente "Público en general"

### 1.3 Autenticación y Usuarios
- [ ] Implementar hash de contraseñas con argon2
- [ ] Comando Tauri: `login(username, password)` → retorna user + role
- [ ] Comando Tauri: `logout()`
- [ ] Comando Tauri: `get_current_user()` → retorna sesión activa
- [ ] CRUD usuarios (solo admin): `create_user`, `update_user`, `list_users`, `toggle_user_active`
- [ ] Frontend: Pantalla de login
- [ ] Frontend: Protección de rutas por rol
- [ ] Frontend: CRUD de usuarios en dashboard admin

### 1.4 Productos e Inventario
- [ ] Comando Tauri: `create_product`, `update_product`, `list_products`, `get_product`
- [ ] Comando Tauri: `search_products(query)` — búsqueda por nombre o barcode
- [ ] Comando Tauri: `create_category`, `update_category`, `list_categories`
- [ ] Comando Tauri: `adjust_inventory(product_id, type, quantity, reason)`
- [ ] Frontend: CRUD productos en dashboard admin
- [ ] Frontend: CRUD categorías en dashboard admin
- [ ] Frontend: Pantalla de ajustes de inventario
- [ ] Frontend: Indicador visual de stock bajo

### 1.5 Clientes
- [ ] Comando Tauri: `create_customer`, `update_customer`, `list_customers`, `search_customers`
- [ ] Comando Tauri: `get_customer_history(customer_id)` — ventas del cliente
- [ ] Frontend: CRUD clientes en dashboard admin
- [ ] Frontend: Selector de cliente en pantalla POS (búsqueda rápida)

### 1.6 Punto de Venta (pantalla de cobro)
- [ ] Frontend: Layout POS — pantalla limpia: lista de productos arriba, total visible, input de comandos en la parte inferior
- [ ] Frontend: Command Bar (input inferior) — parser de comandos:
  - `{barcode}` o `{ref_number}` → buscar y agregar producto (cantidad 1)
  - `N*{código}` → agregar N unidades
  - `pv{código}` → modal con precio de venta
  - `pv%nombre%` → modal con ocurrencias encontradas
- [ ] Frontend: Lista de productos en carrito (tabla: #, nombre, cant, precio unit, subtotal)
- [ ] Frontend: Navegación ↑↓ por la lista cuando input está vacío (resaltar fila activa)
- [ ] Frontend: Tecla F1 — Cobrar efectivo (modal: monto recibido → cambio → confirmar)
- [ ] Frontend: Tecla F2 — Cobrar otros medios (modal: seleccionar TC/TD/transferencia → confirmar)
- [ ] Frontend: Tecla F3 — Eliminar producto seleccionado de la lista
- [ ] Frontend: Tecla F4 — Cancelar venta completa (con confirmación)
- [ ] Frontend: Tecla F5 — Buscar/asignar cliente (modal búsqueda)
- [ ] Frontend: Focus management — input siempre con focus, modales con Escape, retorno automático
- [ ] Comando Tauri: `search_product_by_code(code)` — busca por barcode O por referencia numérica (ID)
- [ ] Comando Tauri: `search_products_by_name(name)` — búsqueda parcial por nombre
- [ ] Comando Tauri: `create_sale(items, customer_id, payment_method, amount_paid, discount)`
- [ ] Lógica backend: guardar venta + descontar stock en transacción atómica
- [ ] Frontend: Toast de error si producto no encontrado (no interrumpe flujo)
- [ ] Frontend: Limpieza automática del input después de cada acción

## Fase 2: Hardware

### 2.1 Impresora térmica ESC/POS
- [ ] Módulo Rust: `printer.rs` — abrir dispositivo USB, enviar bytes raw
- [ ] Implementar comandos ESC/POS: inicializar, texto, negrita, corte, feed
- [ ] Comando Tauri: `print_ticket(sale_id)` — genera y envía ticket de venta
- [ ] Comando Tauri: `test_printer()` — imprime ticket de prueba
- [ ] Formato de ticket: negocio, fecha, items, totales, método pago, cambio
- [ ] Frontend: Configuración de impresora (path del dispositivo) en settings

### 2.2 Cajón de dinero
- [ ] Módulo Rust: `cash_drawer.rs` — enviar comando apertura ESC/POS
- [ ] Comando Tauri: `open_cash_drawer()`
- [ ] Integrar apertura automática al confirmar venta en efectivo
- [ ] Frontend: Botón "Abrir cajón" en pantalla POS (con permiso)

### 2.3 Báscula
- [ ] Módulo Rust: `scale.rs` — leer puerto serial en thread separado
- [ ] Implementar parsing de peso (string numérico desde serial)
- [ ] Emitir Tauri event `scale_weight_update` con el peso actual
- [ ] Comando Tauri: `start_scale_reading()`, `stop_scale_reading()`
- [ ] Comando Tauri: `get_scale_config()`, `set_scale_config(port, baud_rate)`
- [ ] Frontend: Componente `ScaleReader` — muestra peso en tiempo real
- [ ] Frontend: Al agregar producto tipo "kg", usar peso de báscula como cantidad
- [ ] Frontend: Configuración de báscula (puerto, baud rate) en settings

## Fase 3: Multi-máquina (LAN)

### 3.1 Servidor Axum
- [ ] Módulo Rust: `network/server.rs` — servidor HTTP Axum
- [ ] Exponer endpoints REST que replican los Tauri commands (productos, ventas, clientes, etc.)
- [ ] Iniciar servidor solo cuando el rol es "server"
- [ ] Endpoint de health check: `GET /api/health`

### 3.2 Modo cliente
- [ ] Módulo Rust: `network/client.rs` — HTTP client (reqwest)
- [ ] Cuando rol es "client", los Tauri commands hacen HTTP al servidor en vez de SQLite local
- [ ] Detección de conexión/desconexión con el servidor
- [ ] Frontend: Indicador de estado de conexión con servidor
- [ ] Frontend: Mensaje de error si se pierde la conexión

### 3.3 Wizard de configuración
- [ ] Frontend: Pantalla de primer arranque (detectar que no hay config)
- [ ] Wizard paso 1: Seleccionar rol (servidor / cliente)
- [ ] Wizard paso 2 (servidor): Nombre del negocio, puerto
- [ ] Wizard paso 2 (cliente): IP del servidor, puerto
- [ ] Guardar configuración en archivo local
- [ ] Frontend: Settings para modificar configuración después

## Fase 4: Dashboard y Reportes

### 4.1 Reportes de ventas
- [ ] Comando Tauri: `get_daily_sales(date)` — total vendido y transacciones del día
- [ ] Comando Tauri: `get_sales_by_range(from, to)` — ventas en rango de fechas
- [ ] Comando Tauri: `get_top_products(from, to, limit)` — más vendidos
- [ ] Frontend: Dashboard con tarjetas resumen (ventas del día, transacciones)
- [ ] Frontend: Tabla de ventas con filtro por fecha
- [ ] Frontend: Gráfico o lista de productos más vendidos

### 4.2 Corte de caja
- [ ] Comando Tauri: `create_cash_cut(actual_cash, notes)` — calcula esperado vs real
- [ ] Comando Tauri: `get_cash_cuts(from, to)` — historial de cortes
- [ ] Frontend: Pantalla de corte de caja (muestra ventas desde último corte, pide conteo real)
- [ ] Frontend: Historial de cortes anteriores

### 4.3 Inventario
- [ ] Frontend: Reporte de inventario actual con filtro por stock bajo
- [ ] Frontend: Historial de ajustes de inventario

## Fase 5: Pulido y Distribución

### 5.1 UX y atajos
- [ ] F6-F12: Asignar funciones futuras (descuentos, báscula manual, abrir cajón, reimprimir último ticket, etc.)
- [ ] Sonido/feedback visual al escanear producto exitosamente
- [ ] Manejo de errores con toasts/notificaciones claras
- [ ] Indicador visual del cliente asignado a la venta actual

### 5.2 Backup
- [ ] Módulo Rust: copia del archivo SQLite cada N horas (configurable)
- [ ] Guardar últimos N backups, rotar los antiguos
- [ ] Comando Tauri: `create_backup()` — backup manual
- [ ] Frontend: Configuración de backup (intervalo, ruta destino)

### 5.3 Empaquetado
- [ ] Configurar Tauri para generar `.deb`
- [ ] Configurar Tauri para generar `.AppImage`
- [ ] Icono de aplicación
- [ ] Archivo .desktop para integración con el escritorio Linux
- [ ] Script de post-instalación (permisos para puertos serial/USB)
- [ ] Documentar proceso de instalación en README
