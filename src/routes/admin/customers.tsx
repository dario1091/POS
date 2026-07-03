import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Customer, CreateCustomer } from "@/lib/types";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const emptyForm: CreateCustomer & { credit_limit: number } = {
    name: "",
    phone: null,
    email: null,
    address: null,
    credit_limit: 0,
  };

  const [formData, setFormData] = useState<CreateCustomer & { credit_limit: number }>(emptyForm);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await api.listCustomers();
      setCustomers(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSave = async () => {
    setError("");
    try {
      if (editingId) {
        await api.updateCustomer({
          id: editingId,
          name: formData.name,
          phone: formData.phone ?? undefined,
          email: formData.email ?? undefined,
          address: formData.address ?? undefined,
          credit_limit: formData.credit_limit,
        });
      } else {
        await api.createCustomer(formData);
      }
      setFormData(emptyForm);
      setShowForm(false);
      setEditingId(null);
      await loadCustomers();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      credit_limit: customer.credit_limit,
    });
    setShowForm(true);
  };

  const filteredCustomers = search
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search)
      )
    : customers;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData(emptyForm);
          }}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Cancelar" : "Nuevo Cliente"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {showForm && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {editingId ? "Editar Cliente" : "Nuevo Cliente"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nombre *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Teléfono"
              value={formData.phone ?? ""}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email ?? ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Dirección"
              value={formData.address ?? ""}
              onChange={(e) => setFormData({ ...formData, address: e.target.value || null })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Límite de crédito ($0 = sin crédito)"
              value={formData.credit_limit || ""}
              onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
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

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Teléfono</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Crédito</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Deuda</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} className="border-b border-border hover:bg-card/50">
                <td className="px-4 py-3 text-sm text-muted-foreground">{customer.id}</td>
                <td className="px-4 py-3 text-sm text-foreground">{customer.name}</td>
                <td className="px-4 py-3 text-sm text-foreground">{customer.phone ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{customer.email ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                  {customer.credit_limit > 0 ? `$${customer.credit_limit.toFixed(0)}` : "-"}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${customer.credit_balance > 0 ? "text-warning font-bold" : "text-muted-foreground"}`}>
                  {customer.credit_balance > 0 ? `$${customer.credit_balance.toFixed(2)}` : "-"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCustomers.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">No hay clientes</p>
        )}
      </div>
    </div>
  );
}
