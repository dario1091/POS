import { Modal } from "@/shared/ui/Modal";
import type { Product } from "@/lib/types";

interface PriceModalProps {
  show: boolean;
  product: Product | null;
  onClose: () => void;
}

export function PriceModal({ show, product, onClose }: PriceModalProps) {
  if (!show || !product) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-2">Consulta de Precio</h2>
      <p className="text-foreground">{product.name}</p>
      <p className="text-3xl font-bold text-primary font-mono mt-2">
        ${product.sale_price.toFixed(2)}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Stock: {product.stock} {product.unit}
      </p>
      <p className="text-xs text-muted-foreground mt-3">Escape o ✕ para cerrar</p>
    </Modal>
  );
}
