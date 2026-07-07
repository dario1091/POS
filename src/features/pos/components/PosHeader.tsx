import { useNavigate } from "react-router-dom";
import { KeyBadge } from "./KeyBadge";
import { TabBar } from "./TabBar";
import type { Customer } from "@/shared/api/types";

interface SaleTab {
  id: number;
  cart: { product: { id: number }; quantity: number; discount: number }[];
}

interface PosHeaderProps {
  userName: string;
  returnMode: boolean;
  tabs: SaleTab[];
  activeTabId: number;
  onTabChange: (tabId: number) => void;
  customer: Customer | null;
  serverConnected: boolean | null;
  onLogout: () => void;
}

export function PosHeader({
  userName,
  returnMode,
  tabs,
  activeTabId,
  onTabChange,
  customer,
  serverConnected,
  onLogout,
}: PosHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-foreground">POS</h1>
        {returnMode && (
          <span className="px-2 py-0.5 rounded text-xs bg-destructive text-white font-bold animate-pulse">
            DEVOLUCIÓN
          </span>
        )}
        <TabBar tabs={tabs} activeTabId={activeTabId} onTabChange={onTabChange} />
        <span className="text-sm text-muted-foreground">{userName}</span>
        {customer && (
          <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary">
            Cliente: {customer.name}
          </span>
        )}
        {serverConnected !== null && (
          <span
            className={`px-2 py-0.5 rounded text-xs ${
              serverConnected
                ? "bg-success/20 text-success"
                : "bg-destructive/20 text-destructive"
            }`}
          >
            {serverConnected ? "● Servidor OK" : "● Sin conexión"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          <KeyBadge keyName="F1" label="Efectivo" />
          <KeyBadge keyName="F2" label="Tarjeta" />
          <KeyBadge keyName="F3" label="Eliminar" />
          <KeyBadge keyName="F4" label="Cancelar" />
          <KeyBadge keyName="F5" label="Cliente" />
          <KeyBadge keyName="F6" label="Devolución" />
          <KeyBadge keyName="F7" label="Cajón" />
          <KeyBadge keyName="F8" label="Historial" />
          <KeyBadge keyName="F9" label="Reimprimir" />
          <KeyBadge keyName="F12" label="Ayuda" />
          <KeyBadge keyName="Ctrl+N" label="Nueva" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin")}
            className="px-3 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Menú
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1 rounded text-xs text-destructive hover:bg-accent transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
