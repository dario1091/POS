import { useState } from "react";
import { useBusinessType, type BusinessType } from "@/hooks/useBusinessType";

export function BusinessSetupPage() {
  const { setBusinessType } = useBusinessType();
  const [saving, setSaving] = useState<BusinessType | null>(null);
  const [error, setError] = useState("");

  const handleSelect = async (type: BusinessType) => {
    setSaving(type);
    setError("");
    try {
      await setBusinessType(type);
    } catch (err) {
      setError(String(err));
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Configuración inicial</h1>
        <p className="text-muted-foreground mb-8 text-center">
          Selecciona el tipo de negocio. Esto determina qué módulos y categorías se cargan.
        </p>

        {error && <p className="text-sm text-destructive mb-4 text-center">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Abarrotes */}
          <button
            onClick={() => handleSelect("abarrotes")}
            disabled={saving !== null}
            className="p-6 rounded-lg bg-card border-2 border-border hover:border-primary transition-colors text-left disabled:opacity-50"
          >
            <div className="text-4xl mb-3">🛒</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Abarrotes / Minisúper</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Tienda de productos empacados y a granel.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Venta por pieza y por peso</li>
              <li>• Inventario de productos terminados</li>
              <li>• Categorías de supermercado</li>
            </ul>
            {saving === "abarrotes" && <p className="text-xs text-primary mt-3">Configurando...</p>}
          </button>

          {/* Panadería */}
          <button
            onClick={() => handleSelect("panaderia")}
            disabled={saving !== null}
            className="p-6 rounded-lg bg-card border-2 border-border hover:border-primary transition-colors text-left disabled:opacity-50"
          >
            <div className="text-4xl mb-3">🥖</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Panadería</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Negocio de producción propia con insumos y recetas.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Todo lo de abarrotes, más:</li>
              <li>• Insumos (harina, mantequilla, azúcar...)</li>
              <li>• Registro de producción</li>
              <li>• Cálculo de producción posible</li>
            </ul>
            {saving === "panaderia" && <p className="text-xs text-primary mt-3">Configurando...</p>}
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Podrás cambiarlo después desde Configuración → Hardware.
        </p>
      </div>
    </div>
  );
}
