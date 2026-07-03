# POS System — Requirements

## Descripción General

Sistema de Punto de Venta (POS) de escritorio nativo para Linux. Aplicación instalable construida con Tauri v2 y Rust puro como backend, React + TypeScript como frontend. Diseñado para operar en red local (LAN) sin internet, con soporte para 1-2 máquinas (servidor + cliente).

## Arquitectura de Despliegue

- **Mismo binario** para servidor y cliente. Se configura el rol al instalar/primer arranque.
- **Máquina servidor**: Contiene la base de datos SQLite, expone API HTTP interna por LAN (Axum embebido), maneja hardware local.
- **Máquina cliente**: Se conecta al servidor por LAN (IP configurada), maneja su propio hardware local (impresora, cajón).
- **Sin internet**: Todo opera en red local.

## Módulos Funcionales

### M1 — Autenticación y Usuarios

- Login con usuario y contraseña (hash bcrypt/argon2).
- Roles: `admin` y `cajero`.
- El `admin` accede a POS + Dashboard administrativo.
- El `cajero` solo accede a la pantalla de POS.
- CRUD de usuarios (solo admin).
- Sesión activa por máquina.

### M2 — Inventario / Productos

- CRUD de productos con campos: nombre, código de barras, precio venta, precio costo, stock actual, unidad de medida (pieza/kg), categoría, activo/inactivo.
- Categorías de productos (CRUD).
- Búsqueda por nombre o código de barras.
- Productos por peso (integración con báscula): unidad = kg, el precio se calcula al pesar.
- Ajustes de inventario manuales (entrada/salida de stock con motivo).
- Alertas de stock bajo (umbral configurable por producto).

### M3 — Clientes

- CRUD de clientes: nombre, teléfono, email (opcional), dirección (opcional).
- Historial de compras por cliente.
- Búsqueda rápida por nombre o teléfono.
- Cliente genérico "Público en general" por defecto para ventas sin cliente asignado.

### M4 — Punto de Venta (Pantalla de Cobro)

#### Layout
- Pantalla limpia y minimalista.
- **Input de comandos en la parte inferior** — es el centro de toda la interacción.
- **Lista de productos agregados** en la parte superior/central (tabla con: #, nombre, cantidad, precio unitario, subtotal).
- **Total visible** en todo momento (esquina inferior derecha o similar).
- **Sin botones visibles** para las acciones principales — todo se controla por teclado.

#### Input de comandos (Command Bar)
El input inferior es el punto de entrada para TODA la operación del POS. Acepta:

| Input | Acción |
|-------|--------|
| `{código de barras}` | Busca producto por barcode o referencia numérica. Si existe, lo agrega con cantidad 1. |
| `{número de referencia}` | Busca producto por ID autoincremental. Si existe, lo agrega con cantidad 1. |
| `N*{código}` | Agrega N unidades del producto. Ej: `3*7501234567890` = 3 unidades. |
| `pv{código}` | Consulta precio de venta. Muestra modal pequeño con el precio. NO agrega al carrito. |
| `pv%nombre%` | Busca productos por nombre parcial. Muestra modal con ocurrencias encontradas (nombre + precio). |

- Después de cada acción el input se limpia automáticamente y mantiene el focus.
- El lector de códigos de barras "escribe" directamente en este input.
- Si el producto no se encuentra, mostrar mensaje de error breve (toast) y mantener focus en el input.

#### Navegación por teclado (modo selección)
- **Flechas ↑↓**: Navegar entre los productos de la lista (resaltar fila seleccionada).
- La navegación se activa cuando hay productos en la lista y el input está vacío.
- Al escribir en el input se desactiva el modo navegación y vuelve al modo comando.

#### Teclas de función

| Tecla | Acción |
|-------|--------|
| **F1** | Cobrar en efectivo → Modal: monto recibido → calcula cambio → confirma → guarda + imprime + abre cajón |
| **F2** | Cobrar otros medios (TC, TD, transferencia) → Modal: seleccionar medio → confirma → guarda + imprime |
| **F3** | Eliminar producto seleccionado de la lista (el que está resaltado con ↑↓) |
| **F4** | Cancelar venta completa (limpiar carrito, pedir confirmación) |
| **F5** | Buscar/asignar cliente a la venta → Modal de búsqueda de cliente |
| **F6-F12** | Reservadas para funciones futuras (descuentos, báscula manual, abrir cajón, reimprimir, etc.) |

#### Flujo de venta típico
```
1. Cajero en pantalla POS, cursor en input
2. Escanea productos (input recibe barcode → producto aparece en lista)
3. Si necesita cantidad: escribe "3*{código}" → 3 unidades
4. Si necesita consultar precio: "pv{código}" → ve modal, cierra, sigue
5. Cuando termina: presiona F1 (efectivo)
6. Modal pide monto recibido → Enter → muestra cambio → Enter confirma
7. Venta guardada, ticket impreso, cajón abierto, lista limpia
8. Input listo para siguiente venta
```

#### Reglas de UX
- El input SIEMPRE tiene focus excepto cuando hay un modal abierto.
- Los modales se cierran con Escape.
- Después de cerrar un modal, el focus vuelve al input.
- Cero dependencia del mouse para el flujo de venta.
- Los productos por peso (báscula) se integrarán en Fase 2.

### M5 — Hardware

#### Impresora térmica 80mm (ESC/POS)
- Imprimir ticket de venta con: nombre del negocio, fecha/hora, items (nombre, cantidad, precio), subtotal, descuento, total, método de pago, cambio.
- Configuración: puerto USB/ruta del dispositivo.
- Cada máquina imprime en su impresora local.

#### Cajón de dinero
- Apertura automática al confirmar venta en efectivo.
- Apertura manual desde botón (solo admin/cajero autorizado).
- Se activa por comando a través de la impresora (estándar industria).

#### Báscula (serial RS-232 / USB-Serial)
- Lectura de peso en tiempo real mientras se está en modo "producto por peso".
- Configuración: puerto serial, baud rate.
- Protocolo genérico (lectura continua del peso como string numérico).

#### Lector de código de barras
- Funciona como input de teclado (HID). No requiere driver ni configuración especial.
- El campo de búsqueda de producto en POS recibe el código automáticamente.

### M6 — Reportes Básicos (Dashboard Admin)

- Ventas del día: total vendido, número de transacciones.
- Ventas por rango de fecha.
- Productos más vendidos.
- Inventario actual (stock bajo resaltado).
- Corte de caja: resumen de ventas, efectivo esperado vs real (cierre manual).

## Requisitos No Funcionales

### Rendimiento
- Tiempo de arranque de la app: < 3 segundos.
- Búsqueda de producto por código de barras: < 100ms.
- Registro de venta (guardar + imprimir): < 500ms.
- Lectura de báscula: latencia < 200ms.

### Instalación
- Binario distribuible como `.deb` o `.AppImage` para Linux.
- Primer arranque: wizard de configuración (rol servidor/cliente, IP del servidor si es cliente, datos del negocio).
- Creación automática de la BD SQLite en primer arranque (servidor).

### Seguridad
- Contraseñas hasheadas (argon2).
- Sin acceso remoto fuera de la LAN.
- API interna sin autenticación por token (red confiable LAN), pero protegida por IP whitelist configurable.

### Resiliencia
- Si la máquina cliente pierde conexión LAN con el servidor, mostrar error claro y no permitir ventas (la BD está solo en el servidor).
- Backup automático de SQLite (copia del archivo .db cada X horas, configurable).

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| App nativa | Tauri v2 |
| Frontend | React 18+ / TypeScript / Vite / shadcn/ui / Tailwind CSS |
| Backend (Tauri commands) | Rust |
| Base de datos | SQLite (via rusqlite o sqlx) |
| API LAN (servidor) | Axum (embebido en el proceso Tauri del servidor) |
| Hardware - Impresora | escpos-rs o comandos ESC/POS raw via USB |
| Hardware - Báscula | serialport-rs (crate de Rust para puertos seriales) |
| Hardware - Cajón | Comando ESC/POS via impresora |
| Build/Package | cargo-tauri, dpkg para .deb |

## Fases de Implementación

### Fase 1 — Fundación (MVP mínimo)
- Setup proyecto Tauri + React + SQLite
- Esquema de BD (migraciones)
- Login y usuarios (admin/cajero)
- CRUD productos e inventario
- Pantalla de POS: buscar producto, carrito, cobrar, guardar venta
- Una sola máquina (modo servidor, sin LAN aún)

### Fase 2 — Hardware
- Integración impresora ESC/POS (ticket de venta)
- Cajón de dinero
- Báscula (lectura de peso)

### Fase 3 — Multi-máquina
- API HTTP con Axum para exponer datos al cliente LAN
- Modo cliente: conectar a servidor por IP
- Impresión local en máquina cliente

### Fase 4 — Dashboard y Reportes
- Ventas del día / rango
- Productos más vendidos
- Corte de caja
- Alertas stock bajo

### Fase 5 — Pulido
- Wizard de primer arranque
- Backup automático
- Empaquetado .deb / .AppImage
- Atajos de teclado para operación rápida del POS
