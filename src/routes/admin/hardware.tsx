import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export function HardwarePage() {
  const [serialPorts, setSerialPorts] = useState<string[]>([]);
  const [printerPath, setPrinterPath] = useState("");
  const [scalePort, setScalePort] = useState("");
  const [scaleBaud, setScaleBaud] = useState("9600");
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadConfig();
    loadPorts();
  }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadConfig = async () => {
    try {
      const data = await api.getHardwareConfig();
      setPrinterPath(data.printer_device || "");
      setScalePort(data.scale_port || "");
      setScaleBaud(data.scale_baud || "9600");
      setBusinessName(data.business_name || "");
      setBusinessAddress(data.business_address || "");
    } catch (err) {
      setError(String(err));
    }
  };

  const loadPorts = async () => {
    try {
      const ports = await api.listSerialPorts();
      setSerialPorts(ports);
    } catch {
      setSerialPorts([]);
    }
  };

  const savePrinter = async () => {
    setError("");
    try {
      await api.configurePrinter(printerPath);
      setSuccess("Impresora configurada correctamente");
      await loadConfig();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleTestPrinter = async () => {
    setError("");
    try {
      const msg = await api.testPrinter();
      setSuccess(msg);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleOpenDrawer = async () => {
    setError("");
    try {
      await api.openCashDrawer();
      setSuccess("Cajón abierto");
    } catch (err) {
      setError(String(err));
    }
  };

  const saveScale = async () => {
    setError("");
    try {
      await api.configureScale(scalePort, parseInt(scaleBaud));
      setSuccess("Báscula configurada correctamente");
      await loadConfig();
    } catch (err) {
      setError(String(err));
    }
  };

  const saveBusiness = async () => {
    setError("");
    try {
      await api.configureBusiness(businessName, businessAddress || null);
      setSuccess("Datos del negocio guardados");
      await loadConfig();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Configuración</h1>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {/* Business */}
      <section className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-3">Datos del Negocio</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Nombre del negocio</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Mi Tienda"
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Dirección (opcional)</label>
            <input
              type="text"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Calle 123, Ciudad"
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={saveBusiness}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Guardar
          </button>
        </div>
      </section>

      {/* Printer */}
      <section className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-3">Impresora Térmica</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">
              Dispositivo (ej: /dev/usb/lp0)
            </label>
            <input
              type="text"
              value={printerPath}
              onChange={(e) => setPrinterPath(e.target.value)}
              placeholder="/dev/usb/lp0"
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={savePrinter}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={handleTestPrinter}
              className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Imprimir prueba
            </button>
            <button
              onClick={handleOpenDrawer}
              className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Abrir cajón
            </button>
          </div>
        </div>
      </section>

      {/* Scale */}
      <section className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-3">Báscula</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Puerto serial</label>
            <div className="flex gap-2">
              <select
                value={scalePort}
                onChange={(e) => setScalePort(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar puerto</option>
                {serialPorts.map((port) => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>
              <button
                onClick={loadPorts}
                className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors"
              >
                Refrescar
              </button>
            </div>
            {serialPorts.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No se detectaron puertos seriales. También puedes escribir la ruta manualmente:
              </p>
            )}
            <input
              type="text"
              value={scalePort}
              onChange={(e) => setScalePort(e.target.value)}
              placeholder="/dev/ttyUSB0"
              className="w-full mt-2 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Baud rate</label>
            <select
              value={scaleBaud}
              onChange={(e) => setScaleBaud(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="2400">2400</option>
              <option value="4800">4800</option>
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="115200">115200</option>
            </select>
          </div>
          <button
            onClick={saveScale}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Guardar
          </button>
        </div>
      </section>

      {/* System Updates */}
      <section className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-3">Actualizaciones del Sistema</h2>
        <UpdateSection />
      </section>
    </div>
  );
}

function UpdateSection() {
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    current_version: string; latest_version: string; has_update: boolean; download_url: string | null;
  } | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  const checkUpdates = async () => {
    setChecking(true);
    setUpdateError("");
    try {
      const info = await api.checkForUpdates();
      setUpdateInfo(info);
      if (!info.has_update) {
        setUpdateSuccess("Estás en la última versión");
        setTimeout(() => setUpdateSuccess(""), 3000);
      }
    } catch (err) {
      setUpdateError(String(err));
    } finally {
      setChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo?.download_url) return;
    setInstalling(true);
    setUpdateError("");
    try {
      const msg = await api.installUpdate(updateInfo.download_url);
      setUpdateSuccess(msg);
      setUpdateInfo(null);
    } catch (err) {
      setUpdateError(String(err));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-3">
      {updateError && <p className="text-sm text-destructive">{updateError}</p>}
      {updateSuccess && <p className="text-sm text-success">{updateSuccess}</p>}

      {updateInfo && (
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">Versión actual: <span className="font-mono text-foreground">{updateInfo.current_version}</span></p>
          <p className="text-muted-foreground">Última versión: <span className="font-mono text-foreground">{updateInfo.latest_version}</span></p>
        </div>
      )}

      {updateInfo?.has_update ? (
        <div className="flex gap-2">
          <button
            onClick={installUpdate}
            disabled={installing}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"
          >
            {installing ? "Instalando..." : `Actualizar a v${updateInfo.latest_version}`}
          </button>
        </div>
      ) : (
        <button
          onClick={checkUpdates}
          disabled={checking}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {checking ? "Verificando..." : "Buscar actualizaciones"}
        </button>
      )}

      <p className="text-xs text-muted-foreground">
        Al actualizar se pedirá la contraseña del sistema para instalar.
      </p>
    </div>
  );
}
