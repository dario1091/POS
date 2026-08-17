import { useCallback } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

interface UseCommandsOptions {
  addToCart: (product: Product, quantity: number, customPrice?: number) => void;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  setCommand: (cmd: string) => void;
  // Modal openers
  openCashCut: (data: {
    total_sales: number; transactions: number; cash_total: number; card_total: number;
    transfer_total: number; credit_total: number; deliveries_total: number;
    deliveries_count: number; supplier_payments_total: number; supplier_payments_count: number;
    supplier_payments: { supplier_name: string; amount: number; created_at: string }[];
    returns_total: number; returns_count: number;
    cancellations_total: number; cancellations_count: number;
    credit_payments_cash: number; credit_payments_count: number;
    cash_in_register: number; date: string;
  }, mode: "preview" | "reprint") => void;
  openCreditPay: () => void;
  openDelivery: (amount?: string) => void;
  openSupplierPayment: (amount?: string) => void;
  openSearch: (results: Product[]) => void;
  openPriceCheck: (product: Product) => void;
  openCancelSale: (saleId: number) => void;
  requireAdminAuth: (callback: () => void) => void;
}

export function useCommands(options: UseCommandsOptions) {
  const {
    addToCart,
    setError,
    setSuccess,
    setCommand,
    openCashCut,
    openCreditPay,
    openDelivery,
    openSupplierPayment,
    openSearch,
    openPriceCheck,
    openCancelSale,
    requireAdminAuth,
  } = options;

  const addProductByCode = useCallback(async (code: string, quantity: number) => {
    try {
      const product = await api.searchProductByCode(code);
      if (product) {
        addToCart(product, quantity);
      } else {
        setError(`Producto no encontrado: ${code}`);
      }
    } catch {
      setError("Error buscando producto");
    }
  }, [addToCart, setError]);

  const executeCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // monto**código — agregar producto con precio custom (solo si es MAYOR al precio del sistema)
    const amountMatch = trimmed.match(/^(\d+(?:\.\d+)?)\*\*(.+)$/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);
      const code = amountMatch[2];
      try {
        const product = await api.searchProductByCode(code);
        if (product) {
          if (amount < product.sale_price) {
            setError(`No se puede bajar el precio. Precio del sistema: $${product.sale_price.toFixed(2)}`);
          } else {
            addToCart(product, 1, amount);
          }
        } else {
          setError(`Producto no encontrado: ${code}`);
        }
      } catch {
        setError("Error buscando producto");
      }
      setCommand("");
      return;
    }

    // CC — Cierre de caja rápido
    if (trimmed.toUpperCase() === "CC") {
      setCommand("");
      try {
        const data = await api.quickCashCut();
        openCashCut(data, "preview");
      } catch (err) {
        setError(String(err));
      }
      return;
    }

    // CX{fecha} — Reimprimir ticket de cierre de caja de una fecha específica
    const cxMatch = trimmed.match(/^cx(\d{4}-\d{2}-\d{2})$/i);
    if (cxMatch) {
      const date = cxMatch[1];
      setCommand("");
      try {
        const data = await api.getCashCutByDate(date);
        openCashCut(data, "reprint");
      } catch (err) {
        setError(String(err));
      }
      return;
    }

    // AB — Abono a crédito
    if (trimmed.toUpperCase() === "AB") {
      setCommand("");
      openCreditPay();
      return;
    }

    // AN{id} — Anular venta
    const anMatch = trimmed.match(/^an(\d+)$/i);
    if (anMatch) {
      const saleId = parseInt(anMatch[1]);
      setCommand("");
      requireAdminAuth(() => {
        openCancelSale(saleId);
      });
      return;
    }

    // EP or EP{monto} — Entrega parcial de efectivo (requiere admin)
    const epMatch = trimmed.match(/^ep(\d+)?$/i);
    if (epMatch) {
      setCommand("");
      const amount = epMatch[1] || undefined;
      requireAdminAuth(() => openDelivery(amount));
      return;
    }

    // PP or PP{monto} — Pago a proveedor (requiere admin)
    const ppMatch = trimmed.match(/^pp(\d+)?$/i);
    if (ppMatch) {
      setCommand("");
      const amount = ppMatch[1] || undefined;
      requireAdminAuth(() => openSupplierPayment(amount));
      return;
    }

    // pv nombre — search by name (pv followed by space and text)
    const nameSearch = trimmed.match(/^pv\s+(.+)$/i);
    if (nameSearch) {
      const name = nameSearch[1];
      try {
        const results = await api.searchProductsByName(name);
        openSearch(results);
      } catch {
        setError("Error buscando productos");
      }
      setCommand("");
      return;
    }

    // pv{code} — price check
    const priceCheck = trimmed.match(/^pv(.+)$/i);
    if (priceCheck) {
      const code = priceCheck[1];
      try {
        const product = await api.searchProductByCode(code);
        if (product) {
          openPriceCheck(product);
        } else {
          setError("Producto no encontrado");
        }
      } catch {
        setError("Error consultando precio");
      }
      setCommand("");
      return;
    }

    // N*{code} — quantity
    const qtyMatch = trimmed.match(/^(\d+)\*(.+)$/);
    if (qtyMatch) {
      const qty = parseInt(qtyMatch[1]);
      const code = qtyMatch[2];
      await addProductByCode(code, qty);
      setCommand("");
      return;
    }

    // Direct code/reference
    await addProductByCode(trimmed, 1);
    setCommand("");
  }, [addToCart, setError, setSuccess, setCommand, openCashCut, openCreditPay, openDelivery, openSupplierPayment, openSearch, openPriceCheck, requireAdminAuth, addProductByCode]);

  return { executeCommand, addProductByCode };
}
