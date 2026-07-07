import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { getLocalDate } from "@/lib/utils";
import type { Product, Customer } from "@/lib/types";

// Hooks
import { useCart } from "@/features/pos/hooks/useCart";
import { usePayment } from "@/features/pos/hooks/usePayment";
import { useCommands } from "@/features/pos/hooks/useCommands";
import { useKeyboard } from "@/features/pos/hooks/useKeyboard";

// Presentation
import { PosHeader } from "@/features/pos/components/PosHeader";
import { CartTable } from "@/features/pos/components/CartTable";

// Modals
import { PaymentModal } from "@/features/pos/modals/PaymentModal";
import { CustomerModal } from "@/features/pos/modals/CustomerModal";
import { PriceModal } from "@/features/pos/modals/PriceModal";
import { SearchModal } from "@/features/pos/modals/SearchModal";
import { AmountModal } from "@/features/pos/modals/AmountModal";
import { HelpModal } from "@/features/pos/modals/HelpModal";
import { AdminAuthModal } from "@/features/pos/modals/AdminAuthModal";
import { CashCutModal } from "@/features/pos/modals/CashCutModal";
import { DeliveryModal } from "@/features/pos/modals/DeliveryModal";
import { HistoryModal } from "@/features/pos/modals/HistoryModal";
import { CreditPayModal } from "@/features/pos/modals/CreditPayModal";
import { ReprintModal } from "@/features/pos/modals/ReprintModal";
import { CancelSaleModal } from "@/features/pos/modals/CancelSaleModal";

export function PosPage() {
  const { user, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Core hooks ---
  const cartHook = useCart();
  const { cart, customer, total, remaining, partialPayments, tabs, activeTabId,
    selectedIndex, changeDisplay, setSelectedIndex, setCustomer, addToCart,
    removeFromCart, clearCart, updateActiveTab, showChange, addTab, switchTab } = cartHook;

  // UI state
  const [command, setCommand] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [returnMode, setReturnMode] = useState(false);

  // Modal visibility states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [showCashCutModal, setShowCashCutModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCreditPayModal, setShowCreditPayModal] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [showCancelSaleModal, setShowCancelSaleModal] = useState(false);
  const [cancelSaleId, setCancelSaleId] = useState<number | null>(null);

  // Modal data
  const [priceInfo, setPriceInfo] = useState<Product | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [amountProduct, setAmountProduct] = useState<Product | null>(null);
  const [cashCutData, setCashCutData] = useState<{
    total_sales: number; transactions: number; cash_total: number; card_total: number;
    transfer_total: number; credit_total: number; deliveries_total: number;
    deliveries_count: number; cash_in_register: number; date: string;
  } | null>(null);
  const [deliveryAmount, setDeliveryAmount] = useState("");
  const [deliverySupervisor, setDeliverySupervisor] = useState("");
  const [historySales, setHistorySales] = useState<{ id: number; total: number; payment_method: string; items_count: number; cancelled: boolean; created_at: string }[]>([]);
  const [reprintSales, setReprintSales] = useState<{ id: number; total: number; created_at: string; payment_method: string }[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthError, setAdminAuthError] = useState("");
  const [adminAuthCallback, setAdminAuthCallback] = useState<(() => void) | null>(null);

  // --- Focus management ---
  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => { focusInput(); }, [focusInput]);

  // --- Server connection check ---
  useEffect(() => {
    const check = async () => {
      try { setServerConnected(await api.checkServerConnection()); }
      catch { setServerConnected(null); }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // --- Auto-clear messages ---
  useEffect(() => { if (error) { const t = setTimeout(() => setError(""), 3000); return () => clearTimeout(t); } }, [error]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); } }, [success]);

  // --- Payment hook ---
  const payment = usePayment({
    cart, customer, total, remaining, partialPayments,
    updateActiveTab, clearCart, showChange, setError, setSuccess, focusInput,
  });

  // --- Admin auth ---
  const requireAdminAuth = useCallback((callback: () => void) => {
    if (user?.role === "admin") { callback(); return; }
    setAdminPassword("");
    setAdminAuthError("");
    setAdminAuthCallback(() => callback);
    setShowAdminAuthModal(true);
    setTimeout(() => document.getElementById("admin-auth-input")?.focus(), 50);
  }, [user]);

  const handleAdminAuth = useCallback(async () => {
    try {
      const valid = await api.validateAdminPassword(adminPassword);
      if (valid) { setShowAdminAuthModal(false); setAdminPassword(""); if (adminAuthCallback) adminAuthCallback(); }
      else { setAdminAuthError("Clave incorrecta"); }
    } catch (err) { setAdminAuthError(String(err)); }
  }, [adminPassword, adminAuthCallback]);

  // --- Return handler ---
  const handleReturn = useCallback(async () => {
    if (cart.length === 0) return;
    try {
      const items = cart.map((item) => ({ product_id: item.product.id, product_name: item.product.name, quantity: item.quantity, unit_price: item.product.sale_price }));
      const result = await api.createReturn(items, null);
      setSuccess(`✅ Devolución #${result.id} registrada. Total devuelto: $${result.total.toFixed(2)}`);
      clearCart();
      setReturnMode(false);
      focusInput();
    } catch (err) { setError(String(err)); }
  }, [cart, clearCart, focusInput, setError, setSuccess]);

  // --- Delivery handler ---
  const handleDelivery = useCallback(async () => {
    const amount = parseFloat(deliveryAmount);
    if (isNaN(amount) || amount <= 0) { setError("Ingresa un monto válido"); return; }
    if (!deliverySupervisor.trim()) { setError("Ingresa el nombre del supervisor que recibe"); return; }
    try {
      const result = await api.createCashDelivery(amount, deliverySupervisor, null);
      setSuccess(`✅ Entrega de $${amount.toFixed(2)} registrada. Recibe: ${deliverySupervisor}`);
      api.printDeliveryReceipt(amount, deliverySupervisor, result.id).catch(() => {});
      setShowDeliveryModal(false);
      setDeliveryAmount("");
      setDeliverySupervisor("");
      focusInput();
    } catch (err) { setError(String(err)); }
  }, [deliveryAmount, deliverySupervisor, focusInput]);

  // --- addToCart wrapper for "monto" products ---
  const addToCartWithAmountCheck = useCallback((product: Product, quantity: number, customPrice?: number) => {
    if (product.price_type === "monto" && !customPrice) {
      setAmountProduct(product);
      setShowAmountModal(true);
      setTimeout(() => document.getElementById("product-amount-input")?.focus(), 50);
      return;
    }
    addToCart(product, quantity, customPrice);
  }, [addToCart]);

  // --- Commands hook ---
  const { executeCommand } = useCommands({
    addToCart: addToCartWithAmountCheck, setError, setSuccess, setCommand,
    openCashCut: (data) => { setCashCutData(data); setShowCashCutModal(true); },
    openCreditPay: () => { setShowCreditPayModal(true); setTimeout(() => document.getElementById("credit-pay-search")?.focus(), 50); },
    openDelivery: (amount) => { if (amount) setDeliveryAmount(amount); setShowDeliveryModal(true); setTimeout(() => document.getElementById("delivery-amount")?.focus(), 50); },
    openSearch: (results) => { setSearchResults(results); setShowSearchModal(true); },
    openPriceCheck: (product) => { setPriceInfo(product); setShowPriceModal(true); },
    openCancelSale: (saleId) => { setCancelSaleId(saleId); setShowCancelSaleModal(true); },
    requireAdminAuth,
  });

  // --- addToCart wrapper for "monto" products ---
  // --- Customer search handler ---
  const handleCustomerSearch = useCallback(async (query: string) => {
    setCustomerSearch(query);
    if (query.length >= 2) {
      try { setCustomerResults(await api.searchCustomers(query)); } catch { setCustomerResults([]); }
    } else { setCustomerResults([]); }
  }, []);

  // --- Keyboard hook ---
  const anyModalOpen = payment.showPaymentModal || showCustomerModal || showPriceModal ||
    showSearchModal || showAmountModal || showCashCutModal || showDeliveryModal ||
    showHistoryModal || showCreditPayModal || showReprintModal || showHelpModal || showAdminAuthModal || showCancelSaleModal;

  const { handleKeyDown } = useKeyboard({
    cart, command, selectedIndex, returnMode, partialPayments, remaining, tabs, user, anyModalOpen,
    setCommand, setSelectedIndex, setError, setSuccess, setReturnMode,
    executeCommand, removeFromCart, clearCart, addTab, switchTab,
    handleQuickPay: payment.handleQuickPay,
    finalizeSale: payment.finalizeSale,
    openPaymentModal: payment.openPaymentModal,
    openCustomerModal: () => { setShowCustomerModal(true); setCustomerSearch(""); setCustomerResults([]); setTimeout(() => document.getElementById("customer-search")?.focus(), 50); },
    openHistoryModal: () => { api.getRecentSales(20).then((sales) => { setHistorySales(sales); setShowHistoryModal(true); }).catch(() => setError("Error cargando historial")); },
    openReprintModal: () => { api.getDailySales(getLocalDate()).then((sales) => { setReprintSales(sales.map((s) => ({ id: s.id, total: s.total, created_at: s.created_at, payment_method: s.payment_method }))); setShowReprintModal(true); }).catch(() => setError("Error cargando ventas")); },
    openHelpModal: () => setShowHelpModal(true),
    requireAdminAuth,
    handleReturn,
  });

  // --- Render ---
  return (
    <div className="flex flex-col h-screen bg-background" onKeyDown={handleKeyDown}>
      <PosHeader
        userName={user?.full_name || ""}
        returnMode={returnMode}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={(id) => { cartHook.setActiveTabId(id); setCommand(""); setSelectedIndex(-1); }}
        customer={customer}
        serverConnected={serverConnected}
        onLogout={logout}
      />

      {/* Messages */}
      {error && <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30 text-destructive text-sm">{error}</div>}
      {success && <div className="px-4 py-2 bg-success/10 border-b border-success/30 text-success text-sm">{success}</div>}

      {/* Cart area */}
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
          <CartTable cart={cart} selectedIndex={selectedIndex} />
        )}
      </div>

      {/* Total bar */}
      {cart.length > 0 && (
        <div className="px-6 py-3 bg-card border-t border-border flex items-center justify-between shrink-0">
          <span className="text-sm text-muted-foreground">
            {cart.length} producto{cart.length > 1 ? "s" : ""} | {cart.reduce((s, i) => s + i.quantity, 0)} items
          </span>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground font-mono">${total.toFixed(2)}</p>
            {partialPayments.length > 0 && (
              <div className="text-right mt-1 space-y-0.5">
                <p className="text-sm text-success font-mono">Recibido: ${cartHook.partialTotal.toFixed(2)}</p>
                <p className="text-sm font-bold text-warning font-mono">Falta: ${remaining.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command bar */}
      <div className="px-4 py-3 bg-card border-t border-border shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => { setCommand(e.target.value); if (e.target.value) setSelectedIndex(-1); }}
          placeholder="Código de barras | N*código | pv[código] | pv nombre"
          className="w-full px-4 py-3 rounded-md bg-input border-2 border-border text-foreground text-lg font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring"
          autoFocus
          disabled={anyModalOpen}
        />
      </div>

      {/* --- Modals --- */}
      <PaymentModal
        show={payment.showPaymentModal}
        total={total}
        paymentMode={payment.paymentMode}
        cashAmount={payment.cashAmount}
        otherMethod={payment.otherMethod}
        otherAmount={payment.otherAmount}
        paymentReference={payment.paymentReference}
        onPaymentModeChange={payment.setPaymentMode}
        onCashAmountChange={payment.setCashAmount}
        onOtherMethodChange={payment.setOtherMethod}
        onOtherAmountChange={payment.setOtherAmount}
        onPaymentReferenceChange={payment.setPaymentReference}
        onConfirm={payment.handlePayment}
        onClose={payment.closePaymentModal}
      />
      <CustomerModal
        show={showCustomerModal}
        customer={customer}
        customerSearch={customerSearch}
        customerResults={customerResults}
        cart={cart}
        total={total}
        onSearchChange={handleCustomerSearch}
        onSelectCustomer={(c) => { setCustomer(c); setShowCustomerModal(false); focusInput(); }}
        onRemoveCustomer={() => { setCustomer(null); setShowCustomerModal(false); focusInput(); }}
        onFiarVenta={async () => {
          if (!customer) return;
          const available = customer.credit_limit - customer.credit_balance;
          if (total > available + 0.01) { setError(`Crédito insuficiente. Disponible: $${available.toFixed(2)}, Total: $${total.toFixed(2)}`); return; }
          await payment.finalizeSaleWithPayments([{ method: "credito", amount: total }]);
          setShowCustomerModal(false);
        }}
        onClose={() => { setShowCustomerModal(false); focusInput(); }}
      />
      <PriceModal show={showPriceModal} product={priceInfo} onClose={() => { setShowPriceModal(false); focusInput(); }} />
      <SearchModal
        show={showSearchModal}
        results={searchResults}
        onSelect={(p) => { addToCartWithAmountCheck(p, 1); setShowSearchModal(false); focusInput(); }}
        onClose={() => { setShowSearchModal(false); focusInput(); }}
      />
      <AmountModal
        show={showAmountModal}
        product={amountProduct}
        onConfirm={(p, amount) => { addToCart(p, 1, amount); setShowAmountModal(false); setAmountProduct(null); focusInput(); }}
        onClose={() => { setShowAmountModal(false); setAmountProduct(null); focusInput(); }}
      />
      <CashCutModal
        show={showCashCutModal}
        data={cashCutData}
        onPrint={() => {
          if (cashCutData) {
            // Register the cash cut so next CC starts from this point
            api.createCashCut(cashCutData.cash_in_register, "Cierre desde POS").catch(() => {});
            api.printCashCutReceipt({ totalSales: cashCutData.total_sales, transactions: cashCutData.transactions, cashTotal: cashCutData.cash_total, cardTotal: cashCutData.card_total, transferTotal: cashCutData.transfer_total, creditTotal: cashCutData.credit_total, deliveriesTotal: cashCutData.deliveries_total, deliveriesCount: cashCutData.deliveries_count, cashInRegister: cashCutData.cash_in_register })
              .then(() => setSuccess("Cierre registrado e impreso")).catch((err) => setError(String(err)));
          }
        }}
        onClose={() => { setShowCashCutModal(false); focusInput(); }}
      />
      <DeliveryModal
        show={showDeliveryModal}
        amount={deliveryAmount}
        supervisor={deliverySupervisor}
        onAmountChange={setDeliveryAmount}
        onSupervisorChange={setDeliverySupervisor}
        onConfirm={handleDelivery}
        onClose={() => { setShowDeliveryModal(false); setDeliveryAmount(""); setDeliverySupervisor(""); focusInput(); }}
      />
      <HistoryModal
        show={showHistoryModal}
        sales={historySales}
        onCancelSale={(saleId) => {
          setShowHistoryModal(false);
          requireAdminAuth(() => {
            setCancelSaleId(saleId);
            setShowCancelSaleModal(true);
          });
        }}
        onClose={() => { setShowHistoryModal(false); focusInput(); }}
      />
      <CreditPayModal
        show={showCreditPayModal}
        onSuccess={(msg) => { setSuccess(msg); focusInput(); }}
        onError={setError}
        onClose={() => { setShowCreditPayModal(false); focusInput(); }}
      />
      <ReprintModal
        show={showReprintModal}
        sales={reprintSales}
        onSuccess={(msg) => { setSuccess(msg); focusInput(); }}
        onError={setError}
        onClose={() => { setShowReprintModal(false); focusInput(); }}
      />
      <HelpModal show={showHelpModal} onClose={() => { setShowHelpModal(false); focusInput(); }} />
      <AdminAuthModal
        show={showAdminAuthModal}
        password={adminPassword}
        error={adminAuthError}
        onPasswordChange={(v) => { setAdminPassword(v); setAdminAuthError(""); }}
        onConfirm={handleAdminAuth}
        onClose={() => { setShowAdminAuthModal(false); setAdminPassword(""); focusInput(); }}
      />
      <CancelSaleModal
        show={showCancelSaleModal}
        saleId={cancelSaleId}
        onConfirm={(saleId, reason) => {
          api.cancelSale(saleId, reason).then((r) => {
            setSuccess(`✅ Venta #${r.sale_id} anulada. Stock restaurado (${r.items_restored} items). Total: $${r.total_restored.toFixed(2)}`);
          }).catch((err) => setError(String(err)));
          setShowCancelSaleModal(false);
          setCancelSaleId(null);
          focusInput();
        }}
        onClose={() => { setShowCancelSaleModal(false); setCancelSaleId(null); focusInput(); }}
      />
    </div>
  );
}
