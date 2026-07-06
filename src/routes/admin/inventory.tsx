import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

interface BulkItem {
  product_id: number;
  barcode: string;
  name: string;
  current_stock: number;
  quantity: number;
  sale_price: number;
  cost_price: number;
}

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showBulkAdjust, setShowBulkAdjust] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [reason, setReason] = useState("Ajuste de inventario");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // Single adjust state (legacy)
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [adjustType, setAdjustType] = useState<"entrada" | "salida">("entrada");
  const [quantity, setQuantity] = useState("");
  const [singleReason, setSingleReason] = useState("");

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

  // --- Bulk adjust logic ---
  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !scanInput.trim()) return;

    const code = scanInput.trim();
    setScanInput("");
    setError("");

    // Check if already in the list
    const existing = bulkItems.find((item) => item.barcode === code);
    if (existing) {
      setBulkItems((prev) =>
        prev.map((item) =>
          item.barcode === code
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
      return;
    }

    // Search product by barcode
    const product = await api.searchProductByCode(code);
    if (!product) {
      setError(`Producto no encontrado: ${code}`);
      return;
    }

    setBulkItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        barcode: code,
        name: product.name,
        current_stock: product.stock,
        quantity: 1,
        sale_price: product.sale_price,
        cost_price: product.cost_price,
      },
    ]);
  };

  const updateBulkItem = (
    index: number,
    field: "quantity" | "sale_price" | "cost_price",
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setBulkItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: numValue } : item
      )
    );
  };

  const removeBulkItem = (index: number) => {
    setBulkItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBulkAdjust = async () => {
    if (bulkItems.length === 0) {
      setError("No hay productos para ajustar");
      return;
    }
    if (!reason.trim()) {
      setError("Ingresa un motivo para el ajuste");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const items = bulkItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        sale_price: item.sale_price,
        cost_price: item.cost_price,
      }));
      const count = await api.bulkAdjustInventory(items, reason.trim());
      setSuccess(`✓ ${count} productos ajustados correctamente`);
      setBulkItems([]);
      await loadProducts();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // --- Single adjust logic (legacy) ---
  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (!query.trim()) {
      setProductResults([]);
      return;
    }
    const byCode = await api.searchProductByCode(query.trim());
    if (byCode) {
      setSelectedProduct(byCode.id);
      setSelectedProductName(`${byCode.name} (Stock: ${byCode.stock})`);
      setProductSearch("");
      setProductResults([]);
      return;
    }
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
    if (!selectedProduct || !quantity || !singleReason) {
      setError("Completa todos los campos");
      return;
    }
    setError("");
    try {
      await api.adjustInventory({
        product_id: selectedProduct,
        adjustment_type: adjustType,
        quantity: Number(quantity),
        reason: singleReason,
      });
      setSuccess("Ajuste realizado correctamente");
      setShowAdjust(false);
      setSelectedProduct(null);
      setQuantity("");
      setSingleReason("");
      await loadProducts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(String(err));
    }
  };

  const lowStockProducts = products.filter(
    (p) => p.min_stock > 0 && p.stock <= p.min_stock
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowBulkAdjust(!showBulkAdjust);
              setShowAdjust(false);
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {showBulkAdjust ? "Cerrar Lote" : "Ajuste en Lote"}
          </button>
          <button
            onClick={() => {
              setShowAdjust(!showAdjust);
              setShowBulkAdjust(false);
            }}
            className="px-4 py-2 rounded-md bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            {showAdjust ? "Cancelar" : "Ajuste Individual"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {/* Bulk Adjust Panel */}
      {showBulkAdjust && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Ajuste en lote — Escanea productos
            </h3>
            <span className="text-xs text-muted-foreground">
              {bulkItems.length} producto{bulkItems.length !== 1 ? "s" : ""} en
              lista
            </span>
          </div>

          {/* Scan input */}
          <div className="flex gap-3">
            <input
              ref={scanRef}
              type="text"
              placeholder="Escanear código de barras..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScan}
              className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <input
              type="text"
              placeholder="Motivo del ajuste"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-64 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Editable table */}
          {bulkItems.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Código
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Stock actual
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Cantidad
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      P. Venta
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      Costo
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      —
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bulkItems.map((item, index) => (
                    <tr
                      key={item.product_id}
                      className="border-b border-border hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                        {item.barcode}
                      </td>
                      <td className="px-3 py-2 text-sm text-foreground">
                        {item.name}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-mono text-muted-foreground">
                        {item.current_stock}
                      </td>
                      <td className="px-3 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateBulkItem(index, "quantity", e.target.value)
                          }
                          className="w-20 px-2 py-1 rounded bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-1 text-right">
                        <input
                          type="number"
                          step="1"
                          value={item.sale_price}
                          onChange={(e) =>
                            updateBulkItem(index, "sale_price", e.target.value)
                          }
                          className="w-24 px-2 py-1 rounded bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-1 text-right">
                        <input
                          type="number"
                          step="1"
                          value={item.cost_price}
                          onChange={(e) =>
                            updateBulkItem(index, "cost_price", e.target.value)
                          }
                          className="w-24 px-2 py-1 rounded bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-1 text-center">
                        <button
                          onClick={() => removeBulkItem(index)}
                          className="text-destructive hover:text-destructive/80 text-sm"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action buttons */}
          {bulkItems.length > 0 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setBulkItems([])}
                className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpiar lista
              </button>
              <button
                onClick={handleBulkAdjust}
                disabled={loading}
                className="px-6 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                {loading
                  ? "Ajustando..."
                  : `Ajustar inventario (${bulkItems.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Single Adjust Panel (legacy) */}
      {showAdjust && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            Ajuste individual
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              {selectedProduct ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-input border border-border">
                  <span className="text-sm text-foreground flex-1">
                    {selectedProductName}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      setSelectedProductName("");
                    }}
                    className="text-xs text-destructive"
                  >
                    ✕
                  </button>
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
                          {p.name}{" "}
                          <span className="text-muted-foreground">
                            (Stock: {p.stock})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <select
              value={adjustType}
              onChange={(e) =>
                setAdjustType(e.target.value as "entrada" | "salida")
              }
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
              value={singleReason}
              onChange={(e) => setSingleReason(e.target.value)}
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
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Ref
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Producto
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Stock
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Mínimo
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Unidad
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isLow =
                product.min_stock > 0 && product.stock <= product.min_stock;
              return (
                <tr
                  key={product.id}
                  className="border-b border-border hover:bg-card/50"
                >
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {product.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {product.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                    {product.stock}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-muted-foreground">
                    {product.min_stock}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {product.unit}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isLow
                          ? "bg-warning/20 text-warning"
                          : "bg-success/20 text-success"
                      }`}
                    >
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
