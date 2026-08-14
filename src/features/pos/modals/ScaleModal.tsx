import { useState, useCallback, useRef, useEffect } from "react";
import { Modal } from "@/shared/ui/Modal";
import type { Product } from "@/lib/types";

interface ScaleModalProps {
  show: boolean;
  product: Product | null;
  onConfirm: (product: Product, price: number) => void;
  onClose: () => void;
}

export function ScaleModal({ show, product, onConfirm, onClose }: ScaleModalProps) {
  const [grams, setGrams] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [isOverridden, setIsOverridden] = useState(false);
  const gramsRef = useRef<HTMLInputElement>(null);

  // Reset state when product changes or modal opens
  useEffect(() => {
    if (show) {
      setGrams("");
      setPriceOverride("");
      setIsOverridden(false);
      setTimeout(() => gramsRef.current?.focus(), 50);
    }
  }, [show, product?.id]);

  if (!show || !product) return null;

  const pricePerKg = product.sale_price;
  const calculatedPrice = grams ? (parseFloat(grams) / 1000) * pricePerKg : 0;
  const displayPrice = isOverridden ? priceOverride : calculatedPrice > 0 ? calculatedPrice.toFixed(2) : "";
  const finalPrice = isOverridden ? parseFloat(priceOverride) : calculatedPrice;

  const handleGramsChange = (value: string) => {
    setGrams(value);
    // When grams change, recalculate and clear override
    setIsOverridden(false);
    setPriceOverride("");
  };

  const handlePriceChange = (value: string) => {
    setPriceOverride(value);
    setIsOverridden(true);
  };

  const handleConfirm = useCallback(() => {
    if (finalPrice > 0) {
      onConfirm(product, finalPrice);
      setGrams("");
      setPriceOverride("");
      setIsOverridden(false);
    }
  }, [finalPrice, product, onConfirm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-1">Báscula</h2>
      <p className="text-sm text-muted-foreground mb-1">{product.name}</p>
      <p className="text-xs text-muted-foreground mb-4">
        Precio: <span className="font-mono font-semibold text-foreground">${pricePerKg.toFixed(2)}/kg</span>
      </p>

      {/* Grams input */}
      <label htmlFor="scale-grams-input" className="text-sm text-muted-foreground block mb-1">
        Gramos
      </label>
      <input
        ref={gramsRef}
        id="scale-grams-input"
        type="number"
        step="1"
        min="0"
        placeholder="Ej: 250"
        value={grams}
        onChange={(e) => handleGramsChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-xl font-mono mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Price input (calculated or overridden) */}
      <label htmlFor="scale-price-input" className="text-sm text-muted-foreground block mb-1">
        Total ($){isOverridden && <span className="ml-2 text-xs text-warning">editado</span>}
      </label>
      <input
        id="scale-price-input"
        type="number"
        step="0.01"
        min="0"
        placeholder="Precio calculado"
        value={displayPrice}
        onChange={(e) => handlePriceChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-full px-4 py-3 rounded-md bg-input border text-foreground text-xl font-mono mb-4 focus:outline-none focus:ring-2 focus:ring-ring ${
          isOverridden ? "border-warning" : "border-border"
        }`}
      />

      <button
        onClick={handleConfirm}
        disabled={!finalPrice || finalPrice <= 0}
        className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Agregar — ${finalPrice > 0 ? finalPrice.toFixed(2) : "0.00"}
      </button>
    </Modal>
  );
}
