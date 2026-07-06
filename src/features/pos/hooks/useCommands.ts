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
    deliveries_count: number; cash_in_register: number; date: string;
  }) => void;
  openCreditPay: () => void;
  openDelivery: (amount?: string) => void;
  openSearch: (results: Product[]) => void;
  openPriceCheck: (product: Product) => void;
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
    openSearch,
    openPriceCheck,
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

    // $monto*código — agregar producto con precio custom
    const amountMatch = trimmed.match(/^\$(\d+(?:\.\d+)?)\*(.+)$/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);
      const code = amountMatch[2];
      try {
        const product = await api.searchProductByCode(code);
        if (product) {
          addToCart(product, 1, amount);
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
        openCashCut(data);
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
        const reason = prompt("Motivo de la anulación:");
        if (reason) {
          api.cancelSale(saleId, reason).then((result) => {
            setSuccess(`✅ Venta #${result.sale_id} anulada. Stock restaurado (${result.items_restored} items). Total: $${result.total_restored.toFixed(2)}`);
          }).catch((err) => setError(String(err)));
        }
      });
      return;
    }

    // EP or EP{monto} — Entrega parcial de efectivo
    const epMatch = trimmed.match(/^ep(\d+)?$/i);
    if (epMatch) {
      setCommand("");
      openDelivery(epMatch[1] || undefined);
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
  }, [addToCart, setError, setSuccess, setCommand, openCashCut, openCreditPay, openDelivery, openSearch, openPriceCheck, requireAdminAuth, addProductByCode]);

  return { executeCommand, addProductByCode };
}
