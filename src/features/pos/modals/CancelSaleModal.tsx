import { useState } from "react";
import { Modal } from "@/shared/ui/Modal";

interface CancelSaleModalProps {
  show: boolean;
  saleId: number | null;
  onConfirm: (saleId: number, reason: string) => void;
  onClose: () => void;
}

export function CancelSaleModal({ show, saleId, onConfirm, onClose }: CancelSaleModalProps) {
  const [reason, setReason] = useState("");

  if (!show || !saleId) return null;

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(saleId, reason.trim());
      setReason("");
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-2">Anular Venta #{saleId}</h2>
      <p className="text-sm text-muted-foreground mb-4">Esta acción restaurará el stock de los productos vendidos.</p>
      <input
        type="text"
        placeholder="Motivo de la anulación *"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) handleConfirm(); }}
        className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-3"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={!reason.trim()}
          className="flex-1 py-3 rounded-md bg-destructive text-white font-bold hover:bg-destructive/90 disabled:opacity-50 transition-colors"
        >
          Anular venta
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-md bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
