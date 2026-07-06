import { useState } from "react";
import { Modal } from "@/shared/ui/Modal";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";

interface CreditPayModalProps {
  show: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export function CreditPayModal({ show, onSuccess, onError, onClose }: CreditPayModalProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | "transferencia">("efectivo");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);

  if (!show) return null;

  const handleSearch = (query: string) => {
    setSearch(query);
    if (query.length >= 2) {
      api.searchCustomers(query).then(setResults).catch(() => {});
    } else {
      setResults([]);
    }
  };

  const handleConfirm = () => {
    if (customer && amount) {
      api.createCreditPayment(customer.id, parseFloat(amount), paymentMethod, null)
        .then((r) => {
          onSuccess(`✅ Abono de $${r.amount.toFixed(2)} (${paymentMethod}) registrado. Nueva deuda: $${r.new_balance.toFixed(2)}`);
          onClose();
        })
        .catch((err) => onError(String(err)));
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-4">Abono a Crédito</h2>
      {!customer ? (
        <div>
          <input
            id="credit-pay-search"
            type="text"
            placeholder="Buscar cliente por nombre o teléfono..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <div className="max-h-40 overflow-auto space-y-1">
            {results.filter(c => c.credit_balance > 0).map((c) => (
              <button
                key={c.id}
                onClick={() => setCustomer(c)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors flex justify-between"
              >
                <span className="text-foreground">{c.name}</span>
                <span className="text-warning font-mono">Deuda: ${c.credit_balance.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-md bg-secondary/50">
            <p className="text-sm text-foreground font-medium">{customer.name}</p>
            <p className="text-lg font-bold text-warning font-mono">Deuda: ${customer.credit_balance.toFixed(2)}</p>
          </div>
          <input
            type="number"
            step="0.01"
            placeholder="Monto del abono"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && amount) handleConfirm(); }}
            className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-xl font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {/* Payment method selector */}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Método de pago</label>
            <div className="flex gap-1">
              {(["efectivo", "tarjeta", "transferencia"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                    paymentMethod === method
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {method === "efectivo" ? "Efectivo" : method === "tarjeta" ? "Tarjeta" : "Transferencia"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleConfirm}
            className="w-full py-3 rounded-md bg-success text-white font-bold hover:bg-success/90 transition-colors"
          >
            Registrar abono
          </button>
          <button
            onClick={() => setCustomer(null)}
            className="w-full py-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            ← Buscar otro cliente
          </button>
        </div>
      )}
    </Modal>
  );
}
