import { Modal } from "@/shared/ui/Modal";

interface AdminAuthModalProps {
  show: boolean;
  password: string;
  error: string;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AdminAuthModal({ show, password, error, onPasswordChange, onConfirm, onClose }: AdminAuthModalProps) {
  if (!show) return null;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold text-foreground mb-2">Autorización requerida</h2>
      <p className="text-sm text-muted-foreground mb-4">Ingresa la clave del administrador para continuar</p>
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}
      <input
        id="admin-auth-input"
        type="password"
        placeholder="Clave de administrador"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }}
        className="w-full px-4 py-3 rounded-md bg-input border border-border text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-ring mb-3"
        autoFocus
      />
      <button
        onClick={onConfirm}
        className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
      >
        Autorizar
      </button>
    </Modal>
  );
}
