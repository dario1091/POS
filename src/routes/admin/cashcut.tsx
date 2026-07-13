import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getLocalDate } from "@/lib/utils";

export function CashCutPage() {
  const today = getLocalDate();
  const [summary, setSummary] = useState<{
    total_sales: number; cash_sales: number; card_sales: number;
    transfer_sales: number; credit_sales: number; transactions: number;
    last_cut_date: string | null;
    deliveries_total: number; deliveries_count: number;
    supplier_payments_total: number; supplier_payments_count: number;
    supplier_payments: { supplier_name: string; amount: number; created_at: string }[];
    cash_in_register: number;
  } | null>(null);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [cuts, setCuts] = useState<{
    id: number; user_id: number; expected_cash: number; actual_cash: number;
    difference: number; notes: string | null; created_at: string;
  }[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 5000); return () => clearTimeout(t); }
  }, [success]);

  const loadData = async () => {
    try {
      const [summaryData, cutsData] = await Promise.all([
        api.getCashCutSummary(),
        api.getCashCuts("2020-01-01", today),
      ]);
      setSummary(summaryData);
      setCuts(cutsData);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCut = async () => {
    if (!actualCash) {
      setError("Ingresa el conteo real de efectivo");
      return;
    }
    setError("");
    try {
      const result = await api.createCashCut(parseFloat(actualCash), notes || null);
      const diff = result.difference;
      const diffMsg = diff === 0 ? "Cuadra perfecto ✅" :
        diff > 0 ? `Sobrante: $${diff.toFixed(2)}` : `Faltante: $${Math.abs(diff).toFixed(2)}`;
      setSuccess(`Corte registrado. ${diffMsg}`);
      setActualCash("");
      setNotes("");
      await loadData();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Corte de Caja</h1>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {/* Current period summary */}
      {summary && (
        <div className="mb-8 p-5 rounded-lg bg-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-1">Resumen del día</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {today}
          </p>

          {/* Sales breakdown */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Total ventas</p>
              <p className="text-xl font-bold font-mono text-foreground">${summary.total_sales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Efectivo cobrado</p>
              <p className="text-xl font-bold font-mono text-success">${summary.cash_sales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tarjeta</p>
              <p className="text-xl font-bold font-mono text-primary">${summary.card_sales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Transferencia</p>
              <p className="text-xl font-bold font-mono text-warning">${summary.transfer_sales.toFixed(2)}</p>
            </div>
            {summary.credit_sales > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Crédito (fiado)</p>
                <p className="text-xl font-bold font-mono text-destructive">${summary.credit_sales.toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* Cash outflows */}
          {(summary.deliveries_count > 0 || summary.supplier_payments_count > 0) && (
            <div className="border-t border-border pt-4 mb-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Salidas de efectivo</h3>
              <div className="space-y-2">
                {summary.deliveries_count > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Entregas parciales ({summary.deliveries_count})
                    </span>
                    <span className="font-mono text-warning font-medium">
                      -${summary.deliveries_total.toFixed(2)}
                    </span>
                  </div>
                )}
                {summary.supplier_payments_count > 0 && (
                  <div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Pagos a proveedores ({summary.supplier_payments_count})
                      </span>
                      <span className="font-mono text-destructive font-medium">
                        -${summary.supplier_payments_total.toFixed(2)}
                      </span>
                    </div>
                    {summary.supplier_payments.map((sp, i) => (
                      <div key={i} className="flex justify-between text-xs pl-4 mt-1">
                        <span className="text-muted-foreground">{sp.supplier_name}</span>
                        <span className="font-mono text-muted-foreground">${sp.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Net cash expected */}
          <div className="border-t border-border pt-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-foreground">Efectivo esperado en caja</p>
                <p className="text-xs text-muted-foreground">
                  Efectivo cobrado − entregas − pagos proveedores
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-success">
                ${summary.cash_in_register.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Cut form */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Realizar corte</h3>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Efectivo contado (real)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="$0.00"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-40 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  placeholder="Observaciones del corte..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleCut}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Registrar corte
              </button>
            </div>
            {actualCash && summary && (
              <p className={`text-sm mt-2 font-medium ${
                parseFloat(actualCash) === summary.cash_in_register ? "text-success" :
                parseFloat(actualCash) > summary.cash_in_register ? "text-warning" : "text-destructive"
              }`}>
                {parseFloat(actualCash) === summary.cash_in_register ? "✅ Cuadra perfecto" :
                 parseFloat(actualCash) > summary.cash_in_register
                  ? `Sobrante: $${(parseFloat(actualCash) - summary.cash_in_register).toFixed(2)}`
                  : `Faltante: $${(summary.cash_in_register - parseFloat(actualCash)).toFixed(2)}`
                }
              </p>
            )}
          </div>
        </div>
      )}

      {/* History */}
      <h2 className="text-lg font-semibold text-foreground mb-3">Historial de cortes</h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Esperado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Contado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Diferencia</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Notas</th>
            </tr>
          </thead>
          <tbody>
            {cuts.map((cut) => (
              <tr key={cut.id} className="border-b border-border hover:bg-card/50">
                <td className="px-4 py-3 text-sm text-foreground">{cut.created_at}</td>
                <td className="px-4 py-3 text-sm text-foreground text-right font-mono">${cut.expected_cash.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-foreground text-right font-mono">${cut.actual_cash.toFixed(2)}</td>
                <td className={`px-4 py-3 text-sm text-right font-mono font-bold ${
                  cut.difference === 0 ? "text-success" :
                  cut.difference > 0 ? "text-warning" : "text-destructive"
                }`}>
                  {cut.difference === 0 ? "$0.00" :
                   cut.difference > 0 ? `+$${cut.difference.toFixed(2)}` : `-$${Math.abs(cut.difference).toFixed(2)}`}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{cut.notes ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cuts.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">No hay cortes registrados</p>
        )}
      </div>
    </div>
  );
}
