import { Modal } from "@/shared/ui/Modal";

interface DeliveryModalProps {
  show: boolean;
  amount: string;
  supervisor: string;
  onAmountChange: (value: string) => void;
  onSupervisorChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeliveryModal({ show, amount, supervisor, onAmountChange, onSupervisorChange, onConfirm, onClose }: DeliveryModalProps) {
  if (!show) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-4">Entrega Parcial de Efectivo</h2>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Monto a entregar</label>
          <input
            id="delivery-amount"
            type="number"
            step="0.01"
            placeholder="$0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Nombre del supervisor</label>
          <input
            type="text"
            placeholder="Nombre de quien recibe"
            value={supervisor}
            onChange={(e) => onSupervisorChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && amount) onConfirm(); }}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-md bg-warning text-white font-bold hover:bg-warning/90 transition-colors"
        >
          Registrar entrega e imprimir
        </button>
      </div>
    </Modal>
  );
}
