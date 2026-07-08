import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

interface LabelLine {
  text: string;
  size: "small" | "normal" | "large" | "extra_large";
  alignment: "left" | "center" | "right";
  bold: boolean;
}

interface LabelConfig {
  lines: LabelLine[];
  showBarcode: boolean;
  barcodeValue: string;
  copies: number;
}

const defaultLines = (): LabelLine[] => [
  { text: "", size: "normal", alignment: "center", bold: false },
  { text: "", size: "large", alignment: "center", bold: true },
  { text: "", size: "small", alignment: "center", bold: false },
];

const defaultConfig = (): LabelConfig => ({
  lines: defaultLines(),
  showBarcode: false,
  barcodeValue: "",
  copies: 1,
});

export function LabelsPage() {
  const [config, setConfig] = useState<LabelConfig>(defaultConfig());
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Product search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchProductsByName(query);
      setSearchResults(results.slice(0, 8));
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    // Build lines from product data
    const newLines: LabelLine[] = [
      {
        text: product.name,
        size: "normal",
        alignment: "center",
        bold: false,
      },
      {
        text: `$${product.sale_price.toFixed(2)}`,
        size: "large",
        alignment: "center",
        bold: true,
      },
      {
        text: "",
        size: "small",
        alignment: "center",
        bold: false,
      },
    ];

    setConfig({
      lines: newLines,
      showBarcode: !!(product.barcode),
      barcodeValue: product.barcode || "",
      copies: config.copies,
    });

    setSearchQuery(product.name);
    setShowResults(false);
  };

  const updateLine = (index: number, field: keyof LabelLine, value: string | boolean) => {
    setConfig((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line),
    }));
  };

  const addLine = () => {
    setConfig((prev) => ({
      ...prev,
      lines: [...prev.lines, { text: "", size: "normal", alignment: "center", bold: false }],
    }));
  };

  const removeLine = (index: number) => {
    if (config.lines.length <= 1) return;
    setConfig((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handlePrint = async () => {
    const nonEmpty = config.lines.filter((l) => l.text.trim());
    if (nonEmpty.length === 0 && !config.showBarcode) {
      setError("Agrega al menos una línea con texto o activa el código de barras");
      return;
    }
    setPrinting(true);
    setError("");
    try {
      const barcode = config.showBarcode && config.barcodeValue.trim()
        ? config.barcodeValue.trim()
        : undefined;
      await api.printLabel(nonEmpty, config.copies, barcode);
      setSuccess(`✅ ${config.copies} etiqueta${config.copies > 1 ? "s" : ""} impresa${config.copies > 1 ? "s" : ""}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setPrinting(false);
    }
  };

  const handleClear = () => {
    setConfig(defaultConfig());
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const sizePreviewClass: Record<string, string> = {
    small: "text-xs",
    normal: "text-sm",
    large: "text-xl",
    extra_large: "text-3xl",
  };
  const alignClass: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Etiquetas de Precio</h1>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      {/* Product search */}
      <div className="mb-6 p-4 rounded-lg bg-card border border-border">
        <h2 className="text-sm font-medium text-foreground mb-2">Buscar producto</h2>
        <div className="relative" ref={searchRef}>
          <input
            type="text"
            placeholder="Escribe el nombre del producto..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searching && (
            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">Buscando...</span>
          )}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-sm text-foreground">{product.name}</span>
                    {product.barcode && (
                      <span className="text-xs text-muted-foreground ml-2">#{product.barcode}</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-foreground font-mono">
                    ${product.sale_price.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Al seleccionar un producto se cargan automáticamente sus datos. Puedes editarlos antes de imprimir.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Editor de líneas</h2>
            <button
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpiar
            </button>
          </div>

          {config.lines.map((line, index) => (
            <div key={index} className="p-3 rounded-md bg-card border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Línea {index + 1}</span>
                {config.lines.length > 1 && (
                  <button
                    onClick={() => removeLine(index)}
                    className="text-xs text-destructive hover:text-destructive/80"
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Texto de la línea..."
                value={line.text}
                onChange={(e) => updateLine(index, "text", e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                <select
                  value={line.size}
                  onChange={(e) => updateLine(index, "size", e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-input border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="small">Pequeño</option>
                  <option value="normal">Normal</option>
                  <option value="large">Grande</option>
                  <option value="extra_large">Extra grande</option>
                </select>
                <select
                  value={line.alignment}
                  onChange={(e) => updateLine(index, "alignment", e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-input border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
                <button
                  onClick={() => updateLine(index, "bold", !line.bold)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                    line.bold
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  B
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addLine}
            className="w-full py-2 rounded-md border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            + Agregar línea
          </button>

          {/* Barcode toggle */}
          <div className="p-3 rounded-md bg-card border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">Código de barras</label>
              <button
                onClick={() => setConfig((prev) => ({ ...prev, showBarcode: !prev.showBarcode }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  config.showBarcode ? "bg-primary" : "bg-secondary"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    config.showBarcode ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {config.showBarcode && (
              <input
                type="text"
                placeholder="Número del código de barras"
                value={config.barcodeValue}
                onChange={(e) => setConfig((prev) => ({ ...prev, barcodeValue: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </div>

          {/* Copies and print */}
          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Copias:</label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.copies}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, copies: Math.max(1, parseInt(e.target.value) || 1) }))
                }
                className="w-16 px-2 py-1 rounded-md bg-input border border-border text-foreground text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="flex-1 py-3 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {printing ? "Imprimiendo..." : `🖨️ Imprimir${config.copies > 1 ? ` (${config.copies})` : ""}`}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">Vista previa</h2>
          <div
            className="bg-white text-black rounded-md border-2 border-border flex flex-col justify-center overflow-hidden"
            style={{ width: "100%", aspectRatio: "55/33", fontFamily: "monospace", padding: "8px" }}
          >
            {config.lines.filter((l) => l.text.trim()).length === 0 && !config.showBarcode ? (
              <p className="text-gray-400 text-center text-xs">Busca un producto o escribe texto</p>
            ) : (
              <>
                {config.lines.map((line, index) =>
                  line.text.trim() ? (
                    <p
                      key={index}
                      className={`${sizePreviewClass[line.size]} ${alignClass[line.alignment]} ${
                        line.bold ? "font-bold" : ""
                      } leading-tight`}
                    >
                      {line.text}
                    </p>
                  ) : null
                )}
                {config.showBarcode && config.barcodeValue && (
                  <div className="mt-1 text-center">
                    <div className="flex justify-center gap-px h-8">
                      {config.barcodeValue.split("").map((_, i) => (
                        <div
                          key={i}
                          className="bg-black"
                          style={{ width: i % 3 === 0 ? "3px" : "2px", opacity: i % 5 === 0 ? 0.3 : 1 }}
                        />
                      ))}
                    </div>
                    <p className="text-xs mt-0.5 font-mono">{config.barcodeValue}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Vista previa aproximada — 55mm × 33mm
          </p>
        </div>
      </div>
    </div>
  );
}
