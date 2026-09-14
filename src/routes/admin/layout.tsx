import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessType } from "@/hooks/useBusinessType";
import { useTheme } from "@/hooks/useTheme";

interface MenuItem {
  to: string;
  label: string;
  adminOnly?: boolean;
  bakeryOnly?: boolean;
}

interface MenuSection {
  title: string;
  icon: string;
  items: MenuItem[];
}

const SECTIONS: MenuSection[] = [
  {
    title: "Reportes",
    icon: "📊",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", adminOnly: true },
      { to: "/admin/reports", label: "Reportes", adminOnly: true },
    ],
  },
  {
    title: "Productos",
    icon: "📦",
    items: [
      { to: "/admin/products", label: "Productos", adminOnly: true },
      { to: "/admin/categories", label: "Categorías", adminOnly: true },
      { to: "/admin/inventory", label: "Inventario" },
    ],
  },
  {
    title: "Panadería",
    icon: "🥖",
    items: [
      { to: "/admin/supplies", label: "Insumos", adminOnly: true, bakeryOnly: true },
      { to: "/admin/recipes", label: "Recetas", adminOnly: true, bakeryOnly: true },
      { to: "/admin/production", label: "Producción", adminOnly: true, bakeryOnly: true },
    ],
  },
  {
    title: "Caja",
    icon: "💰",
    items: [
      { to: "/admin/cashcut", label: "Corte de caja" },
      { to: "/admin/customers", label: "Clientes" },
    ],
  },
  {
    title: "Configuración",
    icon: "⚙️",
    items: [
      { to: "/admin/hardware", label: "Hardware" },
      { to: "/admin/labels", label: "Etiquetas" },
      { to: "/admin/network", label: "Red", adminOnly: true },
      { to: "/admin/users", label: "Usuarios", adminOnly: true },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { businessType } = useBusinessType();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const isBakery = businessType === "panaderia";

  // Filtrar secciones e items según permisos y tipo de negocio
  const sections = SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.bakeryOnly && !isBakery) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  // Secciones expandidas: por defecto la que contiene la ruta activa
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SECTIONS.forEach((s) => {
      initial[s.title] = s.items.some((i) => location.pathname.startsWith(i.to));
    });
    return initial;
  });

  const toggleSection = (title: string) =>
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }));

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
        <nav className="flex-1 p-2 space-y-1 overflow-auto">
          <NavLink
            to="/pos"
            className="block px-3 py-2 rounded-md text-sm font-medium text-success hover:bg-accent transition-colors mb-2"
          >
            ← Ir al POS
          </NavLink>

          {sections.map((section) => (
            <div key={section.title}>
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent transition-colors"
              >
                <span>{section.icon} {section.title}</span>
                <span className="text-[10px]">{expanded[section.title] ? "▼" : "▶"}</span>
              </button>
              {expanded[section.title] && (
                <div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">
                  {section.items.map((item) => (
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
                </div>
              )}
            </div>
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
