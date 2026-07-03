import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await api.listCategories();
      setCategories(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSave = async () => {
    setError("");
    try {
      if (editingId) {
        await api.updateCategory(editingId, name, description || null);
      } else {
        await api.createCategory({ name, description: description || null });
      }
      setName("");
      setDescription("");
      setShowForm(false);
      setEditingId(null);
      await loadCategories();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description ?? "");
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Categorías</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setName("");
            setDescription("");
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Cancelar" : "Nueva Categoría"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {showForm && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nombre *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Descripción</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-border hover:bg-card/50">
                <td className="px-4 py-3 text-sm text-muted-foreground">{category.id}</td>
                <td className="px-4 py-3 text-sm text-foreground">{category.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{category.description ?? "-"}</td>
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => handleEdit(category)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">No hay categorías</p>
        )}
      </div>
    </div>
  );
}
