import { Modal } from "@/shared/ui/Modal";

interface PaymentModalProps {
  show: boolean;
  total: number;
  paymentMode: "efectivo" | "otro" | "mixto";
  cashAmount: string;
  otherMethod: "tarjeta" | "transferencia";
  otherAmount: string;
  paymentReference: string;
  onPaymentModeChange: (mode: "efectivo" | "otro" | "mixto") => void;
  onCashAmountChange: (value: string) => void;
  onOtherMethodChange: (method: "tarjeta" | "transferencia") => void;
  onOtherAmountChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function PaymentModal({
  show, total, paymentMode, cashAmount, otherMethod, otherAmount, paymentReference,
  onPaymentModeChange, onCashAmountChange, onOtherMethodChange, onOtherAmountChange,
  onPaymentReferenceChange, onConfirm, onClose,
}: PaymentModalProps) {
  if (!show) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-2">Cobrar Venta</h2>
      <p className="text-3xl font-bold text-foreground mb-4 font-mono">Total: ${total.toFixed(2)}</p>

      {/* Payment mode tabs */}
      <div className="flex gap-1 mb-4 bg-secondary/50 p-1 rounded-md">
        {([["efectivo", "Efectivo"], ["otro", "TC/TD/Transf"], ["mixto", "Mixto"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => onPaymentModeChange(mode)}
            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
              paymentMode === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {paymentMode === "efectivo" && (
        <div>
          <input
            id="payment-amount"
            type="number"
            step="0.01"
            placeholder="Monto recibido"
            value={cashAmount}
            onChange={(e) => onCashAmountChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }}
            className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-xl font-mono mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {cashAmount && parseFloat(cashAmount) >= total && (
            <p className="text-xl text-success font-bold font-mono mb-3">
              Cambio: ${(parseFloat(cashAmount) - total).toFixed(2)}
            </p>
          )}
        </div>
      )}

      {paymentMode === "otro" && (
        <div className="space-y-2 mb-3">
          {(["tarjeta", "transferencia"] as const).map((method) => (
            <button
              key={method}
              onClick={() => onOtherMethodChange(method)}
              className={`w-full py-3 rounded-md text-sm font-medium transition-colors ${
                otherMethod === method
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {method === "tarjeta" ? "Tarjeta (TC/TD)" : "Transferencia"}
            </button>
          ))}
          <input
            type="text"
            placeholder="# Referencia / Autorización (opcional)"
            value={paymentReference}
            onChange={(e) => onPaymentReferenceChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {paymentMode === "mixto" && (
        <div className="space-y-3 mb-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Efectivo</label>
            <input
              id="payment-amount"
              type="number"
              step="0.01"
              placeholder="$0.00"
              value={cashAmount}
              onChange={(e) => onCashAmountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Otro medio ({otherMethod})</label>
            <input
              type="number"
              step="0.01"
              placeholder="$0.00"
              value={otherAmount}
              onChange={(e) => onOtherAmountChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }}
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-1">
            {(["tarjeta", "transferencia"] as const).map((method) => (
              <button
                key={method}
                onClick={() => onOtherMethodChange(method)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  otherMethod === method
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {method === "tarjeta" ? "Tarjeta" : "Transferencia"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="# Referencia / Autorización (opcional)"
            value={paymentReference}
            onChange={(e) => onPaymentReferenceChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {(parseFloat(cashAmount) || 0) + (parseFloat(otherAmount) || 0) > 0 && (
            <div className="text-sm text-muted-foreground border-t border-border pt-2">
              <p>Efectivo: ${(parseFloat(cashAmount) || 0).toFixed(2)}</p>
              <p>{otherMethod}: ${(parseFloat(otherAmount) || 0).toFixed(2)}</p>
              <p className={`font-bold ${
                (parseFloat(cashAmount) || 0) + (parseFloat(otherAmount) || 0) >= total
                  ? "text-success" : "text-warning"
              }`}>
                Suma: ${((parseFloat(cashAmount) || 0) + (parseFloat(otherAmount) || 0)).toFixed(2)} / ${total.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onConfirm}
        className="w-full py-3 rounded-md bg-success text-white font-bold text-lg hover:bg-success/90 transition-colors"
      >
        Confirmar (Enter)
      </button>
    </Modal>
  );
}
