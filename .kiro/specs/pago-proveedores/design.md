# Pago a Proveedores desde Caja — Design

## Modelo de Datos

### Nueva tabla: `supplier_payments`

```sql
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
```

**Justificación**: Tabla separada de `cash_deliveries` para mantener separación de conceptos. Las entregas parciales van a un supervisor (dueño), los pagos a proveedores van a un proveedor externo. Queries independientes, sin riesgo de romper flujo EP existente.

## Backend (Rust)

### Nuevo comando: `create_supplier_payment`

**Archivo**: `src-tauri/src/commands/reports.rs`

```rust
#[tauri::command]
pub fn create_supplier_payment(
    amount: f64,
    supplier_name: String,
    notes: Option<String>,
    state: State<'_, AppState>,
) -> Result<SupplierPayment, String>
```

- Valida amount > 0 y supplier_name no vacío.
- Inserta en `supplier_payments`.
- Retorna el registro creado.

### Modificación: `quick_cash_cut`

Agregar al resultado:
- `supplier_payments_total: f64` — suma de pagos a proveedores del período
- `supplier_payments_count: i64` — cantidad de pagos
- `supplier_payments: Vec<SupplierPaymentSummary>` — desglose individual (supplier_name, amount)

Actualizar cálculo:
```
cash_in_register = cash_total - deliveries_total - supplier_payments_total
```

### Nueva struct de respuesta

```rust
#[derive(Debug, Serialize)]
pub struct SupplierPayment {
    pub id: i64,
    pub user_id: i64,
    pub amount: f64,
    pub supplier_name: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct SupplierPaymentSummary {
    pub supplier_name: String,
    pub amount: f64,
    pub created_at: String,
}
```

### Migración

Nueva migración `MIGRATION_002` en `src-tauri/src/db/migrations.rs`.

## Frontend (React + TypeScript)

### Nuevo componente: `SupplierPaymentModal`

**Archivo**: `src/features/pos/modals/SupplierPaymentModal.tsx`

- Campos: monto (autofocus) + nombre proveedor
- Botón: "Registrar pago" (sin mención de impresión)
- Enter en el campo de proveedor confirma si hay monto válido
- Mismo patrón visual que `DeliveryModal`

### Modificación: `useCommands.ts`

Agregar regex para comando `PP`:
```typescript
// PP or PP{monto} — Pago a proveedor
const ppMatch = trimmed.match(/^pp(\d+)?$/i);
if (ppMatch) {
  setCommand("");
  openSupplierPayment(ppMatch[1] || undefined);
  return;
}
```

### Modificación: `CashCutModal.tsx`

Agregar sección después de entregas parciales:
```
Pagos a proveedores (N): -$X.XX
  └ Proveedor 1: $monto
  └ Proveedor 2: $monto
```

### Modificación: Interface `CashCutData`

Agregar campos:
```typescript
supplier_payments_total: number;
supplier_payments_count: number;
supplier_payments: { supplier_name: string; amount: number; created_at: string }[];
```

## Flujo de Interacción

```
Cajera escribe "PP" (o "PP5000")
       ↓
Modal se abre (con monto pre-llenado si se pasó)
       ↓
Cajera llena monto + nombre proveedor
       ↓
Enter o click en "Registrar pago"
       ↓
Backend guarda en supplier_payments
       ↓
Modal se cierra, toast de confirmación
       ↓
(Más tarde) Cajera escribe "CC"
       ↓
CC muestra sección "Pagos a proveedores" con desglose
y el efectivo en caja ya descuenta esos pagos
```

## Impacto en Código Existente

| Archivo | Cambio |
|---------|--------|
| `src-tauri/src/db/migrations.rs` | Agregar MIGRATION_002 con CREATE TABLE |
| `src-tauri/src/commands/reports.rs` | Agregar `create_supplier_payment`, modificar `quick_cash_cut` |
| `src-tauri/src/lib.rs` | Registrar nuevo comando Tauri |
| `src/features/pos/modals/SupplierPaymentModal.tsx` | NUEVO |
| `src/features/pos/modals/index.ts` | Exportar nuevo modal |
| `src/features/pos/modals/CashCutModal.tsx` | Agregar sección proveedores |
| `src/features/pos/hooks/useCommands.ts` | Agregar regex PP |
| `src/features/pos/index.tsx` | Estado + handler del modal |
| `src/lib/api.ts` | Agregar función `createSupplierPayment` |
| `src/features/pos/modals/HelpModal.tsx` | Agregar PP a la guía de comandos |
