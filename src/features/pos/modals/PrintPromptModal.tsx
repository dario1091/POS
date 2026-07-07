import { useState, useEffect } from "react";
import { Modal } from "@/shared/ui/Modal";

interface PrintPromptModalProps {
  show: boolean;
  saleId: number | null;
  onPrint: (saleId: number) => void;
  onSkip: () => void;
}

export function PrintPromptModal({ show, saleId, onPrint, onSkip }: PrintPromptModalProps) {
  const [selected, setSelected] = useState<"no" | "si">("no");

  // Reset to "no" each time modal opens
  useEffect(() => {
    if (show) setSelected("no");
  }, [show]);

  if (!show || !saleId) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      setSelected((prev) => (prev === "no" ? "si" : "no"));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selected === "si") {
        onPrint(saleId);
      } else {
        onSkip();
      }
    }
  };

  return (
    <Modal onClose={onSkip}>
      <div onKeyDown={handleKeyDown} tabIndex={0} ref={(el) => el?.focus()}>
        <h2 className="text-lg font-bold text-foreground mb-4 text-center">¿Imprimir ticket?</h2>
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className={`flex-1 py-4 rounded-md text-lg font-bold transition-colors ${
              selected === "no"
                ? "bg-primary text-primary-foreground ring-2 ring-primary"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            No
          </button>
          <button
            onClick={() => onPrint(saleId)}
            className={`flex-1 py-4 rounded-md text-lg font-bold transition-colors ${
              selected === "si"
                ? "bg-primary text-primary-foreground ring-2 ring-primary"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            Sí
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">Tab para cambiar | Enter para confirmar</p>
      </div>
    </Modal>
  );
}
