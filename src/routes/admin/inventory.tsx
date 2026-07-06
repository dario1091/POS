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

  // CSV import state
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvValidation, setCsvValidation] = useState<{
    valid_count: number;
    error_count: number;
    warnings: string[];
    errors: { row: number; field: string; message: string }[];
    rows: { row_number: number; barcode: string | null; name: string; sale_price: number; cost_price: number; stock: number; category: string; unit: string; price_type: string; valid: boolean }[];
  } | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // --- CSV Import logic ---
  const handleCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvLoading(true);
    setError("");
    setCsvValidation(null);

    try {
      const content = await file.text();
      const result = await api.validateCsvProducts(content);
      setCsvValidation(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setCsvLoading(false);
    }

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCsvImport = async () => {
    if (!csvValidation) return;
    const validRows = csvValidation.rows.filter((r) => r.valid);
    if (validRows.length === 0) {
      setError("No hay productos válidos para importar");
      return;
    }

    setCsvLoading(true);
    setError("");
    try {
      const count = await api.importCsvProducts(validRows);
      setSuccess(`✅ ${count} productos importados correctamente`);
      setCsvValidation(null);
      setCsvFileName("");
      await loadProducts();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(String(err));
    } finally {
      setCsvLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `código_barras,nombre,precio_venta,precio_costo,stock,categoría,unidad,tipo_precio
7702004003478,Aceite Girasol 1L,12500,9800,24,Víveres,pieza,fijo
7501234567890,Arroz Diana 5kg,18900,15000,50,Víveres,pieza,fijo
,Queso campesino,32000,25000,10,Lácteos,kg,bascula
`;
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_productos.csv";
    a.click();
    URL.revokeObjectURL(url);
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
              setShowCsvImport(!showCsvImport);
              setShowBulkAdjust(false);
              setShowAdjust(false);
            }}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
          >
            {showCsvImport ? "Cerrar CSV" : "📁 Cargar CSV"}
          </button>
          <button
            onClick={() => {
              setShowBulkAdjust(!showBulkAdjust);
              setShowAdjust(false);
              setShowCsvImport(false);
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {showBulkAdjust ? "Cerrar Lote" : "Ajuste en Lote"}
          </button>
          <button
            onClick={() => {
              setShowAdjust(!showAdjust);
              setShowBulkAdjust(false);
              setShowCsvImport(false);
            }}
            className="px-4 py-2 rounded-md bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            {showAdjust ? "Cancelar" : "Ajuste Individual"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {/* CSV Import Panel */}
      {showCsvImport && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Importar productos desde CSV</h3>
            <button
              onClick={downloadTemplate}
              className="px-3 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              📥 Descargar plantilla
            </button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 p-3 rounded-md">
            <p className="font-bold text-foreground mb-2">📋 Instrucciones:</p>
            <p>1. Descarga la plantilla → ábrela en Excel</p>
            <p>2. Llena los productos (solo <strong>nombre</strong> y <strong>precio_venta</strong> son obligatorios)</p>
            <p>3. En Excel: <strong>Archivo → Guardar como → CSV (delimitado por comas)</strong></p>
            <p>4. Sube el archivo .csv aquí</p>
            <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
              <strong>Columnas:</strong> código_barras, nombre, precio_venta, precio_costo, stock, categoría, unidad, tipo_precio
            </p>
            <p><strong>unidad:</strong> pieza | kg — <strong>tipo_precio:</strong> fijo | bascula | monto</p>
            <p><strong>categoría:</strong> si no existe se crea automáticamente. Si vacía → "General"</p>
            <p className="mt-1 text-warning">⚠️ Los códigos de barras en Excel deben tener formato TEXTO para que no se conviertan a notación científica (7.7E+12)</p>
          </div>

          {/* File input */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Seleccionar archivo CSV
            </button>
            {csvFileName && <span className="text-sm text-muted-foreground">{csvFileName}</span>}
            {csvLoading && <span className="text-sm text-muted-foreground animate-pulse">Procesando...</span>}
          </div>

          {/* Validation results */}
          {csvValidation && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex gap-4 text-sm">
                <span className="text-success font-medium">✅ {csvValidation.valid_count} válidos</span>
                {csvValidation.error_count > 0 && (
                  <span className="text-destructive font-medium">❌ {csvValidation.error_count} con errores</span>
                )}
                {csvValidation.warnings.length > 0 && (
                  <span className="text-warning font-medium">⚠️ {csvValidation.warnings.length} advertencias</span>
                )}
              </div>

              {/* Errors */}
              {csvValidation.errors.length > 0 && (
                <div className="max-h-32 overflow-auto rounded-md bg-destructive/10 border border-destructive/30 p-3">
                  <p className="text-xs font-bold text-destructive mb-1">Errores:</p>
                  {csvValidation.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Fila {err.row} ({err.field}): {err.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {csvValidation.warnings.length > 0 && (
                <div className="max-h-24 overflow-auto rounded-md bg-warning/10 border border-warning/30 p-3">
                  <p className="text-xs font-bold text-warning mb-1">Advertencias:</p>
                  {csvValidation.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-warning">{w}</p>
                  ))}
                </div>
              )}

              {/* Preview table (first 10 valid rows) */}
              {csvValidation.valid_count > 0 && (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b border-border">
                        <th className="px-2 py-1 text-left text-xs text-muted-foreground">Código</th>
                        <th className="px-2 py-1 text-left text-xs text-muted-foreground">Nombre</th>
                        <th className="px-2 py-1 text-right text-xs text-muted-foreground">Precio</th>
                        <th className="px-2 py-1 text-right text-xs text-muted-foreground">Stock</th>
                        <th className="px-2 py-1 text-left text-xs text-muted-foreground">Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvValidation.rows.filter(r => r.valid).slice(0, 10).map((row) => (
                        <tr key={row.row_number} className="border-b border-border">
                          <td className="px-2 py-1 text-xs font-mono text-muted-foreground">{row.barcode || "—"}</td>
                          <td className="px-2 py-1 text-xs text-foreground">{row.name}</td>
                          <td className="px-2 py-1 text-xs text-right font-mono">${row.sale_price.toFixed(0)}</td>
                          <td className="px-2 py-1 text-xs text-right font-mono">{row.stock}</td>
                          <td className="px-2 py-1 text-xs text-muted-foreground">{row.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvValidation.valid_count > 10 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground bg-muted/30">
                      ... y {csvValidation.valid_count - 10} productos más
                    </p>
                  )}
                </div>
              )}

              {/* Import button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setCsvValidation(null); setCsvFileName(""); }}
                  className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCsvImport}
                  disabled={csvLoading || csvValidation.valid_count === 0}
                  className="px-6 py-2 rounded-md bg-success text-white text-sm font-bold hover:bg-success/90 transition-colors disabled:opacity-50"
                >
                  {csvLoading ? "Importando..." : `Importar ${csvValidation.valid_count} productos`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
