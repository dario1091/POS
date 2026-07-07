import { useState, useCallback, useEffect } from "react";
import type { Product, Customer, CartItem } from "@/lib/types";

export interface SaleTab {
  id: number;
  cart: CartItem[];
  customer: Customer | null;
  partialPayments: PaymentEntry[];
}

export interface PaymentEntry {
  method: "efectivo" | "tarjeta" | "transferencia" | "credito";
  amount: number;
  reference?: string | null;
}

const CART_STORAGE_KEY = "pos_cart_state";

function loadPersistedState(): { tabs: SaleTab[]; activeTabId: number; nextTabId: number } | null {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function persistState(tabs: SaleTab[], activeTabId: number, nextTabId: number) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ tabs, activeTabId, nextTabId }));
  } catch {}
}

export function useCart() {
  const persisted = loadPersistedState();
  const [tabs, setTabs] = useState<SaleTab[]>(persisted?.tabs ?? [{ id: 1, cart: [], customer: null, partialPayments: [] }]);
  const [activeTabId, setActiveTabId] = useState(persisted?.activeTabId ?? 1);
  const [nextTabId, setNextTabId] = useState(persisted?.nextTabId ?? 2);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [changeDisplay, setChangeDisplay] = useState<{ amount: number; visible: boolean }>({ amount: 0, visible: false });

  // Persist cart state on every change
  useEffect(() => {
    persistState(tabs, activeTabId, nextTabId);
  }, [tabs, activeTabId, nextTabId]);

  // Get current tab data
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const cart = activeTab.cart;
  const customer = activeTab.customer;
  const partialPayments = activeTab.partialPayments;

  // Computed totals
  const total = cart.reduce((sum, item) => sum + item.product.sale_price * item.quantity - item.discount, 0);
  const partialTotal = partialPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - partialTotal;

  // Update current tab helper
  const updateActiveTab = useCallback((updates: Partial<SaleTab>) => {
    setTabs((prev) => prev.map((t) => t.id === activeTabId ? { ...t, ...updates } : t));
  }, [activeTabId]);

  const setCustomer = useCallback((c: Customer | null) => {
    updateActiveTab({ customer: c });
  }, [updateActiveTab]);

  const addToCart = useCallback((product: Product, quantity: number, customPrice?: number) => {
    // Hide change display when new product is added
    if (changeDisplay.visible) {
      setChangeDisplay({ amount: 0, visible: false });
    }

    const price = customPrice ?? product.sale_price;
    const currentCart = tabs.find((t) => t.id === activeTabId)?.cart || [];
    const existing = currentCart.findIndex((item) => item.product.id === product.id && item.product.sale_price === price);

    if (existing >= 0) {
      const updated = [...currentCart];
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + quantity };
      updateActiveTab({ cart: updated });
    } else {
      const productWithPrice = customPrice ? { ...product, sale_price: price } : product;
      updateActiveTab({ cart: [...currentCart, { product: productWithPrice, quantity, discount: 0 }] });
    }
    setSelectedIndex(-1);
  }, [activeTabId, tabs, changeDisplay.visible, updateActiveTab]);

  const removeFromCart = useCallback((index: number) => {
    const currentCart = tabs.find((t) => t.id === activeTabId)?.cart || [];
    updateActiveTab({ cart: currentCart.filter((_, i) => i !== index) });
    setSelectedIndex(-1);
  }, [activeTabId, tabs, updateActiveTab]);

  const clearCart = useCallback(() => {
    updateActiveTab({ cart: [], customer: null, partialPayments: [] });
    setSelectedIndex(-1);
  }, [updateActiveTab]);

  // Tab management
  const addTab = useCallback(() => {
    if (tabs.length >= 3) return false;
    const newTab: SaleTab = { id: nextTabId, cart: [], customer: null, partialPayments: [] };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(nextTabId);
    setNextTabId((prev) => prev + 1);
    setSelectedIndex(-1);
    return true;
  }, [tabs.length, nextTabId]);

  const switchTab = useCallback((index: number) => {
    if (index < tabs.length) {
      setActiveTabId(tabs[index].id);
      setSelectedIndex(-1);
    }
  }, [tabs]);

  const showChange = useCallback((amount: number) => {
    setChangeDisplay({ amount, visible: true });
    setTimeout(() => setChangeDisplay({ amount: 0, visible: false }), 3000);
  }, []);

  return {
    // Tab state
    tabs,
    activeTabId,
    activeTab,
    // Cart state
    cart,
    customer,
    partialPayments,
    selectedIndex,
    changeDisplay,
    // Computed
    total,
    partialTotal,
    remaining,
    // Actions
    setSelectedIndex,
    setCustomer,
    addToCart,
    removeFromCart,
    clearCart,
    updateActiveTab,
    showChange,
    // Tab actions
    addTab,
    switchTab,
    setActiveTabId,
  };
}
