import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export function NetworkPage() {
  const [role, setRole] = useState("standalone");
  const [port, setPort] = useState("3847");
  const [serverIp, setServerIp] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadConfig = async () => {
    try {
      const config = await api.getNetworkConfig();
      setRole(config.role);
      setPort(config.port.toString());
      setServerIp(config.server_ip || "");
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSave = async () => {
    setError("");
    try {
      await api.setNetworkConfig(role, parseInt(port), role === "client" ? serverIp : null);
      setSuccess("Configuración guardada. Reinicia la app para aplicar los cambios.");
    } catch (err) {
      setError(String(err));
    }
  };

  const handleTestConnection = async () => {
    setError("");
    setConnected(null);
    try {
      const ok = await api.checkServerConnection();
      setConnected(ok);
      if (!ok) setError("No se pudo conectar al servidor");
    } catch (err) {
      setConnected(false);
      setError(String(err));
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Configuración de Red</h1>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      <section className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Rol de esta máquina</h2>

        <div className="space-y-3 mb-4">
          {([
            ["standalone", "Independiente", "Una sola máquina. No comparte datos con otras."],
            ["server", "Servidor", "Esta máquina tiene la base de datos. Otras se conectan aquí."],
            ["client", "Cliente", "Esta máquina se conecta a un servidor en la red."],
          ] as const).map(([value, label, desc]) => (
            <label
              key={value}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                role === value ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Port config (server) */}
        {role === "server" && (
          <div className="mb-4">
            <label className="text-sm text-muted-foreground block mb-1">Puerto</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-32 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Las máquinas cliente apuntarán a la IP de esta máquina en este puerto.
            </p>
          </div>
        )}

        {/* Server IP config (client) */}
        {role === "client" && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">IP del servidor</label>
              <input
                type="text"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Puerto</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-32 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleTestConnection}
              className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Probar conexión
            </button>
            {connected !== null && (
              <p className={`text-sm font-medium ${connected ? "text-success" : "text-destructive"}`}>
                {connected ? "✅ Conectado al servidor" : "❌ No se pudo conectar"}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Guardar configuración
        </button>

        <p className="text-xs text-warning mt-3">
          ⚠️ Los cambios de rol requieren reiniciar la aplicación para tomar efecto.
        </p>
      </section>
    </div>
  );
}
