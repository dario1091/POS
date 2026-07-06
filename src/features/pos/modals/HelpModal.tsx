import { Modal } from "@/shared/ui/Modal";

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

export function HelpModal({ show, onClose }: HelpModalProps) {
  if (!show) return null;

  return (
    <Modal onClose={onClose} size="lg">
      <h2 className="text-lg font-bold text-foreground mb-4">Guía Rápida</h2>
      <div className="max-h-96 overflow-auto space-y-4 text-sm">
        <section>
          <h3 className="font-bold text-primary mb-1">Vender</h3>
          <div className="space-y-1 text-muted-foreground">
            <p><span className="text-foreground font-mono">{"{código}"}</span> — Agregar producto (escanear o escribir)</p>
            <p><span className="text-foreground font-mono">3*{"{código}"}</span> — Agregar 3 unidades</p>
            <p><span className="text-foreground font-mono">$8500*{"{código}"}</span> — Agregar con precio manual</p>
          </div>
        </section>
        <section>
          <h3 className="font-bold text-primary mb-1">Cobrar</h3>
          <div className="space-y-1 text-muted-foreground">
            <p><span className="text-foreground font-mono">500 + F1</span> — Cobrar $500 en efectivo</p>
            <p><span className="text-foreground font-mono">F1</span> — Cobrar (abre modal si no hay monto)</p>
            <p><span className="text-foreground font-mono">500 + F2</span> — Cobrar $500 con tarjeta</p>
            <p><span className="text-foreground font-mono">F2</span> — Cobrar otro medio (modal)</p>
          </div>
        </section>
        <section>
          <h3 className="font-bold text-primary mb-1">Teclas de función</h3>
          <div className="space-y-1 text-muted-foreground">
            <p><span className="text-foreground font-mono">F3</span> — Eliminar producto seleccionado</p>
            <p><span className="text-foreground font-mono">F4</span> — Cancelar venta (vaciar carrito)</p>
            <p><span className="text-foreground font-mono">F5</span> — Buscar/asignar cliente</p>
            <p><span className="text-foreground font-mono">F6</span> — Modo devolución</p>
            <p><span className="text-foreground font-mono">F8</span> — Historial de ventas del día</p>
            <p><span className="text-foreground font-mono">F9</span> — Reimprimir ticket</p>
            <p><span className="text-foreground font-mono">F12</span> — Esta ayuda</p>
            <p><span className="text-foreground font-mono">Ctrl+N</span> — Nueva pestaña de venta</p>
            <p><span className="text-foreground font-mono">Ctrl+1/2/3</span> — Cambiar pestaña</p>
            <p><span className="text-foreground font-mono">↑↓</span> — Navegar productos en lista</p>
          </div>
        </section>
        <section>
          <h3 className="font-bold text-primary mb-1">Comandos en el input</h3>
          <div className="space-y-1 text-muted-foreground">
            <p><span className="text-foreground font-mono">pv{"{código}"}</span> — Consultar precio</p>
            <p><span className="text-foreground font-mono">pv nombre</span> — Buscar por nombre</p>
            <p><span className="text-foreground font-mono">CC</span> — Cierre de caja</p>
            <p><span className="text-foreground font-mono">EP</span> — Entrega parcial de efectivo</p>
            <p><span className="text-foreground font-mono">AB</span> — Abono a crédito de cliente</p>
            <p><span className="text-foreground font-mono">AN5</span> — Anular venta #5</p>
          </div>
        </section>
        <section>
          <h3 className="font-bold text-primary mb-1">Devolución</h3>
          <div className="space-y-1 text-muted-foreground">
            <p><span className="text-foreground font-mono">F6</span> — Entrar en modo devolución</p>
            <p>Escanear productos a devolver</p>
            <p><span className="text-foreground font-mono">0 + F1</span> — Confirmar devolución</p>
            <p><span className="text-foreground font-mono">F6</span> — Salir del modo devolución</p>
          </div>
        </section>
      </div>
    </Modal>
  );
}
