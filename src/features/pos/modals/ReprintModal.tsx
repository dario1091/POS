import { useState } from "react";
import { Modal } from "@/shared/ui/Modal";
import { api } from "@/lib/api";

interface ReprintSale {
  id: number;
  total: number;
  created_at: string;
  payment_method: string;
}

interface ReprintModalProps {
  show: boolean;
  sales: ReprintSale[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export function ReprintModal({ show, sales, onSuccess, onError, onClose }: ReprintModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!show) return null;

  const handleReprint = (saleId: number) => {
    api.printTicket(saleId)
      .then(() => onSuccess(`Ticket #${saleId} enviado a imprimir`))
      .catch((err) => onError(String(err)));
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-4">Reimprimir Ticket</h2>
      {sales.length === 0 ? (
        <p className="text-muted-foreground">No hay ventas hoy</p>
      ) : (
        <div
          className="max-h-72 overflow-auto space-y-1"
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((prev) => (prev <= 0 ? sales.length - 1 : prev - 1));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((prev) => (prev >= sales.length - 1 ? 0 : prev + 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const sale = sales[selectedIndex];
              if (sale) handleReprint(sale.id);
            }
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          {sales.map((sale, i) => (
            <div
              key={sale.id}
              onClick={() => handleReprint(sale.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                i === selectedIndex
                  ? "bg-primary/20 border border-primary"
                  : "hover:bg-accent"
              }`}
            >
              <div>
                <span className="text-sm font-medium text-foreground">Ticket #{sale.id}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {sale.created_at.split(" ")[1] || sale.created_at}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-foreground">${sale.total.toFixed(2)}</span>
                <span className={`text-xs ml-2 ${
                  sale.payment_method === "efectivo" ? "text-success" :
                  sale.payment_method === "tarjeta" ? "text-primary" : "text-warning"
                }`}>
                  {sale.payment_method}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">↑↓ para navegar | Enter para reimprimir | Escape para cerrar</p>
    </Modal>
  );
}
