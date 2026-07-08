# POS System

Sistema de Punto de Venta para supermercados. Aplicación de escritorio nativa para Linux.

## Características

- **Punto de venta rápido** — Command bar con atajos de teclado, sin depender del mouse
- **Múltiples ventas simultáneas** — Hasta 3 pestañas de venta (Ctrl+N)
- **Pagos flexibles** — Efectivo, tarjeta, transferencia, mixto, crédito (fiado)
- **Hardware** — Impresora térmica 80mm (ESC/POS), cajón de dinero, báscula serial, lector de barras
- **Etiquetas de precio** — Impresión de etiquetas personalizables con protocolo TSPL (vía libusb)
- **Inventario** — Productos con múltiples códigos de barras, categorías, stock, carga masiva CSV
- **Clientes** — Crédito con tope, abonos, historial
- **Operaciones** — Devoluciones, anulaciones, entregas parciales, cierre de caja
- **Seguridad** — Login con roles (admin/cajero), clave admin para operaciones sensibles
- **Backup automático** — Copia de la BD cada 4h (configurable), manual desde admin
- **Tema claro/oscuro** — Configurable desde el menú admin
- **Multi-máquina** — Servidor LAN para conectar varias cajas
- **Actualizaciones** — Desde la propia app con un click

## Instalación

### Desde release (recomendado)

```bash
wget https://github.com/dario1091/POS/releases/latest/download/pos-system_0.5.8_amd64.deb -O /tmp/pos.deb
sudo dpkg -i /tmp/pos.deb
sudo apt install libusb-1.0-0-dev
sudo usermod -a -G lp,dialout $USER
# Cerrar sesión y volver a entrar
```

### Compilar desde fuente

```bash
# Dependencias (Ubuntu/Mint)
sudo apt install -y build-essential curl libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev pkg-config libssl-dev libudev-dev \
  libusb-1.0-0-dev

# Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# Compilar
npm install
npm run tauri build
sudo dpkg -i src-tauri/target/release/bundle/deb/pos-system_*.deb
```

## Primer arranque

1. Abrir "pos-system" desde el menú de aplicaciones
2. Login: `admin` / `admin123`
3. Ir a Menú → Hardware → Configurar impresora
4. Ir a Menú → Inventario → Cargar CSV (para carga masiva de productos)

### Productos por defecto (IDs 1-6)

| ID | Producto | Tipo |
|----|----------|------|
| 1 | Bolsa pequeña | Precio fijo |
| 2 | Bolsa grande | Precio fijo |
| 3 | Frutas y Verduras | Pide monto |
| 4 | Carnes | Pide monto |
| 5 | Pollo | Pide monto |
| 6 | Pescados | Pide monto |

## Atajos de teclado (POS)

| Tecla | Acción |
|-------|--------|
| `{código}` | Agregar producto |
| `3*{código}` | Agregar 3 unidades |
| `$8500*{código}` | Agregar con precio manual (solo sube, no baja) |
| `500` + F1 | Cobrar $500 en efectivo |
| `500` + F2 | Cobrar $500 con tarjeta |
| F1 | Cobrar efectivo (modal) |
| F2 | Cobrar otro medio (modal) |
| F3 | Eliminar producto seleccionado |
| F4 | Cancelar venta (con confirmación) |
| F5 | Buscar/asignar cliente |
| F6 | Modo devolución |
| F7 | Abrir cajón de dinero |
| F8 | Historial de ventas del día |
| F9 | Reimprimir ticket |
| F12 | Guía rápida |
| Ctrl+N | Nueva pestaña de venta (máx 3) |
| Ctrl+1/2/3 | Cambiar pestaña |
| ↑↓ | Navegar lista de productos |

## Comandos en el input

| Comando | Acción |
|---------|--------|
| `pv{código}` | Consultar precio |
| `pv nombre` | Buscar por nombre |
| `CC` | Cierre de caja (desde último corte) |
| `EP` | Entrega parcial de efectivo |
| `EP5000` | Entrega de $5000 (monto directo) |
| `AB` | Abono a crédito |
| `AN5` | Anular venta #5 |

## Pagos

- **Pago rápido**: monto + F1 (efectivo) o monto + F2 (tarjeta)
- **Pagos parciales**: se pueden acumular (300+F1 → 200+F2 = pago mixto)
- **Crédito (fiado)**: F5 → seleccionar cliente → "Fiar venta"
- **Después de cobrar**: modal pregunta si imprimir ticket (No por defecto, Tab → Sí)

## Carga masiva de productos (CSV)

Menú → Inventario → **Cargar CSV**

Formato del archivo:
```
código_barras,nombre,precio_venta,precio_costo,stock,categoría,unidad,tipo_precio
7702004003478,Aceite Girasol 1L,12500,9800,24,Víveres,pieza,fijo
```

- Solo **nombre** y **precio_venta** son obligatorios
- **unidad**: `pieza` | `kg`
- **tipo_precio**: `fijo` | `bascula` | `monto`
- **categoría**: si no existe se crea automáticamente
- Valida barcodes duplicados antes de importar
- ⚠️ En Excel: formatear columna código_barras como Número (0 decimales)

## Etiquetas de precio

Menú → **Etiquetas**

- Editor de líneas: texto, tamaño, alineación, negrita
- Buscar producto → auto-llena nombre y precio
- Código de barras opcional (Code 128)
- Copias configurables (1-100)
- Protocolo TSPL/TSPL2 vía libusb (compatible con 4BARCODE, DigitalPos DIG-T451B y similares)

## Actualización

Desde la app: **Menú → Hardware → Buscar actualizaciones**

O por terminal:
```bash
wget https://github.com/dario1091/POS/releases/latest/download/pos-system_0.5.8_amd64.deb -O /tmp/pos.deb
sudo dpkg -i /tmp/pos.deb
```

## Stack técnico

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Vite 7
- **Backend**: Rust (Tauri v2)
- **Base de datos**: SQLite (rusqlite + r2d2 pool)
- **Hardware**: ESC/POS (impresora tickets), TSPL (impresora etiquetas), serialport (báscula), libusb
- **CI/CD**: GitHub Actions → `.deb` automático en cada release

## Requisitos mínimos

- CPU: cualquier x86_64 (Intel/AMD 64-bit)
- RAM: 2 GB (recomendado 4 GB)
- SO: Linux con GUI (Ubuntu 22.04+, Linux Mint 21+, Debian 12+)
- Disco: 1 GB libre (SSD recomendado)
- Dependencias: `libusb-1.0-0-dev` (para impresora de etiquetas)

## Licencia

Uso privado.
