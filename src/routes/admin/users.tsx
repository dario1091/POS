import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { User, CreateUser } from "@/lib/types";

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState<CreateUser>({
    username: "",
    password: "",
    full_name: "",
    role: "cajero",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadUsers = async () => {
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCreate = async () => {
    setError("");
    try {
      await api.createUser(formData);
      setFormData({ username: "", password: "", full_name: "", role: "cajero" });
      setShowForm(false);
      await loadUsers();
      setSuccess("Usuario creado correctamente");
    } catch (err) {
      setError(String(err));
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.toggleUserActive(id);
      await loadUsers();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleChangePassword = async () => {
    if (!passwordUserId || !newPassword) {
      setError("Ingresa la nueva contraseña");
      return;
    }
    setError("");
    try {
      await api.updateUser({ id: passwordUserId, password: newPassword });
      setShowPasswordModal(false);
      setNewPassword("");
      setPasswordUserId(null);
      setSuccess("Contraseña actualizada correctamente");
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Cancelar" : "Nuevo Usuario"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {showForm && (
        <div className="mb-6 p-4 rounded-lg bg-card border border-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Usuario"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Nombre completo"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "cajero" })}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="cajero">Cajero</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
          >
            Guardar
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Usuario</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border hover:bg-card/50">
                <td className="px-4 py-3 text-sm text-foreground">{user.id}</td>
                <td className="px-4 py-3 text-sm text-foreground">{user.username}</td>
                <td className="px-4 py-3 text-sm text-foreground">{user.full_name}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user.active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                  }`}>
                    {user.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm space-x-3">
                  <button
                    onClick={() => {
                      setPasswordUserId(user.id);
                      setNewPassword("");
                      setShowPasswordModal(true);
                    }}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Cambiar contraseña
                  </button>
                  <button
                    onClick={() => handleToggle(user.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {user.active ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPasswordModal(false);
            }
          }}
        >
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-4">Cambiar Contraseña</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Usuario: {users.find((u) => u.id === passwordUserId)?.username}
            </p>
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleChangePassword();
                if (e.key === "Escape") setShowPasswordModal(false);
              }}
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleChangePassword}
                className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Guardar
              </button>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
