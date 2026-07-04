# POS System

Sistema de Punto de Venta para supermercados. Aplicación de escritorio nativa para Linux.

## Características

- **Punto de venta rápido** — Command bar con atajos de teclado, sin depender del mouse
- **Múltiples ventas simultáneas** — Hasta 3 pestañas de venta (Ctrl+N)
- **Pagos flexibles** — Efectivo, tarjeta, transferencia, mixto, crédito (fiado)
- **Hardware** — Impresora térmica 80mm (ESC/POS), cajón de dinero, báscula serial, lector de barras
- **Inventario** — Productos con múltiples códigos de barras, categorías, stock, alertas
- **Clientes** — Crédito con tope, abonos, historial
- **Operaciones** — Devoluciones, anulaciones, entregas parciales, cierre de caja
- **Seguridad** — Login con roles (admin/cajero), clave admin para operaciones sensibles
- **Multi-máquina** — Servidor LAN para conectar varias cajas
- **Actualizaciones** — Desde la propia app con un click

## Instalación

### Desde release (recomendado)

```bash
wget https://github.com/dario1091/POS/releases/latest/download/pos-system_0.4.0_amd64.deb -O /tmp/pos.deb
sudo dpkg -i /tmp/pos.deb
sudo usermod -a -G lp,dialout $USER
# Cerrar sesión y volver a entrar
```

### Compilar desde fuente

```bash
# Dependencias (Ubuntu/Mint)
sudo apt install -y build-essential curl libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev pkg-config libssl-dev libudev-dev

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
4. Ir a Menú → Productos → Cargar inventario

## Atajos de teclado (POS)

| Tecla | Acción |
|-------|--------|
| `{código}` | Agregar producto |
| `3*{código}` | Agregar 3 unidades |
| `$8500*{código}` | Agregar con precio manual |
| `500` + F1 | Cobrar $500 en efectivo |
| `500` + F2 | Cobrar $500 con tarjeta |
| F1 | Cobrar efectivo (modal) |
| F2 | Cobrar otro medio (modal) |
| F3 | Eliminar producto seleccionado |
| F4 | Cancelar venta |
| F5 | Buscar/asignar cliente |
| F6 | Modo devolución |
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
| `pv%nombre%` | Buscar por nombre |
| `CC` | Cierre de caja |
| `EP` | Entrega parcial de efectivo |
| `AB` | Abono a crédito |
| `AN5` | Anular venta #5 |

## Actualización

Desde la app: **Menú → Hardware → Buscar actualizaciones**

O por terminal:
```bash
wget https://github.com/dario1091/POS/releases/latest/download/pos-system_*_amd64.deb -O /tmp/pos.deb
sudo dpkg -i /tmp/pos.deb
```

## Stack técnico

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Rust (Tauri v2)
- **Base de datos**: SQLite (migraciones automáticas)
- **Hardware**: ESC/POS (impresora), serialport (báscula)
- **CI/CD**: GitHub Actions → `.deb` automático en cada release

## Requisitos mínimos

- CPU: cualquier x86_64 (Intel/AMD 64-bit)
- RAM: 2 GB (recomendado 4 GB)
- SO: Linux con GUI (Ubuntu 22.04+, Linux Mint 21+, Debian 12+)
- Disco: 1 GB libre (SSD recomendado)

## Licencia

Uso privado.
