import { useState } from "react";
import { Modal } from "@/shared/ui/Modal";
import type { Product } from "@/lib/types";

interface AmountModalProps {
  show: boolean;
  product: Product | null;
  onConfirm: (product: Product, amount: number) => void;
  onClose: () => void;
}

export function AmountModal({ show, product, onConfirm, onClose }: AmountModalProps) {
  const [amount, setAmount] = useState("");

  if (!show || !product) return null;

  const handleConfirm = () => {
    const val = parseFloat(amount);
    if (val > 0) {
      onConfirm(product, val);
      setAmount("");
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-2">¿Cuánto cuesta?</h2>
      <p className="text-sm text-muted-foreground mb-4">{product.name}</p>
      <input
        id="product-amount-input"
        type="number"
        step="0.01"
        placeholder="Monto ($)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
        className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-xl font-mono mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
      <button
        onClick={handleConfirm}
        className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
      >
        Agregar
      </button>
    </Modal>
  );
}
