import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export function HardwarePage() {
  const [serialPorts, setSerialPorts] = useState<string[]>([]);
  const [printers, setPrinters] = useState<{ path: string; label: string }[]>([]);
  const [printerPath, setPrinterPath] = useState("");
  const [labelPrinterPath, setLabelPrinterPath] = useState("");
  const [labelPrinters, setLabelPrinters] = useState<{ path: string; label: string }[]>([]);
  const [labelSensorType, setLabelSensorType] = useState("bline");
  const [scalePort, setScalePort] = useState("");
  const [scaleBaud, setScaleBaud] = useState("9600");
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [labelError, setLabelError] = useState("");
  const [labelSuccess, setLabelSuccess] = useState("");

  useEffect(() => {
    loadConfig();
    loadPorts();
    loadPrinters();
  }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (labelSuccess) {
      const t = setTimeout(() => setLabelSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [labelSuccess]);

  const loadConfig = async () => {
    try {
      const data = await api.getHardwareConfig();
      setPrinterPath(data.printer_device || "");
      setLabelPrinterPath(data.label_printer_device || "");
      setLabelSensorType(data.label_sensor_type || "bline");
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

  const loadPrinters = async () => {
    try {
      const devices = await api.listPrinters();
      setPrinters(devices);
      setLabelPrinters(devices);
    } catch {
      setPrinters([]);
      setLabelPrinters([]);
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

  const saveLabelPrinter = async () => {
    setLabelError("");
    try {
      await api.configureLabelPrinter(labelPrinterPath);
      setLabelSuccess("Impresora de etiquetas configurada correctamente");
      await loadConfig();
    } catch (err) {
      setLabelError(String(err));
    }
  };

  const handleTestLabelPrinter = async () => {
    setLabelError("");
    try {
      const msg = await api.testLabelPrinter();
      setLabelSuccess(msg);
    } catch (err) {
      setLabelError(String(err));
    }
  };

  const handleCalibrateLabelPrinter = async () => {
    setLabelError("");
    try {
      const msg = await api.calibrateLabelPrinter();
      setLabelSuccess(msg + " — La impresora avanzará algunas etiquetas durante la calibración.");
    } catch (err) {
      setLabelError(String(err));
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
            <label className="text-sm text-muted-foreground block mb-1">Dispositivo</label>
            <div className="flex gap-2">
              <select
                value={printerPath}
                onChange={(e) => setPrinterPath(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar impresora</option>
                {printers.map((p) => (
                  <option key={p.path} value={p.path}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={loadPrinters}
                className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors"
              >
                Refrescar
              </button>
            </div>
            {printers.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No se detectaron impresoras. Verifica que esté conectada por USB.</p>
            )}
            <input
              type="text"
              value={printerPath}
              onChange={(e) => setPrinterPath(e.target.value)}
              placeholder="O escribe manualmente: 0456:0808"
              className="w-full mt-2 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
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

      {/* Label Printer */}
      <section className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-1">Impresora de Etiquetas</h2>
        <p className="text-xs text-muted-foreground mb-3">Para impresoras TSPL/TSC (ej. 4BARCODE 4B-2054TG). Protocolo diferente al de tickets.</p>

        {labelError && <p className="text-sm text-destructive mb-3">{labelError}</p>}
        {labelSuccess && <p className="text-sm text-success mb-3">{labelSuccess}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Dispositivo</label>
            <div className="flex gap-2">
              <select
                value={labelPrinterPath}
                onChange={(e) => setLabelPrinterPath(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar impresora de etiquetas</option>
                {labelPrinters.map((p) => (
                  <option key={p.path} value={p.path}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={loadPrinters}
                className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors"
              >
                Refrescar
              </button>
            </div>
            {labelPrinters.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No se detectaron impresoras. Verifica que esté conectada por USB.</p>
            )}
            <input
              type="text"
              value={labelPrinterPath}
              onChange={(e) => setLabelPrinterPath(e.target.value)}
              placeholder="O escribe manualmente: 2d84:4cfb"
              className="w-full mt-2 px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Tipo de etiqueta</label>
            <select
              value={labelSensorType}
              onChange={async (e) => {
                const val = e.target.value;
                setLabelSensorType(val);
                try {
                  await api.configureLabelSensor(val);
                  setLabelSuccess(`Tipo de etiqueta: ${val === "bline" ? "Marca negra" : "Gap transparente"}`);
                } catch (err) { setLabelError(String(err)); }
              }}
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="bline">Marca negra (BLINE)</option>
              <option value="gap">Gap transparente (GAP)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Marca negra: franja negra en el reverso. Gap: espacio transparente entre etiquetas.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveLabelPrinter}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={handleTestLabelPrinter}
              className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Imprimir prueba
            </button>
            <button
              onClick={handleCalibrateLabelPrinter}
              className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              title="Calibra el sensor de etiquetas. Hazlo una sola vez al cambiar el rollo."
            >
              Calibrar
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

      {/* Backup */}
      <BackupSection />

      {/* System Updates */}
      <section className="mb-8 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-3">Actualizaciones del Sistema</h2>
        <UpdateSection />
      </section>
    </div>
  );
}

function BackupSection() {
  const [backups, setBackups] = useState<{ filename: string; path: string; size_bytes: number; created_at: string }[]>([]);
  const [config, setConfig] = useState<{ enabled: boolean; interval_hours: number; max_backups: number; backup_path: string }>({
    enabled: true, interval_hours: 4, max_backups: 5, backup_path: "",
  });
  const [creating, setCreating] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState("");
  const [backupError, setBackupError] = useState("");

  useEffect(() => {
    loadBackups();
    loadConfig();
  }, []);

  useEffect(() => {
    if (backupSuccess) { const t = setTimeout(() => setBackupSuccess(""), 4000); return () => clearTimeout(t); }
  }, [backupSuccess]);

  const loadBackups = async () => {
    try { setBackups(await api.listBackups()); } catch {}
  };

  const loadConfig = async () => {
    try { setConfig(await api.getBackupConfig()); } catch {}
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    setBackupError("");
    try {
      const info = await api.createBackup();
      setBackupSuccess(`✅ Backup creado: ${info.filename} (${(info.size_bytes / 1024 / 1024).toFixed(1)} MB)`);
      await loadBackups();
    } catch (err) {
      setBackupError(String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.setBackupConfig(config);
      setBackupSuccess("Configuración de backup guardada. Los cambios se aplican al reiniciar la app.");
    } catch (err) {
      setBackupError(String(err));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <section className="mb-8 p-4 rounded-lg bg-card border border-border">
      <h2 className="text-lg font-semibold text-foreground mb-3">Backup de Base de Datos</h2>

      {backupError && <p className="text-sm text-destructive mb-3">{backupError}</p>}
      {backupSuccess && <p className="text-sm text-success mb-3">{backupSuccess}</p>}

      <div className="space-y-4">
        {/* Manual backup */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Crear backup ahora</p>
            <p className="text-xs text-muted-foreground">Copia segura de la base de datos</p>
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creando..." : "Hacer backup"}
          </button>
        </div>

        {/* Config */}
        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-sm font-medium text-foreground">Configuración automática</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Intervalo (horas)</label>
              <input
                type="number"
                min="1"
                max="24"
                value={config.interval_hours}
                onChange={(e) => setConfig({ ...config, interval_hours: parseInt(e.target.value) || 4 })}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Máx. backups</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.max_backups}
                onChange={(e) => setConfig({ ...config, max_backups: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSaveConfig}
                className="w-full px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Ruta de backups (vacío = por defecto)</label>
            <input
              type="text"
              value={config.backup_path}
              onChange={(e) => setConfig({ ...config, backup_path: e.target.value })}
              placeholder="Ej: /media/usb/pos-backups/"
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Backup list */}
        {backups.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-sm font-medium text-foreground mb-2">Backups existentes ({backups.length})</p>
            <div className="space-y-1 max-h-40 overflow-auto">
              {backups.map((b) => (
                <div key={b.filename} className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary/30 text-sm">
                  <div>
                    <span className="text-foreground font-mono text-xs">{b.filename}</span>
                    <span className="text-muted-foreground text-xs ml-2">{b.created_at}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">{formatSize(b.size_bytes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
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

  const [showRestart, setShowRestart] = useState(false);

  // Show restart button when update succeeds
  const handleInstall = async () => {
    await installUpdate();
    if (!updateError) {
      setShowRestart(true);
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
            onClick={handleInstall}
            disabled={installing}
            className="px-4 py-2 rounded-md bg-success text-white text-sm font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"
          >
            {installing ? "Instalando..." : `Actualizar a v${updateInfo.latest_version}`}
          </button>
        </div>
      ) : showRestart ? (
        <button
          onClick={() => api.restartApp()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Reiniciar aplicación
        </button>
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
