import { Modal } from "@/shared/ui/Modal";
import type { Customer, CartItem } from "@/lib/types";

interface CustomerModalProps {
  show: boolean;
  customer: Customer | null;
  customerSearch: string;
  customerResults: Customer[];
  cart: CartItem[];
  total: number;
  onSearchChange: (query: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  onRemoveCustomer: () => void;
  onFiarVenta: () => void;
  onClose: () => void;
}

export function CustomerModal({
  show, customer, customerSearch, customerResults, cart, total,
  onSearchChange, onSelectCustomer, onRemoveCustomer, onFiarVenta, onClose,
}: CustomerModalProps) {
  if (!show) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-4">Asignar Cliente</h2>
      <input
        id="customer-search"
        type="text"
        placeholder="Buscar por nombre o teléfono..."
        value={customerSearch}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
      <div className="max-h-48 overflow-auto space-y-1">
        {customerResults.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectCustomer(c)}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm text-foreground transition-colors"
          >
            <div className="flex justify-between items-center">
              <span>{c.name} {c.phone && <span className="text-muted-foreground">— {c.phone}</span>}</span>
              {c.credit_limit > 0 && (
                <span className="text-xs text-primary">
                  Crédito: ${(c.credit_limit - c.credit_balance).toFixed(0)} disp.
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {customer && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-sm text-foreground mb-2">
            Cliente: <strong>{customer.name}</strong>
            {customer.credit_limit > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                (Crédito: ${(customer.credit_limit - customer.credit_balance).toFixed(2)} disponible de ${customer.credit_limit.toFixed(2)})
              </span>
            )}
          </p>
          <div className="flex gap-2">
            {customer.credit_limit > 0 && cart.length > 0 && (
              <button
                onClick={onFiarVenta}
                className="flex-1 py-2 rounded-md text-sm bg-warning/20 text-warning font-medium hover:bg-warning/30 transition-colors"
              >
                Fiar venta (${total.toFixed(2)})
              </button>
            )}
            <button
              onClick={onRemoveCustomer}
              className="flex-1 py-2 rounded-md text-sm text-destructive hover:bg-accent transition-colors"
            >
              Quitar cliente
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
