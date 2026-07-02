"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Package, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import {
  importarClientesExcel, getRecorridosBase,
  upsertClienteManual, getClientesManuales, eliminarClienteManual,
} from "@/app/actions/volumenes";
import type { ClienteManual } from "@/app/actions/volumenes";
import { hoyAR, addDiasAR } from "@/lib/fechas";

const hoy = hoyAR;
const addDias = addDiasAR;
function fechaDesdeNombre(nombre: string): string | null {
  const m = nombre.match(/(\d{8})/);
  if (!m) return null;
  const s = m[1];
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

interface Props {
  /** Se llama tras importar o cambiar clientes manuales, para refrescar al padre. */
  onImportado?: () => void;
  targetPkg?: number;
}

export function ImportarClientes({ onImportado, targetPkg = 30 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ cliente: string; paquetes: number }[]>([]);
  const [fechaImport, setFechaImport] = useState(hoy());
  const [importando, setImportando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [vistaTab, setVistaTab] = useState<"preview" | "topClientes">("preview");
  const [rutasFijas, setRutasFijas] = useState(53);

  // Clientes manuales (cliente grande que no figura en el Excel)
  const [clientesManuales, setClientesManuales] = useState<ClienteManual[]>([]);
  const [manualNombre, setManualNombre] = useState("");
  const [manualPaquetes, setManualPaquetes] = useState("");
  const [guardandoManual, setGuardandoManual] = useState(false);

  useEffect(() => {
    getRecorridosBase().then(res => {
      if (res.ok && res.data) {
        const rf = res.data.filter(r => r.tipo === "fijo" && r.activo).length;
        if (rf > 0) setRutasFijas(rf);
      }
    });
  }, []);

  const cargarManuales = useCallback(async (f: string) => {
    const res = await getClientesManuales(f);
    if (res.ok && res.data) setClientesManuales(res.data);
  }, []);
  useEffect(() => { cargarManuales(fechaImport); }, [fechaImport, cargarManuales]);

  async function agregarClienteManual() {
    const nombre = manualNombre.trim();
    const pkg = parseInt(manualPaquetes) || 0;
    if (!nombre || pkg <= 0) { toast.error("Ingresá nombre y cantidad de paquetes"); return; }
    setGuardandoManual(true);
    try {
      const res = await upsertClienteManual(fechaImport, nombre, pkg);
      if (!res.ok) { toast.error("Error al guardar", { description: res.error }); return; }
      toast.success(`${nombre} agregado (${pkg} paq) para el ${fechaImport}`);
      setManualNombre(""); setManualPaquetes("");
      await cargarManuales(fechaImport);
      onImportado?.();
    } finally { setGuardandoManual(false); }
  }

  async function quitarClienteManual(id: string) {
    const res = await eliminarClienteManual(id);
    if (!res.ok) { toast.error("Error al eliminar"); return; }
    toast.success("Cliente manual eliminado");
    await cargarManuales(fechaImport);
    onImportado?.();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);
    const fechaDet = fechaDesdeNombre(file.name);
    if (fechaDet) setFechaImport(fechaDet);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const parsed: { cliente: string; paquetes: number }[] = [];
        for (let i = 1; i < rows.length; i++) {
          const cliente = String(rows[i][0] ?? "").trim();
          const paquetes = parseInt(String(rows[i][1] ?? "0")) || 0;
          if (cliente && paquetes > 0) parsed.push({ cliente, paquetes });
        }
        setPreview(parsed);
        const total = parsed.reduce((s, r) => s + r.paquetes, 0);
        toast.success(`${parsed.length} clientes · ${total.toLocaleString("es-AR")} paquetes${fechaDet ? ` · fecha: ${fechaDet}` : ""}`);
      } catch { toast.error("Error al leer el archivo"); }
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmarImport() {
    if (!preview.length) return;
    setImportando(true);
    try {
      const res = await importarClientesExcel(fechaImport, preview);
      if (!res.ok) { toast.error("Error al importar", { description: res.error }); return; }
      toast.success(`${res.importados} registros importados para ${fechaImport}`);
      setPreview([]); setNombreArchivo("");
      if (fileRef.current) fileRef.current.value = "";
      onImportado?.();
    } finally { setImportando(false); }
  }

  const totalPreview = preview.reduce((s, r) => s + r.paquetes, 0);

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-300" />
        <h2 className="text-sm font-semibold">Paquetes por cliente</h2>
      </div>

      {/* Formato esperado */}
      <div className="border rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40 space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Formato detectado automáticamente:</p>
        <div className="flex items-center gap-4">
          <table className="text-xs border rounded overflow-hidden text-left">
            <thead className="bg-slate-200 dark:bg-slate-700">
              <tr><th className="px-3 py-1.5">A — Cliente</th><th className="px-3 py-1.5">B — Cantidad de Paquetes</th></tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900">
              <tr className="border-t"><td className="px-3 py-1.5">GAMING CITY</td><td className="px-3 py-1.5 tabular-nums">258</td></tr>
              <tr className="border-t"><td className="px-3 py-1.5">DOMESTICABLES</td><td className="px-3 py-1.5 tabular-nums">172</td></tr>
              <tr className="border-t"><td className="px-3 py-1.5">…</td><td className="px-3 py-1.5">…</td></tr>
            </tbody>
          </table>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p>✅ Columna A: nombre del cliente</p>
            <p>✅ Columna B: cantidad de paquetes</p>
            <p>✅ Fecha auto-detectada del nombre del archivo</p>
            <p className="text-slate-400 dark:text-slate-500">Ejemplo: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Listado_Clientes_20260530.xlsx</code></p>
          </div>
        </div>
      </div>

      {/* Selector de fecha + archivo */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium">Fecha:</label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setFechaImport(addDias(fechaImport, -1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <input type="date" value={fechaImport} onChange={e => setFechaImport(e.target.value)}
              className="border rounded px-2 py-1 text-xs h-7 bg-background" />
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={fechaImport >= hoy()}
              onClick={() => setFechaImport(addDias(fechaImport, 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs h-8"
          onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" />
          {nombreArchivo || "Seleccionar archivo Excel"}
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      </div>

      {/* ── Cliente manual (grande que no figura en el Excel) ── */}
      <div className="border rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Cliente manual</p>
          <span className="text-[11px] text-amber-600/80 dark:text-amber-300">— se suma al total y sobrevive a las reimportaciones del Excel</span>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Nombre del cliente</label>
            <input type="text" value={manualNombre}
              placeholder="ej: MERCADO LIBRE FLEX"
              onChange={e => setManualNombre(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") agregarClienteManual(); }}
              className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-background focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="w-28">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Paquetes</label>
            <input type="number" min={1} value={manualPaquetes}
              placeholder="0"
              onChange={e => setManualPaquetes(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") agregarClienteManual(); }}
              className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-background tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <Button onClick={agregarClienteManual} disabled={guardandoManual}
            className="h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
            {guardandoManual ? "…" : "Agregar"}
          </Button>
        </div>

        {clientesManuales.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Manuales del {fechaImport}:</p>
            {clientesManuales.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs bg-white/70 rounded-lg px-3 py-1.5">
                <span className="flex-1 font-medium">{c.cliente}</span>
                <span className="font-bold tabular-nums text-amber-700 dark:text-amber-300">{c.paquetes} paq</span>
                <button onClick={() => quitarClienteManual(c.id)}
                  className="text-muted-foreground/40 hover:text-red-600 transition-colors"
                  title="Quitar">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-green-50 dark:bg-green-950/40 flex items-center gap-3">
            <Package className="h-4 w-4 text-green-600 dark:text-green-300" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-300">
              {preview.length} clientes · {totalPreview.toLocaleString("es-AR")} paquetes · {(totalPreview / rutasFijas).toFixed(1)} prom/ruta · {Math.ceil(totalPreview / targetPkg)} choferes
            </span>
          </div>

          <div className="border-b flex">
            {(["preview", "topClientes"] as const).map(t => (
              <button key={t} onClick={() => setVistaTab(t)}
                className={cn("px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                  vistaTab === t ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-muted-foreground")}>
                {t === "preview" ? `Todos (${preview.length})` : "Top 10"}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-background border-b sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2 text-muted-foreground">Cliente</th>
                  <th className="text-right px-3 py-2 text-muted-foreground">Paquetes</th>
                  <th className="text-right px-3 py-2 text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(vistaTab === "topClientes"
                  ? [...preview].sort((a, b) => b.paquetes - a.paquetes).slice(0, 10)
                  : preview
                ).map((r, i) => (
                  <tr key={i} className="hover:bg-accent/20">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{r.cliente}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{r.paquetes}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">
                      {totalPreview > 0 ? ((r.paquetes / totalPreview) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={2} className="px-3 py-2 font-semibold text-xs">TOTAL</td>
                  <td className="px-3 py-2 text-right font-bold">{totalPreview.toLocaleString("es-AR")}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="px-4 py-3 border-t flex items-center gap-3 bg-background">
            <Button size="sm" onClick={confirmarImport} disabled={importando}
              className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white">
              <FileSpreadsheet className="h-3 w-3" />
              {importando ? "Guardando…" : `Confirmar — ${fechaImport}`}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs"
              onClick={() => { setPreview([]); setNombreArchivo(""); if (fileRef.current) fileRef.current.value = ""; }}>
              Cancelar
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              Reemplaza los datos de ese día si ya existían
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
