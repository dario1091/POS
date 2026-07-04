import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Product, CreateProduct, Category, ProductBarcode } from "@/lib/types";

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [barcodesProductId, setBarcodesProductId] = useState<number | null>(null);
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
  const [newBarcode, setNewBarcode] = useState("");
  const [newBarcodeLabel, setNewBarcodeLabel] = useState("");

  const emptyForm: CreateProduct = {
    barcode: null,
    name: "",
    description: null,
    category_id: null,
    sale_price: 0,
    cost_price: 0,
    stock: 0,
    unit: "pieza",
    min_stock: 0,
  };

  const [formData, setFormData] = useState<CreateProduct>(emptyForm);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await api.listProducts();
      setProducts(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.listCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    setError("");
    try {
      if (editingId) {
        await api.updateProduct({
          id: editingId,
          barcode: formData.barcode ?? undefined,
          name: formData.name,
          description: formData.description ?? undefined,
          category_id: formData.category_id ?? undefined,
          sale_price: formData.sale_price,
          cost_price: formData.cost_price,
          unit: formData.unit,
          min_stock: formData.min_stock,
        });
      } else {
        await api.createProduct(formData);
      }
      setFormData(emptyForm);
      setShowForm(false);
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      category_id: product.category_id,
      sale_price: product.sale_price,
      cost_price: product.cost_price,
      stock: product.stock,
      unit: product.unit,
      min_stock: product.min_stock,
    });
    setShowForm(true);
  };

  const handleOpenBarcodes = async (productId: number) => {
    setBarcodesProductId(productId);
    try {
      const data = await api.getProductBarcodes(productId);
      setBarcodes(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleAddBarcode = async () => {
    if (!barcodesProductId || !newBarcode) return;
    setError("");
    try {
      await api.addProductBarcode({
        product_id: barcodesProductId,
        barcode: newBarcode,
        label: newBarcodeLabel || null,
      });
      setNewBarcode("");
      setNewBarcodeLabel("");
      const data = await api.getProductBarcodes(barcodesProductId);
      setBarcodes(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRemoveBarcode = async (barcodeId: number) => {
    if (!barcodesProductId) return;
    try {
      await api.removeProductBarcode(barcodeId);
      const data = await api.getProductBarcodes(barcodesProductId);
      setBarcodes(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const filteredProducts = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode?.includes(search) ||
          p.id.toString() === search
      )
    : products;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Productos</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData(emptyForm);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Cancelar" : "Nuevo Producto"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {showForm && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {editingId ? "Editar Producto" : "Nuevo Producto"}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Código de barras"
              value={formData.barcode ?? ""}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value || null })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Nombre *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={formData.category_id ?? ""}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value ? Number(e.target.value) : null })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Precio venta *"
              value={formData.sale_price || ""}
              onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Precio costo"
              value={formData.cost_price || ""}
              onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Stock inicial"
              value={formData.stock || ""}
              onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value as "pieza" | "kg" })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="pieza">Pieza</option>
              <option value="kg">Kilogramo</option>
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Stock mínimo"
              value={formData.min_stock || ""}
              onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
          >
            {editingId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, código de barras o referencia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">Ref</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-32">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-24">Categoría</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-24">P. Venta</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-16">Stock</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-16">Unidad</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const isLowStock = product.stock <= product.min_stock && product.min_stock > 0;
              const categoryName = categories.find((c) => c.id === product.category_id)?.name ?? "-";
              return (
                <tr key={product.id} className="border-b border-border hover:bg-card/50">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{product.id}</td>
                  <td className="px-4 py-3 text-sm text-foreground font-mono">{product.barcode ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-foreground truncate" title={product.name}>{product.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{categoryName}</td>
                  <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
                    ${product.sale_price.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-mono ${isLowStock ? "text-warning font-bold" : "text-foreground"}`}>
                    {product.stock}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{product.unit}</td>
                  <td className="px-4 py-3 text-sm space-x-3">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleOpenBarcodes(product.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Códigos
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">No hay productos</p>
        )}
      </div>

      {/* Barcodes panel */}
      {barcodesProductId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setBarcodesProductId(null); }}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">
                Códigos de barras — {products.find((p) => p.id === barcodesProductId)?.name}
              </h2>
              <button onClick={() => setBarcodesProductId(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            {/* Existing barcodes */}
            <div className="space-y-2 mb-4 max-h-48 overflow-auto">
              {barcodes.length === 0 && <p className="text-sm text-muted-foreground">Sin códigos de barras asignados</p>}
              {barcodes.map((bc) => (
                <div key={bc.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary/50">
                  <div>
                    <span className="text-sm font-mono text-foreground">{bc.barcode}</span>
                    {bc.label && <span className="text-xs text-muted-foreground ml-2">({bc.label})</span>}
                  </div>
                  <button
                    onClick={() => handleRemoveBarcode(bc.id)}
                    className="text-xs text-destructive hover:text-destructive/80"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>

            {/* Add new barcode */}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Código de barras"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddBarcode(); }}
                  className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Etiqueta"
                  value={newBarcodeLabel}
                  onChange={(e) => setNewBarcodeLabel(e.target.value)}
                  className="w-28 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleAddBarcode}
                className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Agregar código
              </button>
              <p className="text-xs text-muted-foreground">
                Puedes escanear el código directamente en el campo de arriba.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
