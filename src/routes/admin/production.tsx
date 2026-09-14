import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Supply, Product } from "@/lib/types";

interface SupplyLine { supply_id: number; quantity: number; }
interface ItemLine { product_id: number; quantity: number; }

interface ProductionSummary {
  id: number; notes: string | null; total_supply_cost: number;
  supplies_count: number; items_count: number; created_at: string;
}

export function ProductionPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<ProductionSummary[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [supplyLines, setSupplyLines] = useState<SupplyLine[]>([]);
  const [itemLines, setItemLines] = useState<ItemLine[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 5000); return () => clearTimeout(t); }
  }, [success]);

  const loadData = async () => {
    try {
      const [sup, prod, hist] = await Promise.all([
        api.listSupplies(),
        api.listProducts(),
        api.listProductions(30),
      ]);
      setSupplies(sup);
      setProducts(prod);
      setHistory(hist);
    } catch (err) { setError(String(err)); }
  };

  const addSupplyLine = () => setSupplyLines((prev) => [...prev, { supply_id: 0, quantity: 0 }]);
  const addItemLine = () => setItemLines((prev) => [...prev, { product_id: 0, quantity: 0 }]);
  const removeSupplyLine = (i: number) => setSupplyLines((prev) => prev.filter((_, idx) => idx !== i));
  const removeItemLine = (i: number) => setItemLines((prev) => prev.filter((_, idx) => idx !== i));

  const updateSupplyLine = (i: number, field: keyof SupplyLine, value: number) =>
    setSupplyLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  const updateItemLine = (i: number, field: keyof ItemLine, value: number) =>
    setItemLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const handleSave = async () => {
    setError("");
    const validSupplies = supplyLines.filter((l) => l.supply_id > 0 && l.quantity > 0);
    const validItems = itemLines.filter((l) => l.product_id > 0 && l.quantity > 0);
    if (validSupplies.length === 0 && validItems.length === 0) {
      setError("Agrega al menos un insumo consumido o un producto generado");
      return;
    }
    setSaving(true);
    try {
      const result = await api.createProduction({
        supplies: validSupplies,
        items: validItems,
        notes: notes.trim() || null,
      });
      let msg = `✅ Producción #${result.id} registrada. Costo insumos: $${result.total_supply_cost.toFixed(2)}`;
      if (result.warnings.length > 0) {
        msg += ` — ⚠️ ${result.warnings.join("; ")}`;
      }
      setSuccess(msg);
      setSupplyLines([]);
      setItemLines([]);
      setNotes("");
      await loadData();
    } catch (err) { setError(String(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Producción</h1>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      <div className="p-4 rounded-lg bg-card border border-border space-y-5 mb-8">
        <h3 className="text-sm font-medium text-foreground">Registrar nueva producción</h3>

        {/* Insumos consumidos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Insumos consumidos</label>
            <button onClick={addSupplyLine} className="text-xs text-primary hover:text-primary/80">+ Agregar insumo</button>
          </div>
          {supplyLines.length === 0 && <p className="text-xs text-muted-foreground">Sin insumos agregados</p>}
          <div className="space-y-2">
            {supplyLines.map((line, i) => {
              const sup = supplies.find((s) => s.id === line.supply_id);
              return (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={line.supply_id}
                    onChange={(e) => updateSupplyLine(i, "supply_id", Number(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={0}>Seleccionar insumo</option>
                    {supplies.map((s) => <option key={s.id} value={s.id}>{s.name} (stock: {s.stock} {s.unit})</option>)}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Cantidad"
                    value={line.quantity || ""}
                    onChange={(e) => updateSupplyLine(i, "quantity", Number(e.target.value))}
                    className="w-28 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground w-12">{sup?.unit ?? ""}</span>
                  <button onClick={() => removeSupplyLine(i)} className="text-destructive text-sm">✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Productos generados */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Productos generados</label>
            <button onClick={addItemLine} className="text-xs text-primary hover:text-primary/80">+ Agregar producto</button>
          </div>
          {itemLines.length === 0 && <p className="text-xs text-muted-foreground">Sin productos agregados</p>}
          <div className="space-y-2">
            {itemLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={line.product_id}
                  onChange={(e) => updateItemLine(i, "product_id", Number(e.target.value))}
                  className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={0}>Seleccionar producto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
                </select>
                <input
                  type="number"
                  step="1"
                  placeholder="Cantidad"
                  value={line.quantity || ""}
                  onChange={(e) => updateItemLine(i, "quantity", Number(e.target.value))}
                  className="w-28 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground w-12">uds</span>
                <button onClick={() => removeItemLine(i)} className="text-destructive text-sm">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div className="border-t border-border pt-4">
          <input
            type="text"
            placeholder="Notas (opcional): ej. horneada de la mañana"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-md bg-success text-white text-sm font-bold hover:bg-success/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Registrando..." : "Registrar producción"}
        </button>
      </div>

      {/* Historial */}
      <h2 className="text-lg font-semibold text-foreground mb-3">Historial de producción</h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-16">#</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Notas</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Insumos</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Productos</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Costo insumos</th>
            </tr>
          </thead>
          <tbody>
            {history.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-card/50">
                <td className="px-4 py-3 text-sm text-muted-foreground">{p.id}</td>
                <td className="px-4 py-3 text-sm text-foreground">{p.created_at}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{p.notes ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{p.supplies_count}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{p.items_count}</td>
                <td className="px-4 py-3 text-sm text-right font-mono text-foreground">${p.total_supply_cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">No hay producciones registradas</p>
        )}
      </div>
    </div>
  );
}
