import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { getLocalDate } from "@/lib/utils";
import type { Product, Customer, CartItem } from "@/lib/types";

interface SaleTab {
  id: number;
  cart: CartItem[];
  customer: Customer | null;
  partialPayments: { method: "efectivo" | "tarjeta" | "transferencia" | "credito"; amount: number; reference?: string | null }[];
}

export function PosPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Tab system (max 3 concurrent sales)
  const [tabs, setTabs] = useState<SaleTab[]>([{ id: 1, cart: [], customer: null, partialPayments: [] }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [nextTabId, setNextTabId] = useState(2);

  // Get current tab data
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const cart = activeTab.cart;
  const customer = activeTab.customer;
  const partialPayments = activeTab.partialPayments;

  // Update current tab helper
  const updateActiveTab = (updates: Partial<SaleTab>) => {
    setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  // Convenience setters that update the active tab
  const setCustomer = (c: Customer | null) => updateActiveTab({ customer: c });

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [command, setCommand] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Payment state (unified modal)
  const [paymentMode, setPaymentMode] = useState<"efectivo" | "otro" | "mixto">("efectivo");
  const [cashAmount, setCashAmount] = useState("");
  const [otherMethod, setOtherMethod] = useState<"tarjeta" | "transferencia">("tarjeta");
  const [otherAmount, setOtherAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const [priceInfo, setPriceInfo] = useState<Product | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  // Change display (shows after sale completion for 3s)
  const [changeDisplay, setChangeDisplay] = useState<{ amount: number; visible: boolean }>({ amount: 0, visible: false });

  // Reprint modal
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintSales, setReprintSales] = useState<{ id: number; total: number; created_at: string; payment_method: string }[]>([]);
  const [reprintSelectedIndex, setReprintSelectedIndex] = useState(0);

  // Cash cut modal (CC command)
  const [showCashCutModal, setShowCashCutModal] = useState(false);
  const [cashCutData, setCashCutData] = useState<{
    total_sales: number; transactions: number; cash_total: number; card_total: number;
    transfer_total: number; credit_total: number; deliveries_total: number;
    deliveries_count: number; cash_in_register: number; date: string;
  } | null>(null);

  // Cash delivery modal (EP command)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryAmount, setDeliveryAmount] = useState("");
  const [deliverySupervisor, setDeliverySupervisor] = useState("");

  // Return mode (F6)
  const [returnMode, setReturnMode] = useState(false);

  // Amount input for "monto" type products
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [amountProduct, setAmountProduct] = useState<Product | null>(null);
  const [productAmount, setProductAmount] = useState("");

  // History modal (F8)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySales, setHistorySales] = useState<{ id: number; total: number; payment_method: string; items_count: number; cancelled: boolean; created_at: string }[]>([]);
  const [historySelectedIndex, setHistorySelectedIndex] = useState(0);

  // Credit payment modal (AB command)
  const [showCreditPayModal, setShowCreditPayModal] = useState(false);
  const [creditPayCustomer, setCreditPayCustomer] = useState<Customer | null>(null);
  const [creditPayAmount, setCreditPayAmount] = useState("");
  const [creditPaySearch, setCreditPaySearch] = useState("");
  const [creditPayResults, setCreditPayResults] = useState<Customer[]>([]);

  // Admin auth modal (for sensitive operations)
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthCallback, setAdminAuthCallback] = useState<(() => void) | null>(null);
  const [adminAuthError, setAdminAuthError] = useState("");

  // Computed
  const subtotal = cart.reduce((sum, item) => sum + item.product.sale_price * item.quantity - item.discount, 0);
  const total = subtotal;
  const partialTotal = partialPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - partialTotal;

  // Focus management
  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // Check server connection periodically (only relevant for client mode)
  useEffect(() => {
    const check = async () => {
      try {
        const connected = await api.checkServerConnection();
        setServerConnected(connected);
      } catch {
        setServerConnected(null); // standalone mode
      }
    };
    check();
    const interval = setInterval(check, 10000); // every 10s
    return () => clearInterval(interval);
  }, []);

  // Clear error after 3s
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Parse and execute command
  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // $monto*código — agregar producto con precio custom (para productos tipo "monto")
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
        setCashCutData(data);
        setShowCashCutModal(true);
      } catch (err) {
        setError(String(err));
      }
      return;
    }

    // AB — Abono a crédito
    if (trimmed.toUpperCase() === "AB") {
      setCommand("");
      setShowCreditPayModal(true);
      setCreditPayCustomer(null);
      setCreditPayAmount("");
      setCreditPaySearch("");
      setCreditPayResults([]);
      setTimeout(() => document.getElementById("credit-pay-search")?.focus(), 50);
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
      if (epMatch[1]) {
        setDeliveryAmount(epMatch[1]);
      }
      setShowDeliveryModal(true);
      setTimeout(() => document.getElementById("delivery-amount")?.focus(), 50);
      return;
    }

    // pv%name% — search by name
    const nameSearch = trimmed.match(/^pv%(.+)%$/i);
    if (nameSearch) {
      const name = nameSearch[1];
      try {
        const results = await api.searchProductsByName(name);
        setSearchResults(results);
        setShowSearchModal(true);
      } catch (err) {
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
          setPriceInfo(product);
          setShowPriceModal(true);
        } else {
          setError("Producto no encontrado");
        }
      } catch (err) {
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
  };

  const addProductByCode = async (code: string, quantity: number) => {
    try {
      const product = await api.searchProductByCode(code);
      if (product) {
        addToCart(product, quantity);
      } else {
        setError(`Producto no encontrado: ${code}`);
      }
    } catch (err) {
      setError("Error buscando producto");
    }
  };

  const addToCart = (product: Product, quantity: number, customPrice?: number) => {
    // Hide change display when new product is added
    if (changeDisplay.visible) {
      setChangeDisplay({ amount: 0, visible: false });
    }

    // If product type is "monto" and no custom price provided, ask for it
    if (product.price_type === "monto" && !customPrice) {
      setAmountProduct(product);
      setProductAmount("");
      setShowAmountModal(true);
      setTimeout(() => document.getElementById("product-amount-input")?.focus(), 50);
      return;
    }

    const price = customPrice ?? product.sale_price;
    const existing = cart.findIndex((item) => item.product.id === product.id && item.product.sale_price === price);
    if (existing >= 0) {
      const updated = [...cart];
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + quantity };
      updateActiveTab({ cart: updated });
    } else {
      // For custom price products, override sale_price in the cart item
      const productWithPrice = customPrice ? { ...product, sale_price: price } : product;
      updateActiveTab({ cart: [...cart, { product: productWithPrice, quantity, discount: 0 }] });
    }
    setSelectedIndex(-1);
  };

  const removeFromCart = (index: number) => {
    updateActiveTab({ cart: cart.filter((_, i) => i !== index) });
    setSelectedIndex(-1);
  };

  const clearCart = () => {
    updateActiveTab({ cart: [], customer: null, partialPayments: [] });
    setSelectedIndex(-1);
  };

  // Unified payment handler
  // Unified payment handler (from modal)
  const handlePayment = async () => {
    type PayMethod = "efectivo" | "tarjeta" | "transferencia" | "credito";
    let payments: { method: PayMethod; amount: number; reference?: string | null }[] = [...partialPayments];

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
  };

  const resetPaymentState = () => {
    setCashAmount("");
    setOtherAmount("");
    setPaymentReference("");
    setPaymentMode("efectivo");
    setOtherMethod("tarjeta");
  };

  // Handle return (F6 mode + 0+F1 to confirm)
  const handleReturn = async () => {
    if (cart.length === 0) return;
    try {
      const items = cart.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.sale_price,
      }));
      const result = await api.createReturn(items, null);
      setSuccess(`✅ Devolución #${result.id} registrada. Total devuelto: $${result.total.toFixed(2)}`);
      clearCart();
      setReturnMode(false);
      focusInput();
    } catch (err) {
      setError(String(err));
    }
  };

  // Require admin password before sensitive operations
  const requireAdminAuth = (callback: () => void) => {
    // If current user is admin, skip password
    if (user?.role === "admin") {
      callback();
      return;
    }
    setAdminPassword("");
    setAdminAuthError("");
    setAdminAuthCallback(() => callback);
    setShowAdminAuthModal(true);
    setTimeout(() => document.getElementById("admin-auth-input")?.focus(), 50);
  };

  const handleAdminAuth = async () => {
    try {
      const valid = await api.validateAdminPassword(adminPassword);
      if (valid) {
        setShowAdminAuthModal(false);
        setAdminPassword("");
        if (adminAuthCallback) adminAuthCallback();
      } else {
        setAdminAuthError("Clave incorrecta");
      }
    } catch (err) {
      setAdminAuthError(String(err));
    }
  };

  // Handle cash delivery (EP command)
  const handleDelivery = async () => {
    const amount = parseFloat(deliveryAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    if (!deliverySupervisor.trim()) {
      setError("Ingresa el nombre del supervisor que recibe");
      return;
    }
    try {
      const result = await api.createCashDelivery(amount, deliverySupervisor, null);
      setSuccess(`✅ Entrega de $${amount.toFixed(2)} registrada. Recibe: ${deliverySupervisor}`);
      // Print delivery receipt
      api.printDeliveryReceipt(amount, deliverySupervisor, result.id).catch(() => {});
      setShowDeliveryModal(false);
      setDeliveryAmount("");
      setDeliverySupervisor("");
      focusInput();
    } catch (err) {
      setError(String(err));
    }
  };

  // Quick pay from command bar (F1/F2 with amount in input)
  const handleQuickPay = async (method: "efectivo" | "tarjeta" | "transferencia", amount: number) => {
    const newPayments = [...partialPayments, { method, amount }];
    const totalPaid = newPayments.reduce((s, p) => s + p.amount, 0);
    setCommand("");

    if (totalPaid >= total - 0.01) {
      // Enough to cover — finalize sale immediately
      await finalizeSaleWithPayments(newPayments);
    } else {
      // Partial — accumulate and show remaining
      updateActiveTab({ partialPayments: newPayments });
      setSuccess(`Abono $${amount.toFixed(2)} (${method}). Falta: $${(total - totalPaid).toFixed(2)}`);
    }
  };

  // Finalize sale with accumulated partial payments
  const finalizeSale = async () => {
    if (partialPayments.length === 0) return;
    await finalizeSaleWithPayments(partialPayments);
  };

  const finalizeSaleWithPayments = async (payments: { method: "efectivo" | "tarjeta" | "transferencia" | "credito"; amount: number; reference?: string | null }[]) => {
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

      // Show change amount for 3 seconds
      if (result.change_amount > 0) {
        setChangeDisplay({ amount: result.change_amount, visible: true });
        setTimeout(() => setChangeDisplay({ amount: 0, visible: false }), 3000);
      }

      // Print ticket and open drawer (fire and forget)
      api.printTicket(result.id).catch(() => {});
      if (payments.some((p) => p.method === "efectivo")) {
        api.openCashDrawer().catch(() => {});
      }

      // Clear current tab (keep it, just empty it)
      clearCart();

      setShowPaymentModal(false);
      resetPaymentState();
      focusInput();
    } catch (err) {
      setError(String(err));
    }
  };

  // Customer search
  const handleCustomerSearch = async (query: string) => {
    setCustomerSearch(query);
    if (query.length >= 2) {
      try {
        const results = await api.searchCustomers(query);
        setCustomerResults(results);
      } catch {
        setCustomerResults([]);
      }
    } else {
      setCustomerResults([]);
    }
  };

  // Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+N — New tab (max 3)
    if (e.ctrlKey && e.key === "n") {
      e.preventDefault();
      if (tabs.length < 3) {
        const newTab: SaleTab = { id: nextTabId, cart: [], customer: null, partialPayments: [] };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(nextTabId);
        setNextTabId((prev) => prev + 1);
        setCommand("");
        setSelectedIndex(-1);
      } else {
        setError("Máximo 3 ventas simultáneas");
      }
      return;
    }

    // Ctrl+1/2/3 — Switch tab
    if (e.ctrlKey && ["1", "2", "3"].includes(e.key)) {
      e.preventDefault();
      const tabIndex = parseInt(e.key) - 1;
      if (tabIndex < tabs.length) {
        setActiveTabId(tabs[tabIndex].id);
        setCommand("");
        setSelectedIndex(-1);
      }
      return;
    }

    // F1 - Cash payment (quick from input or modal) / Confirm return in return mode
    if (e.key === "F1") {
      e.preventDefault();
      if (cart.length === 0) return;

      // Return mode: 0+F1 confirms the return
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
        // Quick pay from command bar
        handleQuickPay("efectivo", inputAmount);
      } else if (command.trim() === "") {
        // No amount — if remaining <= 0 complete, else open modal
        if (remaining <= 0 && partialPayments.length > 0) {
          finalizeSale();
        } else {
          setPaymentMode("efectivo");
          setShowPaymentModal(true);
          setTimeout(() => document.getElementById("payment-amount")?.focus(), 50);
        }
      }
      return;
    }

    // F2 - Other payment (quick from input or modal)
    if (e.key === "F2") {
      e.preventDefault();
      if (cart.length === 0) return;

      const inputAmount = parseFloat(command.trim());

      if (!isNaN(inputAmount) && inputAmount > 0) {
        // Quick pay from command bar
        handleQuickPay("tarjeta", inputAmount);
      } else if (command.trim() === "") {
        setPaymentMode("otro");
        setShowPaymentModal(true);
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

    // F4 - Cancel sale
    if (e.key === "F4") {
      e.preventDefault();
      if (cart.length > 0) {
        if (confirm("¿Cancelar la venta completa?")) {
          clearCart();
        }
      }
      return;
    }

    // F5 - Customer search
    if (e.key === "F5") {
      e.preventDefault();
      setShowCustomerModal(true);
      setCustomerSearch("");
      setCustomerResults([]);
      setTimeout(() => document.getElementById("customer-search")?.focus(), 50);
      return;
    }

    // F6 - Toggle return mode
    if (e.key === "F6") {
      e.preventDefault();
      if (returnMode && cart.length === 0) {
        // Exit return mode if cart is empty
        setReturnMode(false);
      } else if (!returnMode && cart.length === 0) {
        // Enter return mode only if cart is empty (no active sale)
        setReturnMode(true);
      } else if (!returnMode) {
        setError("Termina la venta actual antes de hacer una devolución");
      }
      return;
    }

    // F8 - Quick history
    if (e.key === "F8") {
      e.preventDefault();
      api.getRecentSales(20).then((sales) => {
        setHistorySales(sales);
        setHistorySelectedIndex(0);
        setShowHistoryModal(true);
      }).catch(() => setError("Error cargando historial"));
      return;
    }

    // F9 - Reprint ticket
    if (e.key === "F9") {
      e.preventDefault();
      const today = getLocalDate();
      api.getDailySales(today).then((sales) => {
        setReprintSales(sales.map((s) => ({ id: s.id, total: s.total, created_at: s.created_at, payment_method: s.payment_method })));
        setReprintSelectedIndex(0);
        setShowReprintModal(true);
      }).catch(() => setError("Error cargando ventas"));
      return;
    }

    // Arrow navigation when input is empty
    if (command === "" && cart.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev <= 0 ? cart.length - 1 : prev - 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev >= cart.length - 1 ? 0 : prev + 1));
        return;
      }
    }

    // Enter - execute command
    if (e.key === "Enter" && command.trim()) {
      e.preventDefault();
      executeCommand(command);
      return;
    }

    // Escape - deselect (modals handle their own escape)
    if (e.key === "Escape") {
      if (!anyModalOpen) {
        setSelectedIndex(-1);
      }
      return;
    }
  };

  // Global keydown for F-keys (works even without input focus)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["F1", "F2", "F3", "F4", "F5"].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const anyModalOpen = showPaymentModal || showCustomerModal || showPriceModal || showSearchModal || showReprintModal || showCashCutModal || showDeliveryModal || showAmountModal || showHistoryModal || showCreditPayModal || showAdminAuthModal;

  return (
    <div className="flex flex-col h-screen bg-background" onKeyDown={handleKeyDown}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-foreground">POS</h1>
          {returnMode && (
            <span className="px-2 py-0.5 rounded text-xs bg-destructive text-white font-bold animate-pulse">
              DEVOLUCIÓN
            </span>
          )}
          {/* Tabs indicator */}
          {tabs.length > 1 && (
            <div className="flex gap-1">
              {tabs.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTabId(tab.id); setCommand(""); setSelectedIndex(-1); }}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    tab.id === activeTabId
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {i + 1}{tab.cart.length > 0 ? ` (${tab.cart.length})` : ""}
                </button>
              ))}
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            {user?.full_name}
          </span>
          {customer && (
            <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary">
              Cliente: {customer.name}
            </span>
          )}
          {serverConnected !== null && (
            <span className={`px-2 py-0.5 rounded text-xs ${
              serverConnected ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
            }`}>
              {serverConnected ? "● Servidor OK" : "● Sin conexión"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <KeyBadge key_="F1" label="Efectivo" />
            <KeyBadge key_="F2" label="Tarjeta" />
            <KeyBadge key_="F3" label="Eliminar" />
            <KeyBadge key_="F4" label="Cancelar" />
            <KeyBadge key_="F5" label="Cliente" />
            <KeyBadge key_="F6" label="Devolución" />
            <KeyBadge key_="F8" label="Historial" />
            <KeyBadge key_="F9" label="Reimprimir" />
            <KeyBadge key_="Ctrl+N" label="Nueva" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/admin")}
              className="px-3 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Menú
            </button>
            <button
              onClick={logout}
              className="px-3 py-1 rounded text-xs text-destructive hover:bg-accent transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-2 bg-success/10 border-b border-success/30 text-success text-sm">
          {success}
        </div>
      )}

      {/* Cart */}
      <div className="flex-1 overflow-auto">
        {cart.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            {changeDisplay.visible ? (
              <div className="text-center">
                <p className="text-lg text-muted-foreground mb-2">Vueltos:</p>
                <p className="text-6xl font-bold text-success font-mono">${changeDisplay.amount.toFixed(2)}</p>
              </div>
            ) : returnMode ? (
              <div className="text-center">
                <p className="text-2xl text-destructive font-bold mb-2">MODO DEVOLUCIÓN</p>
                <p className="text-muted-foreground">Escanea los productos a devolver</p>
                <p className="text-muted-foreground text-sm mt-1">0 + F1 para confirmar | F6 para salir</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-lg">Escanea un producto para comenzar</p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-card sticky top-0">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">#</th>
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
                  className={`border-b border-border transition-colors ${
                    index === selectedIndex
                      ? "bg-primary/20 border-l-4 border-l-primary"
                      : "hover:bg-card/50"
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
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
        )}
      </div>

      {/* Total bar */}
      {cart.length > 0 && (
        <div className="px-6 py-3 bg-card border-t border-border flex items-center justify-between shrink-0">
          <div>
            <span className="text-sm text-muted-foreground">
              {cart.length} producto{cart.length > 1 ? "s" : ""} | {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground font-mono">${total.toFixed(2)}</p>
            {partialPayments.length > 0 && (
              <div className="text-right mt-1 space-y-0.5">
                <p className="text-sm text-success font-mono">Recibido: ${partialTotal.toFixed(2)}</p>
                <p className="text-sm font-bold text-warning font-mono">Falta: ${remaining.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command Bar */}
      <div className="px-4 py-3 bg-card border-t border-border shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => {
            setCommand(e.target.value);
            if (e.target.value) setSelectedIndex(-1);
          }}
          placeholder="Código de barras | N*código | pv[código] | pv%nombre%"
          className="w-full px-4 py-3 rounded-md bg-input border-2 border-border text-foreground text-lg font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring"
          autoFocus
          disabled={anyModalOpen}
        />
      </div>

      {/* Unified Payment Modal (F1/F2) */}
      {showPaymentModal && (
        <Modal onClose={() => { setShowPaymentModal(false); resetPaymentState(); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-2">Cobrar Venta</h2>
          <p className="text-3xl font-bold text-foreground mb-4 font-mono">Total: ${total.toFixed(2)}</p>

          {/* Payment mode tabs */}
          <div className="flex gap-1 mb-4 bg-secondary/50 p-1 rounded-md">
            {([["efectivo", "Efectivo"], ["otro", "TC/TD/Transf"], ["mixto", "Mixto"]] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  paymentMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Efectivo */}
          {paymentMode === "efectivo" && (
            <div>
              <input
                id="payment-amount"
                type="number"
                step="0.01"
                placeholder="Monto recibido"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePayment(); }}
                className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-xl font-mono mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              {cashAmount && parseFloat(cashAmount) >= total && (
                <p className="text-xl text-success font-bold font-mono mb-3">
                  Cambio: ${(parseFloat(cashAmount) - total).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Otro medio */}
          {paymentMode === "otro" && (
            <div className="space-y-2 mb-3">
              {(["tarjeta", "transferencia"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setOtherMethod(method)}
                  className={`w-full py-3 rounded-md text-sm font-medium transition-colors ${
                    otherMethod === method
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {method === "tarjeta" ? "Tarjeta (TC/TD)" : "Transferencia"}
                </button>
              ))}
              <input
                type="text"
                placeholder="# Referencia / Autorización (opcional)"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePayment(); }}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {/* Mixto */}
          {paymentMode === "mixto" && (
            <div className="space-y-3 mb-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Efectivo</label>
                <input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  placeholder="$0.00"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Otro medio ({otherMethod})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="$0.00"
                  value={otherAmount}
                  onChange={(e) => setOtherAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handlePayment(); }}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-1">
                {(["tarjeta", "transferencia"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setOtherMethod(method)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      otherMethod === method
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {method === "tarjeta" ? "Tarjeta" : "Transferencia"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="# Referencia / Autorización (opcional)"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {/* Summary */}
              {(parseFloat(cashAmount) || 0) + (parseFloat(otherAmount) || 0) > 0 && (
                <div className="text-sm text-muted-foreground border-t border-border pt-2">
                  <p>Efectivo: ${(parseFloat(cashAmount) || 0).toFixed(2)}</p>
                  <p>{otherMethod}: ${(parseFloat(otherAmount) || 0).toFixed(2)}</p>
                  <p className={`font-bold ${
                    (parseFloat(cashAmount) || 0) + (parseFloat(otherAmount) || 0) >= total
                      ? "text-success" : "text-warning"
                  }`}>
                    Suma: ${((parseFloat(cashAmount) || 0) + (parseFloat(otherAmount) || 0)).toFixed(2)} / ${total.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handlePayment}
            className="w-full py-3 rounded-md bg-success text-white font-bold text-lg hover:bg-success/90 transition-colors"
          >
            Confirmar (Enter)
          </button>
        </Modal>
      )}

      {/* Customer Modal (F5) */}
      {showCustomerModal && (
        <Modal onClose={() => { setShowCustomerModal(false); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Asignar Cliente</h2>
          <input
            id="customer-search"
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={customerSearch}
            onChange={(e) => handleCustomerSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setShowCustomerModal(false); focusInput(); }
            }}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <div className="max-h-48 overflow-auto space-y-1">
            {customerResults.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCustomer(c);
                  setShowCustomerModal(false);
                  focusInput();
                }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm text-foreground transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span>{c.name} {c.phone && <span className="text-muted-foreground">— {c.phone}</span>}</span>
                  {c.credit_limit > 0 && (
                    <span className="text-xs text-primary">
                      Crédito: ${(c.credit_limit - c.credit_balance).toFixed(0)} disp.
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {customer && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-sm text-foreground mb-2">
                Cliente: <strong>{customer.name}</strong>
                {customer.credit_limit > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Crédito: ${(customer.credit_limit - customer.credit_balance).toFixed(2)} disponible de ${customer.credit_limit.toFixed(2)})
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {customer.credit_limit > 0 && cart.length > 0 && (
                  <button
                    onClick={async () => {
                      const available = customer.credit_limit - customer.credit_balance;
                      if (total > available + 0.01) {
                        setError(`Crédito insuficiente. Disponible: $${available.toFixed(2)}, Total: $${total.toFixed(2)}`);
                      } else {
                        await finalizeSaleWithPayments([{ method: "credito", amount: total }]);
                        setShowCustomerModal(false);
                      }
                    }}
                    className="flex-1 py-2 rounded-md text-sm bg-warning/20 text-warning font-medium hover:bg-warning/30 transition-colors"
                  >
                    Fiar venta (${total.toFixed(2)})
                  </button>
                )}
                <button
                  onClick={() => {
                    setCustomer(null);
                    setShowCustomerModal(false);
                    focusInput();
                  }}
                  className="flex-1 py-2 rounded-md text-sm text-destructive hover:bg-accent transition-colors"
                >
                  Quitar cliente
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Price Check Modal */}
      {showPriceModal && priceInfo && (
        <Modal onClose={() => { setShowPriceModal(false); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-2">Consulta de Precio</h2>
          <p className="text-foreground">{priceInfo.name}</p>
          <p className="text-3xl font-bold text-primary font-mono mt-2">
            ${priceInfo.sale_price.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Stock: {priceInfo.stock} {priceInfo.unit}
          </p>
          <p className="text-xs text-muted-foreground mt-3">Escape o ✕ para cerrar</p>
        </Modal>
      )}

      {/* Search Results Modal */}
      {showSearchModal && (
        <Modal onClose={() => { setShowSearchModal(false); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Resultados de Búsqueda</h2>
          {searchResults.length === 0 ? (
            <p className="text-muted-foreground">No se encontraron productos</p>
          ) : (
            <div className="max-h-64 overflow-auto space-y-1">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    addToCart(p, 1);
                    setShowSearchModal(false);
                    focusInput();
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors flex justify-between"
                >
                  <span className="text-foreground">{p.name}</span>
                  <span className="text-primary font-mono">${p.sale_price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            {searchResults.length > 0 ? "Click para agregar al carrito" : "Presiona Escape o ✕ para cerrar"}
          </p>
        </Modal>
      )}

      {/* Amount Modal (for "monto" type products) */}
      {showAmountModal && amountProduct && (
        <Modal onClose={() => { setShowAmountModal(false); setAmountProduct(null); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-2">¿Cuánto cuesta?</h2>
          <p className="text-sm text-muted-foreground mb-4">{amountProduct.name}</p>
          <input
            id="product-amount-input"
            type="number"
            step="0.01"
            placeholder="Monto ($)"
            value={productAmount}
            onChange={(e) => setProductAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && productAmount) {
                const amount = parseFloat(productAmount);
                if (amount > 0) {
                  addToCart(amountProduct, 1, amount);
                  setShowAmountModal(false);
                  setAmountProduct(null);
                  setProductAmount("");
                  focusInput();
                }
              }
            }}
            className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-xl font-mono mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <button
            onClick={() => {
              const amount = parseFloat(productAmount);
              if (amount > 0 && amountProduct) {
                addToCart(amountProduct, 1, amount);
                setShowAmountModal(false);
                setAmountProduct(null);
                setProductAmount("");
                focusInput();
              }
            }}
            className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            Agregar
          </button>
        </Modal>
      )}

      {/* Cash Cut Modal (CC command) */}
      {showCashCutModal && cashCutData && (
        <Modal onClose={() => { setShowCashCutModal(false); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Cierre de Caja — {cashCutData.date}</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-secondary/50">
                <p className="text-xs text-muted-foreground">Ventas totales</p>
                <p className="text-lg font-bold font-mono text-foreground">${cashCutData.total_sales.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-md bg-secondary/50">
                <p className="text-xs text-muted-foreground">Transacciones</p>
                <p className="text-lg font-bold font-mono text-foreground">{cashCutData.transactions}</p>
              </div>
            </div>
            <div className="border-t border-border pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Efectivo:</span>
                <span className="font-mono text-success font-bold">${cashCutData.cash_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tarjeta:</span>
                <span className="font-mono text-primary">${cashCutData.card_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transferencia:</span>
                <span className="font-mono text-warning">${cashCutData.transfer_total.toFixed(2)}</span>
              </div>
              {cashCutData.credit_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Crédito (fiado):</span>
                  <span className="font-mono text-destructive">${cashCutData.credit_total.toFixed(2)}</span>
                </div>
              )}
            </div>
            {cashCutData.deliveries_count > 0 && (
              <div className="border-t border-border pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entregas parciales ({cashCutData.deliveries_count}):</span>
                  <span className="font-mono text-warning">-${cashCutData.deliveries_total.toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="border-t border-border pt-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">Efectivo en caja:</span>
                <span className="text-2xl font-bold font-mono text-success">${cashCutData.cash_in_register.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                if (cashCutData) {
                  api.printCashCutReceipt({
                    totalSales: cashCutData.total_sales,
                    transactions: cashCutData.transactions,
                    cashTotal: cashCutData.cash_total,
                    cardTotal: cashCutData.card_total,
                    transferTotal: cashCutData.transfer_total,
                    creditTotal: cashCutData.credit_total,
                    deliveriesTotal: cashCutData.deliveries_total,
                    deliveriesCount: cashCutData.deliveries_count,
                    cashInRegister: cashCutData.cash_in_register,
                  }).then(() => setSuccess("Cierre impreso")).catch((err) => setError(String(err)));
                }
              }}
              className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Imprimir cierre
            </button>
            <button
              onClick={() => { setShowCashCutModal(false); focusInput(); }}
              className="flex-1 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {/* Cash Delivery Modal (EP command) */}
      {showDeliveryModal && (
        <Modal onClose={() => { setShowDeliveryModal(false); setDeliveryAmount(""); setDeliverySupervisor(""); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Entrega Parcial de Efectivo</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Monto a entregar</label>
              <input
                id="delivery-amount"
                type="number"
                step="0.01"
                placeholder="$0.00"
                value={deliveryAmount}
                onChange={(e) => setDeliveryAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Nombre del supervisor</label>
              <input
                type="text"
                placeholder="Nombre de quien recibe"
                value={deliverySupervisor}
                onChange={(e) => setDeliverySupervisor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deliveryAmount) {
                    handleDelivery();
                  }
                }}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleDelivery}
              className="w-full py-3 rounded-md bg-warning text-white font-bold hover:bg-warning/90 transition-colors"
            >
              Registrar entrega e imprimir
            </button>
          </div>
        </Modal>
      )}

      {/* Admin Auth Modal */}
      {showAdminAuthModal && (
        <Modal onClose={() => { setShowAdminAuthModal(false); setAdminPassword(""); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-2">Autorización requerida</h2>
          <p className="text-sm text-muted-foreground mb-4">Ingresa la clave del administrador para continuar</p>
          {adminAuthError && <p className="text-sm text-destructive mb-3">{adminAuthError}</p>}
          <input
            id="admin-auth-input"
            type="password"
            placeholder="Clave de administrador"
            value={adminPassword}
            onChange={(e) => { setAdminPassword(e.target.value); setAdminAuthError(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdminAuth();
            }}
            className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-ring mb-3"
            autoFocus
          />
          <button
            onClick={handleAdminAuth}
            className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            Autorizar
          </button>
        </Modal>
      )}

      {/* History Modal (F8) */}
      {showHistoryModal && (
        <Modal onClose={() => { setShowHistoryModal(false); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Ventas de Hoy</h2>
          {historySales.length === 0 ? (
            <p className="text-muted-foreground">No hay ventas hoy</p>
          ) : (
            <div
              className="max-h-72 overflow-auto space-y-1"
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") { e.preventDefault(); setHistorySelectedIndex((p) => (p <= 0 ? historySales.length - 1 : p - 1)); }
                else if (e.key === "ArrowDown") { e.preventDefault(); setHistorySelectedIndex((p) => (p >= historySales.length - 1 ? 0 : p + 1)); }
                else if (e.key === "Enter") {
                  e.preventDefault();
                  const sale = historySales[historySelectedIndex];
                  if (sale && !sale.cancelled) {
                    requireAdminAuth(() => {
                      const reason = prompt("Motivo de anulación:");
                      if (reason) {
                        api.cancelSale(sale.id, reason).then((r) => {
                          setSuccess(`✅ Venta #${r.sale_id} anulada.`);
                          setShowHistoryModal(false); focusInput();
                        }).catch((err) => setError(String(err)));
                      }
                    });
                  }
                }
              }}
              tabIndex={0}
              ref={(el) => el?.focus()}
            >
              {historySales.map((sale, i) => (
                <div
                  key={sale.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                    i === historySelectedIndex ? "bg-primary/20 border border-primary" : "hover:bg-accent"
                  } ${sale.cancelled ? "opacity-50 line-through" : ""}`}
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">#{sale.id}</span>
                    <span className="text-xs text-muted-foreground ml-2">{sale.created_at.split(" ")[1] || sale.created_at}</span>
                    <span className="text-xs text-muted-foreground ml-2">({sale.items_count} items)</span>
                    {sale.cancelled && <span className="text-xs text-destructive ml-2">ANULADA</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-foreground">${sale.total.toFixed(2)}</span>
                    <span className={`text-xs ml-2 ${
                      sale.payment_method === "efectivo" ? "text-success" :
                      sale.payment_method === "credito" ? "text-destructive" : "text-primary"
                    }`}>{sale.payment_method}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">↑↓ navegar | Enter para anular | Escape cerrar</p>
        </Modal>
      )}

      {/* Credit Payment Modal (AB command) */}
      {showCreditPayModal && (
        <Modal onClose={() => { setShowCreditPayModal(false); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Abono a Crédito</h2>
          {!creditPayCustomer ? (
            <div>
              <input
                id="credit-pay-search"
                type="text"
                placeholder="Buscar cliente por nombre o teléfono..."
                value={creditPaySearch}
                onChange={(e) => {
                  setCreditPaySearch(e.target.value);
                  if (e.target.value.length >= 2) {
                    api.searchCustomers(e.target.value).then(setCreditPayResults).catch(() => {});
                  } else {
                    setCreditPayResults([]);
                  }
                }}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <div className="max-h-40 overflow-auto space-y-1">
                {creditPayResults.filter(c => c.credit_balance > 0).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCreditPayCustomer(c)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors flex justify-between"
                  >
                    <span className="text-foreground">{c.name}</span>
                    <span className="text-warning font-mono">Deuda: ${c.credit_balance.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-secondary/50">
                <p className="text-sm text-foreground font-medium">{creditPayCustomer.name}</p>
                <p className="text-lg font-bold text-warning font-mono">Deuda: ${creditPayCustomer.credit_balance.toFixed(2)}</p>
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="Monto del abono"
                value={creditPayAmount}
                onChange={(e) => setCreditPayAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && creditPayAmount) {
                    api.createCreditPayment(creditPayCustomer.id, parseFloat(creditPayAmount), "efectivo", null)
                      .then((r) => {
                        setSuccess(`✅ Abono de $${r.amount.toFixed(2)} registrado. Nueva deuda: $${r.new_balance.toFixed(2)}`);
                        setShowCreditPayModal(false); focusInput();
                      }).catch((err) => setError(String(err)));
                  }
                }}
                className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-xl font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={() => {
                  if (creditPayAmount && creditPayCustomer) {
                    api.createCreditPayment(creditPayCustomer.id, parseFloat(creditPayAmount), "efectivo", null)
                      .then((r) => {
                        setSuccess(`✅ Abono de $${r.amount.toFixed(2)} registrado. Nueva deuda: $${r.new_balance.toFixed(2)}`);
                        setShowCreditPayModal(false); focusInput();
                      }).catch((err) => setError(String(err)));
                  }
                }}
                className="w-full py-3 rounded-md bg-success text-white font-bold hover:bg-success/90 transition-colors"
              >
                Registrar abono
              </button>
              <button
                onClick={() => setCreditPayCustomer(null)}
                className="w-full py-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                ← Buscar otro cliente
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Reprint Ticket Modal (F9) */}
      {showReprintModal && (
        <Modal onClose={() => { setShowReprintModal(false); focusInput(); }}>
          <h2 className="text-lg font-bold text-foreground mb-4">Reimprimir Ticket</h2>
          {reprintSales.length === 0 ? (
            <p className="text-muted-foreground">No hay ventas hoy</p>
          ) : (
            <div
              className="max-h-72 overflow-auto space-y-1"
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setReprintSelectedIndex((prev) => (prev <= 0 ? reprintSales.length - 1 : prev - 1));
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setReprintSelectedIndex((prev) => (prev >= reprintSales.length - 1 ? 0 : prev + 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const sale = reprintSales[reprintSelectedIndex];
                  if (sale) {
                    api.printTicket(sale.id).then(() => {
                      setSuccess(`Ticket #${sale.id} enviado a imprimir`);
                    }).catch((err) => setError(String(err)));
                    setShowReprintModal(false);
                    focusInput();
                  }
                }
              }}
              tabIndex={0}
              ref={(el) => el?.focus()}
            >
              {reprintSales.map((sale, i) => (
                <div
                  key={sale.id}
                  onClick={() => {
                    api.printTicket(sale.id).then(() => {
                      setSuccess(`Ticket #${sale.id} enviado a imprimir`);
                    }).catch((err) => setError(String(err)));
                    setShowReprintModal(false);
                    focusInput();
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    i === reprintSelectedIndex
                      ? "bg-primary/20 border border-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">Ticket #{sale.id}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {sale.created_at.split(" ")[1] || sale.created_at}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-foreground">${sale.total.toFixed(2)}</span>
                    <span className={`text-xs ml-2 ${
                      sale.payment_method === "efectivo" ? "text-success" :
                      sale.payment_method === "tarjeta" ? "text-primary" : "text-warning"
                    }`}>
                      {sale.payment_method}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">↑↓ para navegar | Enter para reimprimir | Escape para cerrar</p>
        </Modal>
      )}
    </div>
  );
}

// Key badge component for shortcuts
function KeyBadge({ key_, label }: { key_: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1 rounded bg-secondary/80 border border-border min-w-[52px]">
      <span className="text-[10px] font-bold text-foreground">{key_}</span>
      <span className="text-[9px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

// Modal component
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Global escape listener — works regardless of focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="Cerrar"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
