import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [adjustType, setAdjustType] = useState<"entrada" | "salida">("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await api.listProducts();
      setProducts(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (!query.trim()) {
      setProductResults([]);
      return;
    }
    // Try barcode first
    const byCode = await api.searchProductByCode(query.trim());
    if (byCode) {
      setSelectedProduct(byCode.id);
      setSelectedProductName(`${byCode.name} (Stock: ${byCode.stock})`);
      setProductSearch("");
      setProductResults([]);
      return;
    }
    // Then search by name
    if (query.length >= 2) {
      const results = await api.searchProductsByName(query);
      setProductResults(results);
    }
  };

  const selectProductForAdjust = (product: Product) => {
    setSelectedProduct(product.id);
    setSelectedProductName(`${product.name} (Stock: ${product.stock})`);
    setProductSearch("");
    setProductResults([]);
  };

  const handleAdjust = async () => {
    if (!selectedProduct || !quantity || !reason) {
      setError("Completa todos los campos");
      return;
    }
    setError("");
    try {
      await api.adjustInventory({
        product_id: selectedProduct,
        adjustment_type: adjustType,
        quantity: Number(quantity),
        reason,
      });
      setSuccess("Ajuste realizado correctamente");
      setShowAdjust(false);
      setSelectedProduct(null);
      setQuantity("");
      setReason("");
      await loadProducts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(String(err));
    }
  };

  const lowStockProducts = products.filter((p) => p.min_stock > 0 && p.stock <= p.min_stock);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
        <button
          onClick={() => setShowAdjust(!showAdjust)}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showAdjust ? "Cancelar" : "Ajustar Stock"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {showAdjust && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-3">
          <h3 className="text-sm font-medium text-foreground">Ajuste de inventario</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              {selectedProduct ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-input border border-border">
                  <span className="text-sm text-foreground flex-1">{selectedProductName}</span>
                  <button
                    onClick={() => { setSelectedProduct(null); setSelectedProductName(""); }}
                    className="text-xs text-destructive"
                  >✕</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Escanear barcode o buscar por nombre..."
                    value={productSearch}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  {productResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-40 overflow-auto">
                      {productResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectProductForAdjust(p)}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                        >
                          {p.name} <span className="text-muted-foreground">(Stock: {p.stock})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as "entrada" | "salida")}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Cantidad"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Motivo *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleAdjust}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
          >
            Aplicar ajuste
          </button>
        </div>
      )}

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-warning/10 border border-warning/30">
          <h3 className="text-sm font-bold text-warning mb-2">
            ⚠️ Productos con stock bajo ({lowStockProducts.length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="text-sm text-foreground">
                <span className="font-medium">{p.name}</span>
                <span className="text-warning ml-2">
                  Stock: {p.stock} / Mín: {p.min_stock}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Ref</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Producto</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Stock</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Mínimo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Unidad</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isLow = product.min_stock > 0 && product.stock <= product.min_stock;
              return (
                <tr key={product.id} className="border-b border-border hover:bg-card/50">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{product.id}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{product.name}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{product.stock}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-muted-foreground">{product.min_stock}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{product.unit}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      isLow ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                    }`}>
                      {isLow ? "Bajo" : "OK"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
