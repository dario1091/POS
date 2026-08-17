# POS System

Sistema de Punto de Venta para supermercados. Aplicación de escritorio nativa para Linux (Debian/Ubuntu y Fedora).

## Características

- **Punto de venta rápido** — Command bar con atajos de teclado, sin depender del mouse
- **Múltiples ventas simultáneas** — Hasta 3 pestañas de venta (Ctrl+N)
- **Pagos flexibles** — Efectivo, tarjeta, transferencia, mixto, crédito (fiado)
- **Productos de báscula** — Ingreso por gramos con cálculo automático de precio (precio/kg), override manual
- **Hardware** — Impresora térmica 80mm (ESC/POS), cajón de dinero, báscula serial, lector de barras
- **Etiquetas de precio** — Tamaño configurable (mm), ancho de barcode ajustable, presets, sensor BLINE/GAP
- **Inventario** — Productos con múltiples códigos de barras, categorías, stock, carga masiva CSV
- **Clientes** — Crédito con tope, abonos, historial
- **Operaciones** — Devoluciones, anulaciones, entregas parciales, pagos a proveedor, cierre de caja
- **Seguridad** — Login con roles (admin/cajero), clave admin para EP, PP, cancelar venta, devoluciones, anulaciones, ajustes de inventario
- **Cierre de caja** — Ventas por método, entregas, proveedores, devoluciones, abonos a crédito en efectivo, ventas anuladas
- **Backup automático** — Copia de la BD cada 4h (configurable), manual desde admin, copiar al escritorio
- **Tema claro/oscuro** — Configurable desde el menú admin
- **Multi-máquina** — Servidor LAN para conectar varias cajas
- **Actualizaciones** — Desde la propia app (detecta distro), o con script `pos-update`
- **Búsqueda inteligente** — `#ref` por ID, numérico por barcode, texto por nombre (en productos, inventario y etiquetas)

## Instalación

### Debian/Ubuntu/Linux Mint

```bash
curl -LO https://github.com/dario1091/POS/releases/latest/download/pos-system_0.7.7_amd64.deb
sudo apt install ./pos-system_0.7.7_amd64.deb
sudo usermod -a -G lp,dialout $USER
# Cerrar sesión y volver a entrar
```

### Fedora

```bash
curl -LO https://github.com/dario1091/POS/releases/latest/download/pos-system-0.7.7-1.x86_64.rpm
sudo dnf install ./pos-system-0.7.7-1.x86_64.rpm
sudo usermod -a -G lp,dialout $USER
# Cerrar sesión y volver a entrar
```

### Script de actualización automática

```bash
sudo curl -o /usr/local/bin/pos-update https://raw.githubusercontent.com/dario1091/POS/main/scripts/pos-update
sudo chmod +x /usr/local/bin/pos-update
```

Después solo ejecutas `pos-update` y detecta automáticamente si es Fedora (.rpm) o Debian (.deb).

### Compilar desde fuente

```bash
# Dependencias (Ubuntu/Mint)
sudo apt install -y build-essential curl libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev pkg-config libssl-dev libudev-dev \
  libusb-1.0-0-dev

# Dependencias (Fedora)
sudo dnf install -y gcc gcc-c++ make curl webkit2gtk4.1-devel gtk3-devel \
  libappindicator-gtk3-devel librsvg2-devel pkg-config openssl-devel systemd-devel

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# Compilar
npm install
npm run tauri build
# El .deb/.rpm queda en src-tauri/target/release/bundle/
```

## Primer arranque

1. Abrir "pos-system" desde el menú de aplicaciones
2. Login: `admin` / `admin123`
3. Ir a Menú → Hardware → Configurar impresora
4. Ir a Menú → Hardware → Configurar tipo de etiqueta (BLINE o GAP)
5. Ir a Menú → Inventario → Cargar CSV (para carga masiva de productos)

## Atajos de teclado (POS)

| Tecla | Acción |
|-------|--------|
| `{código}` | Agregar producto |
| `3*{código}` | Agregar 3 unidades |
| `8500**{código}` | Agregar con precio manual (solo sube, no baja) |
| `500` + F1 | Cobrar $500 en efectivo |
| `500` + F2 | Cobrar $500 con transferencia |
| F1 | Cobrar efectivo (modal) |
| F2 | Cobrar transferencia/otro medio (modal) |
| F3 | Eliminar producto seleccionado |
| F4 | Cancelar venta (requiere clave admin) |
| F5 | Buscar/asignar cliente |
| F6 | Modo devolución (requiere clave admin) |
| F7 | Abrir cajón de dinero |
| F8 | Historial de ventas del día |
| F9 | Reimprimir ticket |
| F12 | Guía rápida |
| Ctrl+N | Nueva pestaña de venta (máx 3) |
| Ctrl+1/2/3 | Cambiar pestaña |
| Ctrl+P | Volver al POS desde menú admin |
| ↑↓ | Navegar lista de productos |

## Comandos en el input

| Comando | Acción |
|---------|--------|
| `pv{código}` | Consultar precio |
| `pv nombre` | Buscar por nombre |
| `CC` | Cierre de caja (vista previa del día) |
| `CX2026-07-10` | Ver/reimprimir corte de una fecha |
| `EP` | Entrega parcial de efectivo (requiere admin) |
| `EP5000` | Entrega de $5000 (requiere admin) |
| `PP` | Pago a proveedor (requiere admin) |
| `PP5000` | Pago a proveedor de $5000 (requiere admin) |
| `AB` | Abono a crédito de cliente |
| `AN5` | Anular venta #5 (requiere admin) |

## Pagos

- **Pago rápido**: monto + F1 (efectivo) o monto + F2 (transferencia)
- **Pagos parciales**: se pueden acumular (300+F1 → 200+F2 = pago mixto)
- **Crédito (fiado)**: F5 → seleccionar cliente → "Fiar venta"
- **Vueltos**: se muestran en pantalla hasta la siguiente venta
- **Después de cobrar**: modal pregunta si imprimir ticket

## Tipos de producto

| Tipo | Comportamiento |
|------|---------------|
| `fijo` | Se agrega directo al carrito con su precio |
| `bascula` | Pide gramos, calcula precio ($/kg), permite override manual del total |
| `monto` | Pide monto libre al cajero (precio variable) |

## Búsqueda inteligente (Admin)

En productos, inventario y etiquetas:

| Input | Comportamiento |
|-------|---------------|
| `#1` | Busca producto con referencia (ID) 1 |
| `7702004003478` | Busca por código de barras |
| `aceite` | Busca por nombre |

## Carga masiva de productos (CSV)

Menú → Inventario → **Cargar CSV**

Formato del archivo:
```
código_barras,nombre,precio_venta,precio_costo,stock,categoría,unidad,tipo_precio
7702004003478,Aceite Girasol 1L,12500,9800,24,Víveres,pieza,fijo
,Queso campesino,32000,25000,10,Lácteos,kg,bascula
```

- Solo **nombre** y **precio_venta** son obligatorios
- **unidad**: `pieza` | `kg`
- **tipo_precio**: `fijo` | `bascula` | `monto`
- **categoría**: si no existe se crea automáticamente
- Valida barcodes duplicados antes de importar

## Etiquetas de precio

Menú → **Etiquetas**

- Tamaño de etiqueta configurable en mm (presets: 55×33, 40×25, 70×40, 50×25)
- Editor de líneas: texto, tamaño, alineación, negrita
- Buscar producto con `#ref | barcode | nombre` → auto-llena datos
- Navegación por teclado en resultados (↑↓ + Enter/Tab)
- Código de barras opcional (Code 128) con ancho ajustable (2-5)
- Copias configurables (1-100)
- Tipo de sensor: Marca negra (BLINE) o Gap transparente — configurable en Hardware
- Protocolo TSPL/TSPL2 vía libusb (compatible con 4BARCODE, DigitalPos y similares)

## Cierre de caja

El corte (`CC`) muestra:
- Ventas totales y transacciones
- Desglose por método de pago (efectivo, tarjeta, transferencia, crédito)
- Entregas parciales (restan)
- Pagos a proveedores (restan)
- Devoluciones (restan)
- Abonos a crédito en efectivo (suman)
- Ventas anuladas (informativo)
- **Efectivo esperado en caja** = ventas efectivo - entregas - proveedores - devoluciones + abonos

## Actualización

Desde la app: **Menú → Hardware → Buscar actualizaciones** (detecta si es .deb o .rpm)

O por terminal:
```bash
pos-update
```

## Stack técnico

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Vite 7
- **Backend**: Rust (Tauri v2)
- **Base de datos**: SQLite (rusqlite + r2d2 pool)
- **Hardware**: ESC/POS (impresora tickets), TSPL (impresora etiquetas), serialport (báscula), libusb
- **CI/CD**: GitHub Actions → `.deb` + `.rpm` automáticos en cada release

## Requisitos mínimos

- CPU: cualquier x86_64 (Intel/AMD 64-bit)
- RAM: 2 GB (recomendado 4 GB)
- SO: Ubuntu 22.04+, Linux Mint 21+, Debian 12+, Fedora 40+
- Disco: 1 GB libre (SSD recomendado)

## Licencia

Uso privado.
