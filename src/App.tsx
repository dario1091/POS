import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/routes/login";
import { PosPage } from "@/routes/pos/index";
import { AdminLayout } from "@/routes/admin/layout";
import { DashboardPage } from "@/routes/admin/dashboard";
import { ReportsPage } from "@/routes/admin/reports";
import { CashCutPage } from "@/routes/admin/cashcut";
import { UsersPage } from "@/routes/admin/users";
import { ProductsPage } from "@/routes/admin/products";
import { CategoriesPage } from "@/routes/admin/categories";
import { CustomersPage } from "@/routes/admin/customers";
import { InventoryPage } from "@/routes/admin/inventory";
import { HardwarePage } from "@/routes/admin/hardware";
import { NetworkPage } from "@/routes/admin/network";
import type { ReactNode } from "react";

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/pos" replace /> : <LoginPage />} />
      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <PosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/hardware" replace />} />
        <Route path="dashboard" element={<ProtectedRoute adminOnly><DashboardPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>} />
        <Route path="cashcut" element={<CashCutPage />} />
        <Route path="products" element={<ProtectedRoute adminOnly><ProductsPage /></ProtectedRoute>} />
        <Route path="categories" element={<ProtectedRoute adminOnly><CategoriesPage /></ProtectedRoute>} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute adminOnly><InventoryPage /></ProtectedRoute>} />
        <Route path="hardware" element={<HardwarePage />} />
        <Route path="network" element={<ProtectedRoute adminOnly><NetworkPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
