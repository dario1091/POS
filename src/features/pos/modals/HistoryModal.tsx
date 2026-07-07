import { useState } from "react";
import { Modal } from "@/shared/ui/Modal";

interface HistorySale {
  id: number;
  total: number;
  payment_method: string;
  items_count: number;
  cancelled: boolean;
  created_at: string;
}

interface HistoryModalProps {
  show: boolean;
  sales: HistorySale[];
  onCancelSale: (saleId: number) => void;
  onClose: () => void;
}

export function HistoryModal({ show, sales, onCancelSale, onClose }: HistoryModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!show) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-4">Ventas de Hoy</h2>
      {sales.length === 0 ? (
        <p className="text-muted-foreground">No hay ventas hoy</p>
      ) : (
        <div
          className="max-h-72 overflow-auto space-y-1"
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => { const next = p <= 0 ? sales.length - 1 : p - 1; document.getElementById(`history-item-${next}`)?.scrollIntoView({ block: "nearest" }); return next; }); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => { const next = p >= sales.length - 1 ? 0 : p + 1; document.getElementById(`history-item-${next}`)?.scrollIntoView({ block: "nearest" }); return next; }); }
            else if (e.key === "Enter") {
              e.preventDefault();
              const sale = sales[selectedIndex];
              if (sale && !sale.cancelled) onCancelSale(sale.id);
            }
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          {sales.map((sale, i) => (
            <div
              id={`history-item-${i}`}
              key={sale.id}
              className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                i === selectedIndex ? "bg-primary/20 border border-primary" : "hover:bg-accent"
              } ${sale.cancelled ? "opacity-50 line-through" : ""}`}
            >
              <div>
                <span className="text-sm font-medium text-foreground">#{sale.id}</span>
                <span className="text-xs text-muted-foreground ml-2">{sale.created_at.split(" ")[1] || sale.created_at}</span>
                <span className="text-xs text-muted-foreground ml-2">({sale.items_count} items)</span>
                {sale.cancelled && <span className="text-xs text-destructive ml-2">ANULADA</span>}
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-foreground">${sale.total.toFixed(2)}</span>
                <span className={`text-xs ml-2 ${
                  sale.payment_method === "efectivo" ? "text-success" :
                  sale.payment_method === "credito" ? "text-destructive" : "text-primary"
                }`}>{sale.payment_method}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">↑↓ navegar | Enter para anular | Escape cerrar</p>
    </Modal>
  );
}
