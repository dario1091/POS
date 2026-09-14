import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Supply, Product } from "@/lib/types";

interface RecipeSupplyLine { supply_id: number; supply_name: string; quantity: number; unit: string; }
interface Recipe {
  id: number; product_id: number; product_name: string; yield_quantity: number; created_at: string;
  supplies: RecipeSupplyLine[];
}
interface PossibleProduction {
  recipe_id: number; product_name: string; max_units: number; limiting_supply: string | null;
  details: { supply_name: string; available: number; needed_per_batch: number; unit: string; possible_batches: number }[];
}

export function RecipesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [possible, setPossible] = useState<PossibleProduction[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form
  const [productId, setProductId] = useState(0);
  const [yieldQty, setYieldQty] = useState(1);
  const [lines, setLines] = useState<{ supply_id: number; quantity: number }[]>([]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); }
  }, [success]);

  const loadData = async () => {
    try {
      const [sup, prod, rec, pos] = await Promise.all([
        api.listSupplies(), api.listProducts(), api.listRecipes(), api.calculatePossibleProduction(),
      ]);
      setSupplies(sup);
      setProducts(prod);
      setRecipes(rec);
      setPossible(pos);
    } catch (err) { setError(String(err)); }
  };

  const addLine = () => setLines((p) => [...p, { supply_id: 0, quantity: 0 }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: "supply_id" | "quantity", value: number) =>
    setLines((p) => p.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const handleSave = async () => {
    setError("");
    if (productId === 0) { setError("Selecciona el producto"); return; }
    if (yieldQty <= 0) { setError("El rendimiento debe ser mayor a 0"); return; }
    const validLines = lines.filter((l) => l.supply_id > 0 && l.quantity > 0);
    if (validLines.length === 0) { setError("Agrega al menos un insumo"); return; }
    try {
      await api.createRecipe({ product_id: productId, yield_quantity: yieldQty, supplies: validLines });
      setSuccess("Receta creada");
      setProductId(0);
      setYieldQty(1);
      setLines([]);
      setShowForm(false);
      await loadData();
    } catch (err) { setError(String(err)); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar la receta de "${name}"?`)) return;
    try {
      await api.deleteRecipe(id);
      setSuccess("Receta eliminada");
      await loadData();
    } catch (err) { setError(String(err)); }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Recetas</h1>
        <button
          onClick={() => { setShowForm(!showForm); setProductId(0); setYieldQty(1); setLines([]); }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Cancelar" : "Nueva Receta"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {showForm && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-4">
          <h3 className="text-sm font-medium text-foreground">Nueva receta</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Producto</label>
              <select
                value={productId}
                onChange={(e) => setProductId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={0}>Seleccionar producto</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rendimiento (unidades que produce)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={yieldQty || ""}
                onChange={(e) => setYieldQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Insumos que consume</label>
              <button onClick={addLine} className="text-xs text-primary hover:text-primary/80">+ Agregar insumo</button>
            </div>
            {lines.length === 0 && <p className="text-xs text-muted-foreground">Sin insumos agregados</p>}
            <div className="space-y-2">
              {lines.map((line, i) => {
                const sup = supplies.find((s) => s.id === line.supply_id);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={line.supply_id}
                      onChange={(e) => updateLine(i, "supply_id", Number(e.target.value))}
                      className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value={0}>Seleccionar insumo</option>
                      {supplies.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                    </select>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="Cantidad"
                      value={line.quantity || ""}
                      onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                      className="w-28 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground w-12">{sup?.unit ?? ""}</span>
                    <button onClick={() => removeLine(i)} className="text-destructive text-sm">✕</button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Estos insumos producen {yieldQty || 0} unidad{yieldQty !== 1 ? "es" : ""} del producto.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
          >
            Guardar receta
          </button>
        </div>
      )}

      {/* Producción posible */}
      <div className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-3">Producción posible con el stock actual</h2>
        {possible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Define recetas para ver cuánto puedes producir.</p>
        ) : (
          <div className="space-y-3">
            {possible.map((p) => (
              <div key={p.recipe_id} className="p-3 rounded-md bg-secondary/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{p.product_name}</span>
                  <span className="text-lg font-bold font-mono text-success">{p.max_units} uds</span>
                </div>
                {p.limiting_supply && p.max_units >= 0 && (
                  <p className="text-xs text-warning mt-1">Insumo limitante: {p.limiting_supply}</p>
                )}
                <div className="mt-2 space-y-0.5">
                  {p.details.map((d, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {d.supply_name}: {d.available} {d.unit} disponibles · {d.needed_per_batch} {d.unit}/lote
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recetas definidas */}
      <h2 className="text-lg font-semibold text-foreground mb-3">Recetas definidas</h2>
      <div className="space-y-3">
        {recipes.length === 0 && <p className="text-sm text-muted-foreground">No hay recetas definidas</p>}
        {recipes.map((r) => (
          <div key={r.id} className="p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-bold text-foreground">{r.product_name}</span>
                <span className="text-xs text-muted-foreground ml-2">rinde {r.yield_quantity} uds</span>
              </div>
              <button onClick={() => handleDelete(r.id, r.product_name)} className="text-xs text-destructive hover:text-destructive/80">Eliminar</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.supplies.map((s, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {s.supply_name}: {s.quantity} {s.unit}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
