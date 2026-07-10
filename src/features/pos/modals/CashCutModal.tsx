import { Modal } from "@/shared/ui/Modal";

interface CashCutData {
  total_sales: number; transactions: number; cash_total: number; card_total: number;
  transfer_total: number; credit_total: number; deliveries_total: number;
  deliveries_count: number; supplier_payments_total: number; supplier_payments_count: number;
  supplier_payments: { supplier_name: string; amount: number; created_at: string }[];
  cash_in_register: number; date: string;
}

interface CashCutModalProps {
  show: boolean;
  data: CashCutData | null;
  mode: "preview" | "reprint";
  onConfirm: () => void;
  onClose: () => void;
}

export function CashCutModal({ show, data, mode, onConfirm, onClose }: CashCutModalProps) {
  if (!show || !data) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-1">
        {mode === "preview" ? "Vista previa — Cierre de Caja" : "Corte de Caja"}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">{data.date}</p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-secondary/50">
            <p className="text-xs text-muted-foreground">Ventas totales</p>
            <p className="text-lg font-bold font-mono text-foreground">${data.total_sales.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-md bg-secondary/50">
            <p className="text-xs text-muted-foreground">Transacciones</p>
            <p className="text-lg font-bold font-mono text-foreground">{data.transactions}</p>
          </div>
        </div>
        <div className="border-t border-border pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Efectivo:</span>
            <span className="font-mono text-success font-bold">${data.cash_total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tarjeta:</span>
            <span className="font-mono text-primary">${data.card_total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Transferencia:</span>
            <span className="font-mono text-warning">${data.transfer_total.toFixed(2)}</span>
          </div>
          {data.credit_total > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Crédito (fiado):</span>
              <span className="font-mono text-destructive">${data.credit_total.toFixed(2)}</span>
            </div>
          )}
        </div>
        {data.deliveries_count > 0 && (
          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entregas parciales ({data.deliveries_count}):</span>
              <span className="font-mono text-warning">-${data.deliveries_total.toFixed(2)}</span>
            </div>
          </div>
        )}
        {data.supplier_payments_count > 0 && (
          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pagos a proveedores ({data.supplier_payments_count}):</span>
              <span className="font-mono text-destructive">-${data.supplier_payments_total.toFixed(2)}</span>
            </div>
            {data.supplier_payments.map((sp, i) => (
              <div key={i} className="flex justify-between text-xs pl-3">
                <span className="text-muted-foreground">{sp.supplier_name}</span>
                <span className="font-mono text-muted-foreground">${sp.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-border pt-3">
          <div className="flex justify-between items-center">
            <span className="font-medium text-foreground">Efectivo en caja:</span>
            <span className="text-2xl font-bold font-mono text-success">${data.cash_in_register.toFixed(2)}</span>
          </div>
        </div>
      </div>
      {mode === "preview" && (
        <p className="text-xs text-muted-foreground mt-3 text-center italic">
          Solo vista previa — el corte no se ha registrado aún
        </p>
      )}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onConfirm}
          className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {mode === "preview" ? "Imprimir y registrar corte" : "Reimprimir ticket"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
