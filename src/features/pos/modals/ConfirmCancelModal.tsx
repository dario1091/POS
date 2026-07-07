import { useState, useEffect } from "react";
import { Modal } from "@/shared/ui/Modal";

interface ConfirmCancelModalProps {
  show: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmCancelModal({ show, onConfirm, onClose }: ConfirmCancelModalProps) {
  const [selected, setSelected] = useState<"no" | "si">("no");

  useEffect(() => {
    if (show) setSelected("no");
  }, [show]);

  if (!show) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      setSelected((prev) => (prev === "no" ? "si" : "no"));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selected === "si") {
        onConfirm();
      } else {
        onClose();
      }
    }
  };

  return (
    <Modal onClose={onClose}>
      <div onKeyDown={handleKeyDown} tabIndex={0} ref={(el) => el?.focus()}>
        <h2 className="text-lg font-bold text-foreground mb-2 text-center">¿Cancelar la venta?</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">Se perderán todos los productos del carrito.</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 py-4 rounded-md text-lg font-bold transition-colors ${
              selected === "no"
                ? "bg-primary text-primary-foreground ring-2 ring-primary"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-4 rounded-md text-lg font-bold transition-colors ${
              selected === "si"
                ? "bg-destructive text-white ring-2 ring-destructive"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            Sí, cancelar
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">Tab para cambiar | Enter para confirmar</p>
      </div>
    </Modal>
  );
}
