# Pago a Proveedores desde Caja — Tasks

## Fase 1: Backend

- [ ] Crear MIGRATION_002 con tabla `supplier_payments` e índices
- [ ] Crear struct `SupplierPayment` y `SupplierPaymentSummary`
- [ ] Implementar comando `create_supplier_payment` (validación + insert)
- [ ] Modificar `QuickCashCutResult` para incluir `supplier_payments_total`, `supplier_payments_count`, `supplier_payments`
- [ ] Modificar `quick_cash_cut` para consultar `supplier_payments` del período y restar del efectivo en caja
- [ ] Registrar comando en `lib.rs`

## Fase 2: Frontend — Modal y comando

- [ ] Crear `SupplierPaymentModal.tsx` (monto + nombre proveedor + notas opcionales)
- [ ] Exportar modal en `modals/index.ts`
- [ ] Agregar función `createSupplierPayment` en `api.ts` (invoke Tauri)
- [ ] Agregar regex `PP` / `PP{monto}` en `useCommands.ts`
- [ ] Agregar estado y handlers del modal en `features/pos/index.tsx`

## Fase 3: Frontend — Cierre de Caja

- [ ] Actualizar interface `CashCutData` con los nuevos campos
- [ ] Agregar sección "Pagos a proveedores" en `CashCutModal.tsx` con desglose individual
- [ ] Actualizar `HelpModal.tsx` para documentar comando PP

## Fase 4: Validación

- [ ] Probar flujo completo: PP → modal → registrar → CC muestra pago
- [ ] Verificar que `cash_in_register` descuenta correctamente entregas + pagos proveedores
- [ ] Verificar que el flujo EP existente sigue funcionando sin cambios
