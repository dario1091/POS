import { useState } from "react";
import { api } from "@/lib/api";

interface LabelLine {
  text: string;
  size: "small" | "normal" | "large" | "extra_large";
  alignment: "left" | "center" | "right";
  bold: boolean;
}

const defaultLine: LabelLine = { text: "", size: "normal", alignment: "center", bold: false };

export function LabelsPage() {
  const [lines, setLines] = useState<LabelLine[]>([
    { text: "", size: "normal", alignment: "center", bold: false },
    { text: "", size: "large", alignment: "center", bold: true },
    { text: "", size: "small", alignment: "center", bold: false },
  ]);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateLine = (index: number, field: keyof LabelLine, value: string | boolean) => {
    setLines((prev) => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { ...defaultLine }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrint = async () => {
    const nonEmpty = lines.filter((l) => l.text.trim());
    if (nonEmpty.length === 0) {
      setError("Agrega al menos una línea con texto");
      return;
    }
    setPrinting(true);
    setError("");
    try {
      await api.printLabel(nonEmpty, copies);
      setSuccess(`✅ ${copies} etiqueta${copies > 1 ? "s" : ""} impresa${copies > 1 ? "s" : ""}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setPrinting(false);
    }
  };

  const sizePreviewClass: Record<string, string> = {
    small: "text-xs",
    normal: "text-sm",
    large: "text-xl",
    extra_large: "text-3xl",
  };
  const alignClass: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Etiquetas de Precio</h1>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {success && <p className="text-sm text-success mb-4">{success}</p>}

      <div className="grid grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Editor de líneas</h2>

          {lines.map((line, index) => (
            <div key={index} className="p-3 rounded-md bg-card border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Línea {index + 1}</span>
                {lines.length > 1 && (
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

          {/* Copies and print */}
          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Copias:</label>
              <input
                type="number"
                min="1"
                max="50"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 rounded-md bg-input border border-border text-foreground text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="flex-1 py-3 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {printing ? "Imprimiendo..." : `🖨️ Imprimir ${copies > 1 ? `(${copies} copias)` : ""}`}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">Vista previa</h2>
          <div className="bg-white text-black rounded-md p-4 border-2 border-border min-h-[200px] flex flex-col justify-center" style={{ width: "100%", fontFamily: "monospace" }}>
            {lines.filter(l => l.text.trim()).length === 0 ? (
              <p className="text-gray-400 text-center text-sm">Escribe algo para ver la vista previa</p>
            ) : (
              lines.map((line, index) => (
                line.text.trim() ? (
                  <p
                    key={index}
                    className={`${sizePreviewClass[line.size]} ${alignClass[line.alignment]} ${line.bold ? "font-bold" : ""} leading-relaxed`}
                  >
                    {line.text}
                  </p>
                ) : null
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            La impresión real puede variar ligeramente según la impresora.
          </p>
        </div>
      </div>
    </div>
  );
}
