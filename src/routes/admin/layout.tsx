import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

const adminOnlyItems = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/reports", label: "Reportes" },
  { to: "/admin/products", label: "Productos" },
  { to: "/admin/categories", label: "Categorías" },
  { to: "/admin/users", label: "Usuarios" },
  { to: "/admin/network", label: "Red" },
];

const sharedItems = [
  { to: "/admin/inventory", label: "Inventario" },
  { to: "/admin/cashcut", label: "Corte de caja" },
  { to: "/admin/customers", label: "Clientes" },
  { to: "/admin/labels", label: "Etiquetas" },
  { to: "/admin/hardware", label: "Hardware" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const navItems = user?.role === "admin" ? [...adminOnlyItems, ...sharedItems] : sharedItems;

  // Ctrl+P → volver al POS
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        navigate("/pos");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">POS Admin</h2>
          <p className="text-xs text-muted-foreground">{user?.full_name}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <NavLink
            to="/pos"
            className="block px-3 py-2 rounded-md text-sm font-medium text-success hover:bg-accent transition-colors"
          >
            ← Ir al POS
          </NavLink>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors flex items-center justify-between"
          >
            <span>{theme === "dark" ? "☀️ Tema claro" : "🌙 Tema oscuro"}</span>
          </button>
          <button
            onClick={logout}
            className="w-full px-3 py-2 rounded-md text-sm text-destructive hover:bg-accent transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
