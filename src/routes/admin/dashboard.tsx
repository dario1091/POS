import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Sale } from "@/lib/types";

export function DashboardPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState<{
    total_sales: number; total_transactions: number; total_cash: number;
    total_card: number; total_transfer: number; total_items_sold: number;
  } | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    try {
      const [summaryData, salesData] = await Promise.all([
        api.getDailySummary(date),
        api.getDailySales(date),
      ]);
      setSummary(summaryData);
      setSales(salesData);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card label="Ventas del día" value={`$${summary.total_sales.toFixed(2)}`} accent="text-primary" />
          <Card label="Transacciones" value={summary.total_transactions.toString()} accent="text-foreground" />
          <Card label="Items vendidos" value={summary.total_items_sold.toString()} accent="text-foreground" />
          <Card label="Efectivo" value={`$${summary.total_cash.toFixed(2)}`} accent="text-success" />
          <Card label="Tarjeta" value={`$${summary.total_card.toFixed(2)}`} accent="text-primary" />
          <Card label="Transferencia" value={`$${summary.total_transfer.toFixed(2)}`} accent="text-warning" />
        </div>
      )}

      {/* Sales table */}
      <h2 className="text-lg font-semibold text-foreground mb-3">
        Ventas — {date === today ? "Hoy" : date}
      </h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">#</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Hora</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Pago</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Pagado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Cambio</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-b border-border hover:bg-card/50">
                <td className="px-4 py-3 text-sm text-muted-foreground">{sale.id}</td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {sale.created_at.split(" ")[1] || sale.created_at}
                </td>
                <td className="px-4 py-3 text-sm text-foreground text-right font-mono font-bold">
                  ${sale.total.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    sale.payment_method === "efectivo" ? "bg-success/20 text-success" :
                    sale.payment_method === "tarjeta" ? "bg-primary/20 text-primary" :
                    sale.payment_method === "mixto" ? "bg-warning/20 text-warning" :
                    "bg-secondary text-secondary-foreground"
                  }`}>
                    {sale.payment_method}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground text-right font-mono">
                  ${sale.amount_paid.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground text-right font-mono">
                  {sale.change_amount > 0 ? `$${sale.change_amount.toFixed(2)}` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">No hay ventas en esta fecha</p>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="p-4 rounded-lg bg-card border border-border">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${accent}`}>{value}</p>
    </div>
  );
}
