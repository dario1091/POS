import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Supply } from "@/lib/types";

const UNITS = ["kg", "g", "l", "ml", "unidad"] as const;

export function SuppliesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emptyForm = { name: "", unit: "kg", stock: 0, cost_per_unit: 0, min_stock: 0 };
  const [formData, setFormData] = useState<{ name: string; unit: string; stock: number; cost_per_unit: number; min_stock: number }>(emptyForm);

  // Stock adjustment
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustValue, setAdjustValue] = useState("");

  useEffect(() => { loadSupplies(); }, []);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); }
  }, [success]);

  const loadSupplies = async () => {
    try { setSupplies(await api.listSupplies()); }
    catch (err) { setError(String(err)); }
  };

  const handleSave = async () => {
    setError("");
    if (!formData.name.trim()) { setError("El nombre es obligatorio"); return; }
    try {
      if (editingId) {
        await api.updateSupply({
          id: editingId,
          name: formData.name,
          unit: formData.unit,
          cost_per_unit: formData.cost_per_unit,
          min_stock: formData.min_stock,
        });
        setSuccess("Insumo actualizado");
      } else {
        await api.createSupply(formData);
        setSuccess("Insumo creado");
      }
      setFormData(emptyForm);
      setShowForm(false);
      setEditingId(null);
      await loadSupplies();
    } catch (err) { setError(String(err)); }
  };

  const handleEdit = (s: Supply) => {
    setEditingId(s.id);
    setFormData({ name: s.name, unit: s.unit, stock: s.stock, cost_per_unit: s.cost_per_unit, min_stock: s.min_stock });
    setShowForm(true);
  };

  const handleAdjust = async (id: number) => {
    const val = parseFloat(adjustValue);
    if (isNaN(val) || val < 0) { setError("Cantidad inválida"); return; }
    try {
      await api.adjustSupplyStock(id, val);
      setSuccess("Stock actualizado");
      setAdjustId(null);
      setAdjustValue("");
      await loadSupplies();
    } catch (err) { setError(String(err)); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el insumo "${name}"?`)) return;
    try {
      await api.deleteSupply(id);
      setSuccess("Insumo eliminado");
      await loadSupplies();
    } catch (err) { setError(String(err)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Insumos</h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Cancelar" : "Nuevo Insumo"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {showForm && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-3">
          <h3 className="text-sm font-medium text-foreground">{editingId ? "Editar Insumo" : "Nuevo Insumo"}</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Nombre * (ej: Harina)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {!editingId && (
              <input
                type="number"
                step="0.001"
                placeholder="Stock inicial"
                value={formData.stock || ""}
                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <input
              type="number"
              step="0.01"
              placeholder="Costo por unidad"
              value={formData.cost_per_unit || ""}
              onChange={(e) => setFormData({ ...formData, cost_per_unit: Number(e.target.value) })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="number"
              step="0.001"
              placeholder="Stock mínimo"
              value={formData.min_stock || ""}
              onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
          >
            {editingId ? "Actualizar" : "Guardar"}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Insumo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-20">Unidad</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-32">Stock</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-32">Costo/unidad</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-24">Mínimo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {supplies.map((s) => {
              const isLow = s.min_stock > 0 && s.stock <= s.min_stock;
              return (
                <tr key={s.id} className="border-b border-border hover:bg-card/50">
                  <td className="px-4 py-3 text-sm text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{s.unit}</td>
                  <td className={`px-4 py-3 text-sm text-right font-mono ${isLow ? "text-warning font-bold" : "text-foreground"}`}>
                    {adjustId === s.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          type="number"
                          step="0.001"
                          value={adjustValue}
                          onChange={(e) => setAdjustValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAdjust(s.id); }}
                          className="w-20 px-2 py-1 rounded bg-input border border-border text-foreground text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                        <button onClick={() => handleAdjust(s.id)} className="text-xs text-success">✓</button>
                        <button onClick={() => { setAdjustId(null); setAdjustValue(""); }} className="text-xs text-destructive">✕</button>
                      </div>
                    ) : (
                      <>{s.stock} {isLow && "⚠️"}</>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-muted-foreground">${s.cost_per_unit.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-muted-foreground">{s.min_stock}</td>
                  <td className="px-4 py-3 text-sm space-x-3">
                    <button onClick={() => { setAdjustId(s.id); setAdjustValue(String(s.stock)); }} className="text-xs text-primary hover:text-primary/80">Ajustar stock</button>
                    <button onClick={() => handleEdit(s)} className="text-xs text-primary hover:text-primary/80">Editar</button>
                    <button onClick={() => handleDelete(s.id, s.name)} className="text-xs text-destructive hover:text-destructive/80">Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {supplies.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">No hay insumos registrados</p>
        )}
      </div>
    </div>
  );
}
