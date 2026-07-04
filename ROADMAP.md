# Roadmap — Implementaciones Futuras

## v0.5.0 — Estabilidad y operación

- [ ] Backup automático de la base de datos (cada X horas, rotación de archivos)
- [ ] Búsqueda inteligente en el input (sin necesidad de `pv%`)
- [ ] F10 — Reimprimir último ticket sin abrir modal
- [ ] Mejorar impresión de entrega parcial y cierre de caja
- [ ] Sonido/feedback al escanear producto exitosamente
- [ ] Indicador visual del modo de pago aceptado por el sistema (con/sin internet)

## v0.6.0 — Reportes avanzados

- [ ] Reportes de clientes morosos (quién debe, cuánto, hace cuánto)
- [ ] Historial de abonos por cliente
- [ ] Reporte de ganancias (precio venta - precio costo)
- [ ] Reporte de productos sin movimiento
- [ ] Exportar reportes a PDF o Excel
- [ ] Gráficos de ventas (diario, semanal, mensual)

## v0.7.0 — Productos y precios

- [ ] Descuentos por producto o por categoría (% o monto fijo)
- [ ] Promociones: 2x1, combos, precio por volumen
- [ ] Listas de precios (mayorista/minorista)
- [ ] Código de barras en el ticket (para devoluciones rápidas con escaneo)
- [ ] Importación masiva de productos desde CSV/Excel
- [ ] Productos favoritos / más vendidos como acceso rápido

## v0.8.0 — Multi-máquina y red

- [ ] Autenticación en el servidor LAN (JWT/token)
- [ ] Sincronización offline (la caja cliente sigue vendiendo si pierde conexión)
- [ ] Descubrimiento automático del servidor en la red (mDNS/Zeroconf)
- [ ] Panel de administración web accesible desde cualquier dispositivo en la LAN

## v0.9.0 — Hardware avanzado

- [ ] Pantalla de cliente (segundo display con total y productos)
- [ ] Lector de tarjetas integrado (datáfono)
- [ ] Gaveta inteligente (detectar apertura no autorizada)
- [ ] Soporte para múltiples impresoras (cocina, bar)
- [ ] Código QR en ticket para encuestas de satisfacción

## v1.0.0 — Producción completa

- [ ] Wizard de primer arranque (configuración guiada)
- [ ] Tema claro/oscuro configurable
- [ ] Personalización del ticket (logo, mensajes, tamaño)
- [ ] Sistema de permisos granular (qué puede hacer cada cajero)
- [ ] Logs de auditoría (quién hizo qué, cuándo)
- [ ] Notificaciones automáticas de stock bajo
- [ ] Soporte para múltiples monedas

## Ideas a largo plazo

- [ ] App móvil para consultar ventas y stock en tiempo real
- [ ] Integración con facturación electrónica (DIAN Colombia)
- [ ] Programa de fidelización (puntos por compra)
- [ ] Integración con proveedores (pedidos automáticos al llegar a stock mínimo)
- [ ] Módulo de nómina básica (horas trabajadas por cajero)
- [ ] Cámaras: vincular foto de la transacción con la venta
