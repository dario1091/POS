# Pago a Proveedores desde Caja — Requirements

## Descripción

La cajera recibe facturas de proveedores y paga con efectivo directamente de la caja registradora. Necesita registrar cuánto pagó y a qué proveedor, para que al momento del Cierre de Caja (CC) se vea reflejado como salida de efectivo con desglose por proveedor.

## Contexto

Actualmente existen las **Entregas Parciales (EP)** que registran salidas de efectivo hacia un supervisor. Los pagos a proveedores son conceptualmente similares (salidas de efectivo) pero con destino diferente y sin necesidad de impresión.

## Requerimientos Funcionales

### RF1 — Registrar pago a proveedor

- La cajera puede registrar un pago ingresando:
  - **Monto** (obligatorio, mayor a 0)
  - **Nombre del proveedor** (obligatorio)
  - **Notas** (opcional — número de factura, descripción, etc.)
- El registro se almacena vinculado al usuario de sesión activa.
- NO imprime ticket ni comprobante.

### RF2 — Comando de acceso rápido

- Comando `PP` en el input del POS abre el modal de pago a proveedor.
- Comando `PP{monto}` abre el modal con el monto pre-llenado.
- Sigue la misma convención que `EP` / `EP{monto}`.

### RF3 — Reflejo en Cierre de Caja (CC)

- El reporte de CC muestra una sección dedicada: **"Pagos a proveedores"**.
- Muestra el total de pagos a proveedores del período y la cantidad de pagos.
- Muestra desglose individual: nombre del proveedor y monto de cada pago.
- Los pagos a proveedores se RESTAN del efectivo en caja, al igual que las entregas parciales.
- Fórmula actualizada: `cash_in_register = cash_total - deliveries_total - supplier_payments_total`

### RF4 — Sin impresión

- A diferencia de las Entregas Parciales, los pagos a proveedores NO imprimen.
- El modal NO tiene botón de imprimir ni funcionalidad de impresión.

## Requerimientos No Funcionales

### RNF1 — Consistencia con el flujo existente

- El modal debe seguir el mismo patrón visual que DeliveryModal.
- La interacción por teclado debe ser fluida (Tab entre campos, Enter para confirmar).

### RNF2 — Validación de datos

- El monto debe ser mayor a 0.
- El nombre del proveedor no puede estar vacío.
- Mostrar error claro si la validación falla.

### RNF3 — Rendimiento

- El query adicional en `quick_cash_cut` no debe degradar el tiempo de respuesta perceptiblemente.
