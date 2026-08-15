import { useState } from "react";
import { api } from "@/lib/api";
import { getLocalDate } from "@/lib/utils";

export function ReportsPage() {
  const today = getLocalDate();
  const weekAgo = getLocalDate(-7);

  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [salesByRange, setSalesByRange] = useState<{ date: string; total: number; transactions: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ product_id: number; product_name: string; total_quantity: number; total_revenue: number; times_sold: number }[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<{ category_id: number; category_name: string; total_revenue: number; total_quantity: number; total_transactions: number }[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadReports = async () => {
    setError("");
    try {
      const [rangeData, topData, categoryData] = await Promise.all([
        api.getSalesByRange(from, to),
        api.getTopProducts(from, to, 20),
        api.getSalesByCategory(from, to),
      ]);
      setSalesByRange(rangeData);
      setTopProducts(topData);
      setSalesByCategory(categoryData);
      setLoaded(true);
    } catch (err) {
      setError(String(err));
    }
  };

  const totalRange = salesByRange.reduce((s, d) => s + d.total, 0);
  const totalTx = salesByRange.reduce((s, d) => s + d.transactions, 0);
  const totalCategoryRevenue = salesByCategory.reduce((s, c) => s + c.total_revenue, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Reportes</h1>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* Date range filter */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); e.target.blur(); }}
            className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); e.target.blur(); }}
            className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button onClick={loadReports}
          className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Consultar
        </button>
      </div>

      {loaded && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total en rango</p>
              <p className="text-2xl font-bold font-mono text-primary">${totalRange.toFixed(2)}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Transacciones</p>
              <p className="text-2xl font-bold font-mono text-foreground">{totalTx}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Promedio diario</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                ${salesByRange.length > 0 ? (totalRange / salesByRange.length).toFixed(2) : "0.00"}
              </p>
            </div>
          </div>

          {/* Sales by day */}
          <h2 className="text-lg font-semibold text-foreground mb-3">Ventas por día</h2>
          <div className="rounded-lg border border-border overflow-hidden mb-8">
            <table className="w-full">
              <thead className="bg-card">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Transacciones</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Promedio/Venta</th>
                </tr>
              </thead>
              <tbody>
                {salesByRange.map((day) => (
                  <tr key={day.date} className="border-b border-border hover:bg-card/50">
                    <td className="px-4 py-3 text-sm text-foreground">{day.date}</td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-mono font-bold">${day.total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">{day.transactions}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground text-right font-mono">
                      ${day.transactions > 0 ? (day.total / day.transactions).toFixed(2) : "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {salesByRange.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No hay ventas en este rango</p>
            )}
          </div>

          {/* Top Products */}
          <h2 className="text-lg font-semibold text-foreground mb-3">Productos más vendidos</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-card">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Producto</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Cantidad</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Ingresos</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Veces vendido</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((prod, i) => (
                  <tr key={prod.product_id} className="border-b border-border hover:bg-card/50">
                    <td className="px-4 py-3 text-sm text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-foreground font-medium">{prod.product_name}</td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{prod.total_quantity}</td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-mono font-bold">${prod.total_revenue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground text-right">{prod.times_sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topProducts.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No hay datos de productos vendidos</p>
            )}
          </div>

          {/* Sales by Category */}
          <h2 className="text-lg font-semibold text-foreground mb-3 mt-8">Ventas por categoría</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-card">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Categoría</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Ingresos</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">% del total</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Unidades</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Transacciones</th>
                </tr>
              </thead>
              <tbody>
                {salesByCategory.map((cat) => (
                  <tr key={cat.category_id} className="border-b border-border hover:bg-card/50">
                    <td className="px-4 py-3 text-sm text-foreground font-medium">{cat.category_name}</td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-mono font-bold">${cat.total_revenue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${totalCategoryRevenue > 0 ? (cat.total_revenue / totalCategoryRevenue * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground font-mono text-xs w-12 text-right">
                          {totalCategoryRevenue > 0 ? (cat.total_revenue / totalCategoryRevenue * 100).toFixed(1) : "0.0"}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{cat.total_quantity}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground text-right">{cat.total_transactions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {salesByCategory.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No hay datos de ventas por categoría</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
