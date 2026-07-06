import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { CartItem, Customer } from "@/lib/types";
import type { PaymentEntry } from "./useCart";

interface UsePaymentOptions {
  cart: CartItem[];
  customer: Customer | null;
  total: number;
  remaining: number;
  partialPayments: PaymentEntry[];
  updateActiveTab: (updates: { partialPayments?: PaymentEntry[] }) => void;
  clearCart: () => void;
  showChange: (amount: number) => void;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  focusInput: () => void;
}

export function usePayment(options: UsePaymentOptions) {
  const {
    cart,
    customer,
    total,
    remaining,
    partialPayments,
    updateActiveTab,
    clearCart,
    showChange,
    setError,
    setSuccess,
    focusInput,
  } = options;

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"efectivo" | "otro" | "mixto">("efectivo");
  const [cashAmount, setCashAmount] = useState("");
  const [otherMethod, setOtherMethod] = useState<"tarjeta" | "transferencia">("tarjeta");
  const [otherAmount, setOtherAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const resetPaymentState = useCallback(() => {
    setCashAmount("");
    setOtherAmount("");
    setPaymentReference("");
    setPaymentMode("efectivo");
    setOtherMethod("tarjeta");
  }, []);

  const finalizeSaleWithPayments = useCallback(async (payments: PaymentEntry[]) => {
    try {
      const result = await api.createSale({
        customer_id: customer?.id ?? null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.sale_price,
          discount: item.discount,
        })),
        payments,
        discount: 0,
      });

      const changeMsg = result.change_amount > 0 ? ` Cambio: $${result.change_amount.toFixed(2)}` : "";
      setSuccess(`✅ Venta #${result.id} completada.${changeMsg}`);

      if (result.change_amount > 0) {
        showChange(result.change_amount);
      }

      // Print ticket and open drawer (fire and forget)
      api.printTicket(result.id).catch(() => {});
      if (payments.some((p) => p.method === "efectivo")) {
        api.openCashDrawer().catch(() => {});
      }

      clearCart();
      setShowPaymentModal(false);
      resetPaymentState();
      focusInput();
    } catch (err) {
      setError(String(err));
    }
  }, [cart, customer, clearCart, showChange, setError, setSuccess, focusInput, resetPaymentState]);

  const handlePayment = useCallback(async () => {
    let payments: PaymentEntry[] = [...partialPayments];

    if (paymentMode === "efectivo") {
      const paid = parseFloat(cashAmount);
      if (isNaN(paid) || paid < remaining) {
        setError("Monto insuficiente");
        return;
      }
      payments.push({ method: "efectivo", amount: paid });
    } else if (paymentMode === "otro") {
      payments.push({ method: otherMethod, amount: remaining, reference: paymentReference || null });
    } else if (paymentMode === "mixto") {
      const cash = parseFloat(cashAmount) || 0;
      const other = parseFloat(otherAmount) || 0;
      if (cash + other < remaining - 0.01) {
        setError(`Faltan $${(remaining - cash - other).toFixed(2)} por cubrir`);
        return;
      }
      if (cash > 0) payments.push({ method: "efectivo", amount: cash });
      if (other > 0) payments.push({ method: otherMethod, amount: other, reference: paymentReference || null });
    }

    await finalizeSaleWithPayments(payments);
  }, [partialPayments, paymentMode, cashAmount, otherAmount, otherMethod, paymentReference, remaining, setError, finalizeSaleWithPayments]);

  const handleQuickPay = useCallback(async (method: "efectivo" | "tarjeta" | "transferencia", amount: number) => {
    const newPayments: PaymentEntry[] = [...partialPayments, { method, amount }];
    const totalPaid = newPayments.reduce((s, p) => s + p.amount, 0);

    if (totalPaid >= total - 0.01) {
      await finalizeSaleWithPayments(newPayments);
    } else {
      updateActiveTab({ partialPayments: newPayments });
      setSuccess(`Abono $${amount.toFixed(2)} (${method}). Falta: $${(total - totalPaid).toFixed(2)}`);
    }
  }, [partialPayments, total, finalizeSaleWithPayments, updateActiveTab, setSuccess]);

  const finalizeSale = useCallback(async () => {
    if (partialPayments.length === 0) return;
    await finalizeSaleWithPayments(partialPayments);
  }, [partialPayments, finalizeSaleWithPayments]);

  const openPaymentModal = useCallback((mode: "efectivo" | "otro" | "mixto") => {
    setPaymentMode(mode);
    setShowPaymentModal(true);
    setTimeout(() => document.getElementById("payment-amount")?.focus(), 50);
  }, []);

  const closePaymentModal = useCallback(() => {
    setShowPaymentModal(false);
    resetPaymentState();
    focusInput();
  }, [resetPaymentState, focusInput]);

  return {
    // State
    showPaymentModal,
    paymentMode,
    cashAmount,
    otherMethod,
    otherAmount,
    paymentReference,
    // Setters
    setPaymentMode,
    setCashAmount,
    setOtherMethod,
    setOtherAmount,
    setPaymentReference,
    // Actions
    handlePayment,
    handleQuickPay,
    finalizeSale,
    finalizeSaleWithPayments,
    openPaymentModal,
    closePaymentModal,
    resetPaymentState,
  };
}
