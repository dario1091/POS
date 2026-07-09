import { Modal } from "@/shared/ui/Modal";

interface SupplierPaymentModalProps {
  show: boolean;
  amount: string;
  supplierName: string;
  onAmountChange: (value: string) => void;
  onSupplierNameChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function SupplierPaymentModal({
  show,
  amount,
  supplierName,
  onAmountChange,
  onSupplierNameChange,
  onConfirm,
  onClose,
}: SupplierPaymentModalProps) {
  if (!show) return null;

  const canConfirm = !!amount && parseFloat(amount) > 0 && supplierName.trim().length > 0;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-4">Pago a Proveedor</h2>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Monto pagado</label>
          <input
            id="supplier-payment-amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="$0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const supplierInput = document.getElementById("supplier-payment-name");
                supplierInput?.focus();
              }
            }}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Nombre del proveedor</label>
          <input
            id="supplier-payment-name"
            type="text"
            placeholder="Ej: Distribuidora López"
            value={supplierName}
            onChange={(e) => onSupplierNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm) onConfirm();
            }}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="w-full py-3 rounded-md bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Registrar pago
        </button>
      </div>
    </Modal>
  );
}
