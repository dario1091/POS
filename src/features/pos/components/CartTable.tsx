import { useEffect, useRef } from "react";
import type { CartItem } from "@/shared/api/types";

interface CartTableProps {
  cart: CartItem[];
  selectedIndex: number;
}

export function CartTable({ cart, selectedIndex }: CartTableProps) {
  const lastRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    lastRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [cart.length]);

  return (
    <table className="w-full">
      <thead className="bg-card sticky top-0">
        <tr className="border-b border-border">
          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">#</th>
          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-16">Ref</th>
          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Producto</th>
          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-24">Cant.</th>
          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-32">P. Unit.</th>
          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-32">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {cart.map((item, index) => (
          <tr
            key={`${item.product.id}-${item.product.sale_price}-${index}`}
            ref={index === cart.length - 1 ? lastRowRef : undefined}
            className={`border-b border-border transition-colors ${
              index === selectedIndex
                ? "bg-primary/20 border-l-4 border-l-primary"
                : "hover:bg-card/50"
            }`}
          >
            <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{item.product.id}</td>
            <td className="px-4 py-3 text-sm text-foreground font-medium">{item.product.name}</td>
            <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{item.quantity}</td>
            <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
              ${item.product.sale_price.toFixed(2)}
            </td>
            <td className="px-4 py-3 text-sm text-foreground text-right font-mono font-bold">
              ${(item.product.sale_price * item.quantity - item.discount).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
