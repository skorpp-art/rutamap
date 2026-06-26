"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Calendar,
  Search, Package, Users, Clock, RefreshCw, Truck, MapPin,
} from "lucide-react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  guardarAnalisisDiario, getAnalisisDiario, getAnalisisDiarioEstados,
  getAnalisisDiarioClientes, getAnalisisDiarioTarde, getAnalisisDiarioHistorico,
  getHistoricoCliente, getClientesAnalisisDiario,
} from "@/app/actions/analisis-diario";
import type {
  AnalisisDiarioPayload, ResumenAnalisisDia, EstadoDia, ClienteDia,
  TardeFila, HistoricoDia, HistoricoCliente,
} from "@/app/actions/analisis-diario";
import { useChartTheme } from "@/hooks/useChartTheme";
import { EmptyState } from "@/components/ui/empty-state";

// ── Helpers de parseo de los Excel ──────────────────────────────────────────
function toInt(v: unknown): number {
  const n = parseInt(String(v ?? "0").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
function toPct(v: unknown): number {
  const s = String(v ?? "0").replace("%", "").replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function parseFechaFromTitle(title: string): string | null {
  const m = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sheetRows(XLSX: typeof import("xlsx"), wb: any, nombre: string): any[][] {
  const ws = wb.Sheets[nombre];
  if (!ws) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResumenRendimiento(rows: any[][]) {
  let fecha: string | null = null;
  let post21 = { total: 0, entregados: 0, pctExito: 0 };
  for (const row of rows) {
    const label = String(row[0] ?? "");
    if (!fecha) {
      const f = parseFechaFromTitle(label);
      if (f) fecha = f;
    }
    if (label.includes("Después de las 21")) {
      post21 = { total: toInt(row[1]), entregados: toInt(row[2]), pctExito: toPct(row[3]) };
    }
  }
  return { fecha, post21 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTardanzasTabla(rows: any[][]) {
  const out: { nombre: string; cantidad: number; entregados: number; pctEfectividad: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nombre = String(row[0] ?? "").trim();
    if (!nombre) continue;
    const cantidad = toInt(row[1]);
    if (cantidad === 0 && !row[2]) continue;
    out.push({ nombre, cantidad, entregados: toInt(row[2]), pctEfectividad: toPct(row[3]) });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResumenGeneral(rows: any[][]) {
  let fecha: string | null = null;
  let totalPaquetes = 0;
  const estados: EstadoDia[] = [];
  let enEstadosSection = false;
  for (const row of rows) {
    const label = String(row[0] ?? "").trim();
    if (!fecha) {
      const f = parseFechaFromTitle(label);
      if (f) fecha = f;
    }
    if (label.includes("Total General de Paquetes")) totalPaquetes = toInt(row[1]);
    if (label.includes("RESUMEN DE ENVÍOS POR ESTADO")) { enEstadosSection = true; continue; }
    if (enEstadosSection) {
      if (!label) { enEstadosSection = false; continue; }
      estados.push({ estado: label, cantidad: toInt(row[1]), pct: toPct(row[2]) });
    }
  }
  return { fecha, totalPaquetes, estados };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResumenPorCliente(rows: any[][]) {
  const out: { cliente: string; cantidad: number; pctDelDia: number; enCamino: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cliente = String(row[0] ?? "").trim();
    if (!cliente) continue;
    const cantidad = toInt(row[1]);
    if (cantidad === 0) continue;
    out.push({ cliente, cantidad, pctDelDia: toPct(row[2]), enCamino: toInt(row[3]) });
  }
  return out;
}

async function parseArchivos(files: File[]): Promise<{ payload: AnalisisDiarioPayload | null; warnings: string[] }> {
  const XLSX = await import("xlsx");
  let resumenTarde: ReturnType<typeof parseResumenRendimiento> | null = null;
  let tardeZona: ReturnType<typeof parseTardanzasTabla> = [];
  let tardeChofer: ReturnType<typeof parseTardanzasTabla> = [];
  let resumenGeneral: ReturnType<typeof parseResumenGeneral> | null = null;
  let porCliente: ReturnType<typeof parseResumenPorCliente> = [];

  for (const file of files) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    if (wb.SheetNames.includes("Resumen de Rendimiento")) {
      resumenTarde = parseResumenRendimiento(sheetRows(XLSX, wb, "Resumen de Rendimiento"));
    }
    if (wb.SheetNames.includes("Tardanzas por Zona")) {
      tardeZona = parseTardanzasTabla(sheetRows(XLSX, wb, "Tardanzas por Zona"));
    }
    if (wb.SheetNames.includes("Tardanzas por Chofer")) {
      tardeChofer = parseTardanzasTabla(sheetRows(XLSX, wb, "Tardanzas por Chofer"));
    }
    if (wb.SheetNames.includes("Resumen General")) {
      resumenGeneral = parseResumenGeneral(sheetRows(XLSX, wb, "Resumen General"));
    }
    if (wb.SheetNames.includes("Resumen por Cliente")) {
      porCliente = parseResumenPorCliente(sheetRows(XLSX, wb, "Resumen por Cliente"));
    }
  }

  const warnings: string[] = [];
  if (!resumenGeneral) warnings.push("No se encontró el archivo \"Resumen de Envíos\" (falta la hoja \"Resumen General\").");
  if (!resumenTarde) warnings.push("No se encontró el archivo \"Análisis Tarde\" (falta la hoja \"Resumen de Rendimiento\").");
  if (!resumenGeneral || !resumenTarde) return { payload: null, warnings };

  const fecha = resumenGeneral.fecha ?? resumenTarde.fecha;
  if (!fecha) {
    warnings.push("No se pudo detectar la fecha en ninguno de los dos archivos.");
    return { payload: null, warnings };
  }

  const totalPaquetes = resumenGeneral.totalPaquetes;
  const entregados = resumenGeneral.estados.find(e => e.estado === "Entregado")?.cantidad ?? 0;
  const pctExito = totalPaquetes > 0 ? round2(entregados / totalPaquetes * 100) : 0;
  const enCamino = resumenGeneral.estados.find(e => e.estado.toLowerCase().includes("en camino al destinatario"))?.cantidad ?? 0;
  const enCaminoPct = totalPaquetes > 0 ? round2(enCamino / totalPaquetes * 100) : 0;

  const post21Total = resumenTarde.post21.total;
  const post21Entregados = resumenTarde.post21.entregados;
  const post21PctExito = post21Total > 0 ? round2(post21Entregados / post21Total * 100) : resumenTarde.post21.pctExito;
  const post21PctDelDia = totalPaquetes > 0 ? round2(post21Total / totalPaquetes * 100) : 0;

  const clientes: ClienteDia[] = porCliente.map(c => ({
    cliente: c.cliente,
    cantidad: c.cantidad,
    pct_del_dia: c.pctDelDia,
    en_camino_destinatario: c.enCamino,
    en_camino_destinatario_pct: c.cantidad > 0 ? round2(c.enCamino / c.cantidad * 100) : 0,
  }));

  const resumen: ResumenAnalisisDia = {
    total_paquetes: totalPaquetes,
    entregados,
    pct_exito: pctExito,
    post21_total: post21Total,
    post21_entregados: post21Entregados,
    post21_pct_exito: post21PctExito,
    post21_pct_del_dia: post21PctDelDia,
    en_camino_destinatario: enCamino,
    en_camino_destinatario_pct: enCaminoPct,
  };

  return {
    payload: {
      fecha, resumen,
      estados: resumenGeneral.estados,
      clientes,
      tardeZona: tardeZona.map(z => ({ zona: z.nombre, cantidad: z.cantidad, entregados: z.entregados, pct_efectividad: z.pctEfectividad })),
      tardeChofer: tardeChofer.map(c => ({ chofer: c.nombre, cantidad: c.cantidad, entregados: c.entregados, pct_efectividad: c.pctEfectividad })),
    },
    warnings,
  };
}

// ── Componente ───────────────────────────────────────────────────────────────
type Vista = "dia" | "historico";

export function AnalisisDiario() {
  const [vista, setVista] = useState<Vista>("dia");
  const fileRef = useRef<HTMLInputElement>(null);
  const ct = useChartTheme();

  // Carga / preview
  const [previa, setPrevia] = useState<AnalisisDiarioPayload | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Día consultado
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [resumen, setResumen] = useState<(ResumenAnalisisDia & { fecha: string }) | null>(null);
  const [estados, setEstados] = useState<EstadoDia[]>([]);
  const [clientes, setClientes] = useState<ClienteDia[]>([]);
  const [tarde, setTarde] = useState<TardeFila[]>([]);
  const [cargando, setCargando] = useState(false);

  // Histórico
  const [clientesDisponibles, setClientesDisponibles] = useState<string[]>([]);
  const [clienteSel, setClienteSel] = useState<string>("");
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [historicoGeneral, setHistoricoGeneral] = useState<HistoricoDia[]>([]);
  const [historicoCliente, setHistoricoCliente] = useState<HistoricoCliente[]>([]);
  const [cargandoHistorico, setCargandoHistorico] = useState(false);

  const cargarDia = useCallback(async (f: string) => {
    setCargando(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        getAnalisisDiario(f),
        getAnalisisDiarioEstados(f),
        getAnalisisDiarioClientes(f),
        getAnalisisDiarioTarde(f),
      ]);
      setResumen(r1.ok ? r1.data ?? null : null);
      setEstados(r2.ok ? r2.data ?? [] : []);
      setClientes(r3.ok ? r3.data ?? [] : []);
      setTarde(r4.ok ? r4.data ?? [] : []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { if (vista === "dia") cargarDia(fecha); }, [fecha, vista, cargarDia]);

  useEffect(() => {
    getClientesAnalisisDiario().then(res => { if (res.ok && res.data) setClientesDisponibles(res.data); });
  }, []);

  const cargarHistorico = useCallback(async () => {
    setCargandoHistorico(true);
    try {
      const resGen = await getAnalisisDiarioHistorico(desde, hasta);
      setHistoricoGeneral(resGen.ok ? resGen.data ?? [] : []);
      if (clienteSel) {
        const resCli = await getHistoricoCliente(clienteSel, desde, hasta);
        setHistoricoCliente(resCli.ok ? resCli.data ?? [] : []);
      } else {
        setHistoricoCliente([]);
      }
    } finally { setCargandoHistorico(false); }
  }, [desde, hasta, clienteSel]);

  useEffect(() => { if (vista === "historico") cargarHistorico(); }, [vista, cargarHistorico]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const { payload, warnings: w } = await parseArchivos(files);
      setWarnings(w);
      if (!payload) {
        toast.error("No se pudo procesar la carga", { description: w.join(" ") });
        setPrevia(null);
        return;
      }
      setPrevia(payload);
      toast.success(`Detectado ${payload.fecha} — ${payload.resumen.total_paquetes.toLocaleString("es-AR")} paquetes`);
    } catch (err) {
      toast.error("Error al leer los archivos", { description: String(err) });
    }
  }

  async function confirmarCarga() {
    if (!previa) return;
    setGuardando(true);
    try {
      const res = await guardarAnalisisDiario(previa);
      if (!res.ok) { toast.error("Error al guardar", { description: res.error }); return; }
      toast.success(`Análisis del ${previa.fecha} guardado`);
      setFecha(previa.fecha);
      setVista("dia");
      setPrevia(null);
      setWarnings([]);
      if (fileRef.current) fileRef.current.value = "";
      await cargarDia(previa.fecha);
      const resC = await getClientesAnalisisDiario();
      if (resC.ok && resC.data) setClientesDisponibles(resC.data);
    } finally { setGuardando(false); }
  }

  const tardeZonas = tarde.filter(t => t.tipo === "zona");
  const tardeChoferes = tarde.filter(t => t.tipo === "chofer");

  const chartGeneral = historicoGeneral.map(d => ({
    dia: d.fecha.slice(5),
    post21Pct: d.post21_pct_del_dia,
    enCaminoPct: d.en_camino_destinatario_pct,
    total: d.total_paquetes,
  }));
  const chartCliente = historicoCliente.map(d => ({
    dia: d.fecha.slice(5),
    enCaminoPct: d.en_camino_destinatario_pct,
    cantidad: d.cantidad,
  }));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            Análisis del Día
          </h2>
          <p className="text-xs text-muted-foreground">
            Entregas post-21hs, estados del día y "en camino al destinatario" por cliente.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            <button onClick={() => setVista("dia")}
              className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === "dia" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              Día
            </button>
            <button onClick={() => setVista("historico")}
              className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === "historico" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              Histórico
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={handleFiles} />
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Cargar reportes del día
          </Button>
        </div>
      </div>

      {/* Preview de carga */}
      {previa && (
        <div className="border rounded-xl p-4 space-y-3 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <p className="text-sm font-bold">Vista previa — {previa.fecha}</p>
          </div>
          {warnings.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              {warnings.map((w, i) => <p key={i} className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" /> {w}</p>)}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniKpi label="Total paquetes" valor={previa.resumen.total_paquetes.toLocaleString("es-AR")} />
            <MiniKpi label="% éxito" valor={`${previa.resumen.pct_exito.toFixed(2)}%`} />
            <MiniKpi label="Post-21" valor={`${previa.resumen.post21_total} (${previa.resumen.post21_pct_del_dia.toFixed(2)}%)`} />
            <MiniKpi label="En camino al destinatario" valor={`${previa.resumen.en_camino_destinatario} (${previa.resumen.en_camino_destinatario_pct.toFixed(2)}%)`} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {previa.clientes.length} clientes · {previa.tardeZona.length} zonas con tardanza · {previa.tardeChofer.length} choferes con tardanza
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmarCarga} disabled={guardando} className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              {guardando ? "Guardando…" : "Confirmar y guardar"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPrevia(null); setWarnings([]); if (fileRef.current) fileRef.current.value = ""; }}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {vista === "dia" ? (
        <DiaView
          fecha={fecha} setFecha={setFecha} cargando={cargando}
          resumen={resumen} estados={estados} clientes={clientes}
          tardeZonas={tardeZonas} tardeChoferes={tardeChoferes}
          onRefrescar={() => cargarDia(fecha)}
        />
      ) : (
        <HistoricoView
          desde={desde} setDesde={setDesde} hasta={hasta} setHasta={setHasta}
          clienteSel={clienteSel} setClienteSel={setClienteSel}
          clientesDisponibles={clientesDisponibles}
          cargando={cargandoHistorico}
          chartGeneral={chartGeneral} chartCliente={chartCliente}
          historicoCliente={historicoCliente}
          ct={ct}
        />
      )}
    </div>
  );
}

function MiniKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-background border rounded-lg px-3 py-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{valor}</p>
    </div>
  );
}

// ── Vista Día ────────────────────────────────────────────────────────────────
function DiaView({
  fecha, setFecha, cargando, resumen, estados, clientes, tardeZonas, tardeChoferes, onRefrescar,
}: {
  fecha: string; setFecha: (f: string) => void; cargando: boolean;
  resumen: (ResumenAnalisisDia & { fecha: string }) | null;
  estados: EstadoDia[]; clientes: ClienteDia[];
  tardeZonas: TardeFila[]; tardeChoferes: TardeFila[];
  onRefrescar: () => void;
}) {
  const clientesOrdenados = [...clientes].sort((a, b) => b.en_camino_destinatario - a.en_camino_destinatario || b.cantidad - a.cantidad);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="text-xs border rounded-md px-2 py-1 bg-background" />
        <button onClick={onRefrescar} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
        </button>
      </div>

      {!resumen && !cargando ? (
        <EmptyState icon={Package} title="Sin datos para este día"
          description="Cargá los dos reportes (Resumen de Envíos + Análisis Tarde) para este día." />
      ) : resumen ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={Package} label="Total paquetes" valor={resumen.total_paquetes.toLocaleString("es-AR")} color="text-blue-600 dark:text-blue-300" />
            <KpiCard icon={CheckCircle} label="% éxito del día" valor={`${resumen.pct_exito.toFixed(2)}%`} color="text-emerald-600 dark:text-emerald-300" />
            <KpiCard icon={Clock} label="Post-21hs" valor={`${resumen.post21_total} (${resumen.post21_pct_del_dia.toFixed(2)}%)`}
              sub={`% éxito tardío: ${resumen.post21_pct_exito.toFixed(2)}%`} color="text-amber-600 dark:text-amber-300" />
            <KpiCard icon={Truck} label="En camino al destinatario" valor={`${resumen.en_camino_destinatario} (${resumen.en_camino_destinatario_pct.toFixed(2)}%)`} color="text-violet-600 dark:text-violet-300" />
          </div>

          {/* Estados */}
          <div className="border rounded-xl overflow-hidden">
            <p className="text-xs font-bold px-4 py-2.5 bg-muted/30 border-b">Resolución del día por estado</p>
            <table className="w-full text-xs">
              <thead className="bg-muted/20">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cantidad</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">% del total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {estados.map(e => (
                  <tr key={e.estado} className={cn(e.estado.toLowerCase().includes("en camino al destinatario") && "bg-violet-50/50 dark:bg-violet-950/20")}>
                    <td className="px-4 py-1.5">{e.estado}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{e.cantidad.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{e.pct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Clientes — en camino al destinatario */}
          <div className="border rounded-xl overflow-hidden">
            <p className="text-xs font-bold px-4 py-2.5 bg-muted/30 border-b flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Clientes — "en camino al destinatario"
            </p>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Paquetes</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">% del día</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">En camino</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">% propio</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clientesOrdenados.map(c => (
                    <tr key={c.cliente} className={cn(c.en_camino_destinatario > 0 && "bg-violet-50/40 dark:bg-violet-950/20")}>
                      <td className="px-4 py-1.5">{c.cliente}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{c.cantidad.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{c.pct_del_dia.toFixed(2)}%</td>
                      <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{c.en_camino_destinatario || "—"}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        {c.en_camino_destinatario > 0 ? `${c.en_camino_destinatario_pct.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Post-21 por zona y chofer */}
          <div className="grid sm:grid-cols-2 gap-4">
            <TardeTabla titulo="Post-21hs por zona" icono={MapPin} filas={tardeZonas} />
            <TardeTabla titulo="Post-21hs por chofer" icono={Truck} filas={tardeChoferes} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ icon: Icon, label, valor, sub, color }: {
  icon: React.ComponentType<{ className?: string }>; label: string; valor: string; sub?: string; color: string;
}) {
  return (
    <div className="border rounded-xl p-3 bg-background">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", color)} /> {label}
      </div>
      <p className={cn("text-lg font-bold tabular-nums mt-0.5", color)}>{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TardeTabla({ titulo, icono: Icon, filas }: {
  titulo: string; icono: React.ComponentType<{ className?: string }>; filas: TardeFila[];
}) {
  const ordenadas = [...filas].sort((a, b) => b.cantidad - a.cantidad);
  return (
    <div className="border rounded-xl overflow-hidden">
      <p className="text-xs font-bold px-4 py-2.5 bg-muted/30 border-b flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </p>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/20 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nombre</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Tarde</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Entregados</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">% efect.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ordenadas.map(f => (
              <tr key={f.nombre}>
                <td className="px-3 py-1.5">{f.nombre}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.cantidad}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.entregados}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.pct_efectividad.toFixed(1)}%</td>
              </tr>
            ))}
            {ordenadas.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Vista Histórico ──────────────────────────────────────────────────────────
function HistoricoView({
  desde, setDesde, hasta, setHasta, clienteSel, setClienteSel, clientesDisponibles,
  cargando, chartGeneral, chartCliente, historicoCliente, ct,
}: {
  desde: string; setDesde: (v: string) => void;
  hasta: string; setHasta: (v: string) => void;
  clienteSel: string; setClienteSel: (v: string) => void;
  clientesDisponibles: string[];
  cargando: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chartGeneral: any[]; chartCliente: any[];
  historicoCliente: HistoricoCliente[];
  ct: ReturnType<typeof useChartTheme>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="text-xs border rounded-md px-2 py-1 bg-background" />
        <span className="text-xs text-muted-foreground">a</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="text-xs border rounded-md px-2 py-1 bg-background" />
        <Search className="h-4 w-4 text-muted-foreground ml-3" />
        <select value={clienteSel} onChange={e => setClienteSel(e.target.value)}
          className="text-xs border rounded-md px-2 py-1 bg-background min-w-48">
          <option value="">Todos los días (general)</option>
          {clientesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {cargando && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {!clienteSel ? (
        <div className="border rounded-xl p-4">
          <p className="text-xs font-bold mb-2">Evolución general — % post-21 y % "en camino al destinatario"</p>
          {chartGeneral.length === 0 ? (
            <EmptyState icon={Clock} title="Sin datos en este rango" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartGeneral}>
                <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                <YAxis tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                <Tooltip {...ct.tooltip} />
                <Line type="monotone" dataKey="post21Pct" name="% post-21" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="enCaminoPct" name="% en camino al destinatario" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <div className="border rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold">% "en camino al destinatario" de {clienteSel}</p>
          {chartCliente.length === 0 ? (
            <EmptyState icon={Users} title={`Sin datos de ${clienteSel} en este rango`} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartCliente}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="pct" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                  <YAxis yAxisId="cant" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <Tooltip {...ct.tooltip} />
                  <Bar yAxisId="cant" dataKey="cantidad" name="Paquetes del día" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="enCaminoPct" name="% en camino al destinatario" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="flex items-center gap-4 text-xs bg-muted/30 rounded-lg p-3">
                <div>
                  <p className="text-muted-foreground">Promedio del período</p>
                  <p className="font-bold text-base tabular-nums text-violet-600 dark:text-violet-300">
                    {(historicoCliente.reduce((s, d) => s + d.en_camino_destinatario_pct, 0) / historicoCliente.length).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total "en camino"</p>
                  <p className="font-bold text-base tabular-nums">
                    {historicoCliente.reduce((s, d) => s + d.en_camino_destinatario, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total paquetes</p>
                  <p className="font-bold text-base tabular-nums">
                    {historicoCliente.reduce((s, d) => s + d.cantidad, 0)}
                  </p>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Paquetes</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">En camino</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historicoCliente.map(d => (
                    <tr key={d.fecha}>
                      <td className="px-3 py-1.5">{d.fecha}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.cantidad}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.en_camino_destinatario}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{d.en_camino_destinatario_pct.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
