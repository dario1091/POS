import { useState } from "react";
import { Modal } from "@/shared/ui/Modal";
import type { Product } from "@/lib/types";

interface SearchModalProps {
  show: boolean;
  results: Product[];
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export function SearchModal({ show, results, onSelect, onClose }: SearchModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!show) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-4">Resultados de Búsqueda</h2>
      {results.length === 0 ? (
        <p className="text-muted-foreground">No se encontraron productos</p>
      ) : (
        <div
          className="max-h-64 overflow-auto space-y-1"
          tabIndex={0}
          ref={(el) => el?.focus()}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((prev) => {
                const next = prev < results.length - 1 ? prev + 1 : 0;
                document.getElementById(`search-result-${next}`)?.scrollIntoView({ block: "nearest" });
                return next;
              });
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((prev) => {
                const next = prev > 0 ? prev - 1 : results.length - 1;
                document.getElementById(`search-result-${next}`)?.scrollIntoView({ block: "nearest" });
                return next;
              });
            } else if (e.key === "Enter") {
              e.preventDefault();
              const selected = results[selectedIndex];
              if (selected) onSelect(selected);
            }
          }}
        >
          {results.map((p, idx) => (
            <button
              id={`search-result-${idx}`}
              key={p.id}
              onClick={() => onSelect(p)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex justify-between items-center ${
                idx === selectedIndex
                  ? "bg-primary/20 ring-1 ring-primary"
                  : "hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-mono w-8">#{p.id}</span>
                <span className="text-foreground">{p.name}</span>
              </div>
              <span className="text-primary font-mono">${p.sale_price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">
        {results.length > 0 ? "↑↓ para navegar, Enter para agregar" : "Presiona Escape o ✕ para cerrar"}
      </p>
    </Modal>
  );
}
