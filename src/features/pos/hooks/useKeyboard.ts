import { useEffect, useCallback } from "react";
import type { CartItem, User } from "@/lib/types";
import type { PaymentEntry } from "./useCart";

interface UseKeyboardOptions {
  // State
  cart: CartItem[];
  command: string;
  selectedIndex: number;
  returnMode: boolean;
  partialPayments: PaymentEntry[];
  remaining: number;
  tabs: { id: number; cart: CartItem[] }[];
  user: User | null;
  anyModalOpen: boolean;
  // Actions
  setCommand: (cmd: string) => void;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  setReturnMode: (mode: boolean) => void;
  executeCommand: (cmd: string) => Promise<void>;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  addTab: () => boolean;
  switchTab: (index: number) => void;
  // Payment
  handleQuickPay: (method: "efectivo" | "tarjeta" | "transferencia", amount: number) => Promise<void>;
  finalizeSale: () => Promise<void>;
  openPaymentModal: (mode: "efectivo" | "otro" | "mixto") => void;
  // Modals
  openCustomerModal: () => void;
  openHistoryModal: () => void;
  openReprintModal: () => void;
  openHelpModal: () => void;
  openConfirmCancel: () => void;
  openCashDrawer: () => void;
  // Auth
  requireAdminAuth: (callback: () => void) => void;
  handleReturn: () => Promise<void>;
}

export function useKeyboard(options: UseKeyboardOptions) {
  const {
    cart,
    command,
    selectedIndex,
    returnMode,
    partialPayments,
    remaining,
    tabs,
    anyModalOpen,
    setCommand,
    setSelectedIndex,
    setError,
    setReturnMode,
    setSuccess,
    executeCommand,
    removeFromCart,
    clearCart,
    addTab,
    switchTab,
    handleQuickPay,
    finalizeSale,
    openPaymentModal,
    openCustomerModal,
    openHistoryModal,
    openReprintModal,
    openHelpModal,
    openConfirmCancel,
    openCashDrawer,
    requireAdminAuth,
    handleReturn,
  } = options;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+N — New tab (max 3)
    if (e.ctrlKey && e.key === "n") {
      e.preventDefault();
      if (!addTab()) {
        setError("Máximo 3 ventas simultáneas");
      }
      setCommand("");
      return;
    }

    // Ctrl+1/2/3 — Switch tab
    if (e.ctrlKey && ["1", "2", "3"].includes(e.key)) {
      e.preventDefault();
      const tabIndex = parseInt(e.key) - 1;
      switchTab(tabIndex);
      setCommand("");
      return;
    }

    // F1 - Cash payment / Confirm return
    if (e.key === "F1") {
      e.preventDefault();
      if (cart.length === 0) return;

      if (returnMode) {
        const inputVal = command.trim();
        if (inputVal === "0" || inputVal === "") {
          requireAdminAuth(() => handleReturn());
        } else {
          setError("Escribe 0 y presiona F1 para confirmar la devolución");
        }
        setCommand("");
        return;
      }

      const inputAmount = parseFloat(command.trim());

      if (!isNaN(inputAmount) && inputAmount > 0) {
        handleQuickPay("efectivo", inputAmount);
        setCommand("");
      } else if (command.trim() === "") {
        if (remaining <= 0 && partialPayments.length > 0) {
          finalizeSale();
        } else {
          openPaymentModal("efectivo");
        }
      }
      return;
    }

    // F2 - Other payment
    if (e.key === "F2") {
      e.preventDefault();
      if (cart.length === 0) return;

      const inputAmount = parseFloat(command.trim());

      if (!isNaN(inputAmount) && inputAmount > 0) {
        handleQuickPay("tarjeta", inputAmount);
        setCommand("");
      } else if (command.trim() === "") {
        openPaymentModal("otro");
      }
      return;
    }

    // F3 - Remove selected item
    if (e.key === "F3") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < cart.length) {
        removeFromCart(selectedIndex);
      }
      return;
    }

    // F4 - Cancel sale (requiere admin)
    if (e.key === "F4") {
      e.preventDefault();
      if (cart.length > 0) {
        requireAdminAuth(() => openConfirmCancel());
      }
      return;
    }

    // F5 - Customer search
    if (e.key === "F5") {
      e.preventDefault();
      openCustomerModal();
      return;
    }

    // F7 - Open cash drawer manually
    if (e.key === "F7") {
      e.preventDefault();
      openCashDrawer();
      return;
    }

    // F6 - Toggle return mode
    if (e.key === "F6") {
      e.preventDefault();
      if (returnMode && cart.length === 0) {
        setReturnMode(false);
      } else if (!returnMode && cart.length === 0) {
        setReturnMode(true);
      } else if (!returnMode) {
        setError("Termina la venta actual antes de hacer una devolución");
      }
      return;
    }

    // F8 - Quick history
    if (e.key === "F8") {
      e.preventDefault();
      openHistoryModal();
      return;
    }

    // F9 - Reprint ticket
    if (e.key === "F9") {
      e.preventDefault();
      openReprintModal();
      return;
    }

    // F12 - Help
    if (e.key === "F12") {
      e.preventDefault();
      openHelpModal();
      return;
    }

    // Arrow navigation when input is empty
    if (command === "" && cart.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev: number) => (prev <= 0 ? cart.length - 1 : prev - 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev: number) => (prev >= cart.length - 1 ? 0 : prev + 1));
        return;
      }
    }

    // Enter - execute command
    if (e.key === "Enter" && command.trim()) {
      e.preventDefault();
      executeCommand(command);
      return;
    }

    // Escape - deselect
    if (e.key === "Escape") {
      if (!anyModalOpen) {
        setSelectedIndex(-1);
      }
      return;
    }
  }, [
    cart, command, selectedIndex, returnMode, partialPayments, remaining, tabs, anyModalOpen,
    setCommand, setSelectedIndex, setError, setSuccess, setReturnMode,
    executeCommand, removeFromCart, clearCart, addTab, switchTab,
    handleQuickPay, finalizeSale, openPaymentModal,
    openCustomerModal, openHistoryModal, openReprintModal, openHelpModal, openConfirmCancel, openCashDrawer,
    requireAdminAuth, handleReturn,
  ]);

  // Global F-key preventDefault (works even without input focus)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["F1", "F2", "F3", "F4", "F5", "F7"].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { handleKeyDown };
}
