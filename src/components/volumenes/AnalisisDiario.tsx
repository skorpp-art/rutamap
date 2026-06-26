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
  getHistoricoCliente, getClientesAnalisisDiario, getClientesTotalesPeriodo,
} from "@/app/actions/analisis-diario";
import type {
  AnalisisDiarioPayload, ResumenAnalisisDia, EstadoDia, ClienteDia,
  TardeFila, HistoricoDia, HistoricoCliente, ClienteTotalPeriodo,
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

interface TardeRaw {
  fecha: string | null;
  post21: { total: number; entregados: number; pctExito: number };
  tardeZona: { nombre: string; cantidad: number; entregados: number; pctEfectividad: number }[];
  tardeChofer: { nombre: string; cantidad: number; entregados: number; pctEfectividad: number }[];
}
interface ResumenRaw {
  fecha: string | null;
  totalPaquetes: number;
  estados: EstadoDia[];
  porCliente: { cliente: string; cantidad: number; pctDelDia: number; enCamino: number }[];
}

async function parseArchivoTarde(file: File): Promise<{ data: TardeRaw | null; warning?: string }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  if (!wb.SheetNames.includes("Resumen de Rendimiento")) {
    return { data: null, warning: "El archivo no parece ser \"Análisis Tarde\" (falta la hoja \"Resumen de Rendimiento\")." };
  }
  const resumenTarde = parseResumenRendimiento(sheetRows(XLSX, wb, "Resumen de Rendimiento"));
  const tardeZona = wb.SheetNames.includes("Tardanzas por Zona") ? parseTardanzasTabla(sheetRows(XLSX, wb, "Tardanzas por Zona")) : [];
  const tardeChofer = wb.SheetNames.includes("Tardanzas por Chofer") ? parseTardanzasTabla(sheetRows(XLSX, wb, "Tardanzas por Chofer")) : [];
  return {
    data: {
      fecha: resumenTarde.fecha,
      post21: resumenTarde.post21,
      tardeZona, tardeChofer,
    },
  };
}

async function parseArchivoResumen(file: File): Promise<{ data: ResumenRaw | null; warning?: string }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  if (!wb.SheetNames.includes("Resumen General")) {
    return { data: null, warning: "El archivo no parece ser \"Resumen de Envíos\" (falta la hoja \"Resumen General\")." };
  }
  const resumenGeneral = parseResumenGeneral(sheetRows(XLSX, wb, "Resumen General"));
  const porCliente = wb.SheetNames.includes("Resumen por Cliente") ? parseResumenPorCliente(sheetRows(XLSX, wb, "Resumen por Cliente")) : [];
  return { data: { fecha: resumenGeneral.fecha, totalPaquetes: resumenGeneral.totalPaquetes, estados: resumenGeneral.estados, porCliente } };
}

function construirPayload(tardeRaw: TardeRaw | null, resumenRaw: ResumenRaw | null): { payload: AnalisisDiarioPayload | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!resumenRaw) warnings.push("Falta cargar el archivo \"Resumen de Envíos\".");
  if (!tardeRaw) warnings.push("Falta cargar el archivo \"Análisis Tarde\".");
  if (!resumenRaw || !tardeRaw) return { payload: null, warnings };

  const fecha = resumenRaw.fecha ?? tardeRaw.fecha;
  if (!fecha) {
    warnings.push("No se pudo detectar la fecha en ninguno de los dos archivos.");
    return { payload: null, warnings };
  }

  const totalPaquetes = resumenRaw.totalPaquetes;
  const entregados = resumenRaw.estados.find(e => e.estado === "Entregado")?.cantidad ?? 0;
  const pctExito = totalPaquetes > 0 ? round2(entregados / totalPaquetes * 100) : 0;
  // Demorado = todo lo "post-21hs" que no se entregó (en camino al destinatario, reprogramado, etc.)
  const enCamino = Math.max(0, tardeRaw.post21.total - tardeRaw.post21.entregados);
  const enCaminoPct = totalPaquetes > 0 ? round2(enCamino / totalPaquetes * 100) : 0;

  const post21Total = tardeRaw.post21.total;
  const post21Entregados = tardeRaw.post21.entregados;
  const post21PctExito = post21Total > 0 ? round2(post21Entregados / post21Total * 100) : tardeRaw.post21.pctExito;
  const post21PctDelDia = totalPaquetes > 0 ? round2(post21Total / totalPaquetes * 100) : 0;

  const clientes: ClienteDia[] = resumenRaw.porCliente.map(c => ({
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
      estados: resumenRaw.estados,
      clientes,
      tardeZona: tardeRaw.tardeZona.map(z => ({ zona: z.nombre, cantidad: z.cantidad, entregados: z.entregados, pct_efectividad: z.pctEfectividad })),
      tardeChofer: tardeRaw.tardeChofer.map(c => ({ chofer: c.nombre, cantidad: c.cantidad, entregados: c.entregados, pct_efectividad: c.pctEfectividad })),
    },
    warnings,
  };
}

// ── Componente ───────────────────────────────────────────────────────────────
type Vista = "dia" | "historico";

export function AnalisisDiario() {
  const [vista, setVista] = useState<Vista>("dia");
  const fileTardeRef = useRef<HTMLInputElement>(null);
  const fileResumenRef = useRef<HTMLInputElement>(null);
  const ct = useChartTheme();

  // Carga / preview — cada archivo se sube por separado y se combinan acá
  const [tardeRaw, setTardeRaw] = useState<TardeRaw | null>(null);
  const [resumenRaw, setResumenRaw] = useState<ResumenRaw | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { payload: previa, warnings } = (tardeRaw || resumenRaw)
    ? construirPayload(tardeRaw, resumenRaw)
    : { payload: null, warnings: [] as string[] };

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
  const [clientesTotales, setClientesTotales] = useState<ClienteTotalPeriodo[]>([]);
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
      const [resGen, resTotales] = await Promise.all([
        getAnalisisDiarioHistorico(desde, hasta),
        getClientesTotalesPeriodo(desde, hasta),
      ]);
      setHistoricoGeneral(resGen.ok ? resGen.data ?? [] : []);
      setClientesTotales(resTotales.ok ? resTotales.data ?? [] : []);
      if (clienteSel) {
        const resCli = await getHistoricoCliente(clienteSel, desde, hasta);
        setHistoricoCliente(resCli.ok ? resCli.data ?? [] : []);
      } else {
        setHistoricoCliente([]);
      }
    } finally { setCargandoHistorico(false); }
  }, [desde, hasta, clienteSel]);

  useEffect(() => { if (vista === "historico") cargarHistorico(); }, [vista, cargarHistorico]);

  async function handleFileTarde(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data, warning } = await parseArchivoTarde(file);
      if (!data) {
        toast.error("No se pudo procesar \"Análisis Tarde\"", { description: warning });
        return;
      }
      setTardeRaw(data);
      toast.success(`"Análisis Tarde" cargado${data.fecha ? ` — ${data.fecha}` : ""}`);
    } catch (err) {
      toast.error("Error al leer el archivo", { description: String(err) });
    }
  }

  async function handleFileResumen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data, warning } = await parseArchivoResumen(file);
      if (!data) {
        toast.error("No se pudo procesar \"Resumen de Envíos\"", { description: warning });
        return;
      }
      setResumenRaw(data);
      toast.success(`"Resumen de Envíos" cargado${data.fecha ? ` — ${data.fecha}` : ""} — ${data.totalPaquetes.toLocaleString("es-AR")} paquetes`);
    } catch (err) {
      toast.error("Error al leer el archivo", { description: String(err) });
    }
  }

  function descartarCarga() {
    setTardeRaw(null);
    setResumenRaw(null);
    if (fileTardeRef.current) fileTardeRef.current.value = "";
    if (fileResumenRef.current) fileResumenRef.current.value = "";
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
      descartarCarga();
      await cargarDia(previa.fecha);
      const resC = await getClientesAnalisisDiario();
      if (resC.ok && resC.data) setClientesDisponibles(resC.data);
    } finally { setGuardando(false); }
  }

  const tardeZonas = tarde.filter(t => t.tipo === "zona");
  const tardeChoferes = tarde.filter(t => t.tipo === "chofer");

  const chartGeneral = historicoGeneral.map(d => ({
    dia: d.fecha.slice(5),
    total: d.total_paquetes,
    pctExito: d.pct_exito,
    post21Total: d.post21_total,
    post21Pct: d.post21_pct_del_dia,
    enCaminoTotal: d.en_camino_destinatario,
    enCaminoPct: d.en_camino_destinatario_pct,
  }));
  const chartCliente = historicoCliente.map(d => ({
    dia: d.fecha.slice(5),
    enCaminoPct: d.en_camino_destinatario_pct,
    cantidad: d.cantidad,
  }));
  const chartClientesTotales = clientesTotales.slice(0, 15).map(c => ({
    cliente: c.cliente.length > 18 ? c.cliente.slice(0, 17) + "…" : c.cliente,
    clienteCompleto: c.cliente,
    total: c.total_paquetes,
    enCamino: c.total_en_camino,
    pctEnCamino: c.pct_en_camino,
  }));
  const totalesPeriodo = historicoGeneral.reduce((acc, d) => ({
    total: acc.total + d.total_paquetes,
    post21: acc.post21 + d.post21_total,
    enCamino: acc.enCamino + d.en_camino_destinatario,
  }), { total: 0, post21: 0, enCamino: 0 });

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            Análisis del Día
          </h2>
          <p className="text-xs text-muted-foreground">
            Entregas post-21hs, estados del día y demorados (todo lo post-21hs sin entregar) por cliente.
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
          <input ref={fileTardeRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileTarde} />
          <input ref={fileResumenRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileResumen} />
          <Button size="sm" variant={tardeRaw ? "secondary" : "outline"} className="gap-1.5 text-xs h-8" onClick={() => fileTardeRef.current?.click()}>
            {tardeRaw ? <CheckCircle className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            Análisis Tarde
          </Button>
          <Button size="sm" variant={resumenRaw ? "secondary" : "outline"} className="gap-1.5 text-xs h-8" onClick={() => fileResumenRef.current?.click()}>
            {resumenRaw ? <CheckCircle className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            Resumen de Envíos
          </Button>
        </div>
      </div>

      {/* Preview de carga */}
      {(tardeRaw || resumenRaw) && (
        <div className="border rounded-xl p-4 space-y-3 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <p className="text-sm font-bold">Vista previa{previa ? ` — ${previa.fecha}` : ""}</p>
          </div>
          {warnings.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              {warnings.map((w, i) => <p key={i} className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" /> {w}</p>)}
            </div>
          )}
          {previa && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniKpi label="Total paquetes" valor={previa.resumen.total_paquetes.toLocaleString("es-AR")} />
                <MiniKpi label="% éxito" valor={`${previa.resumen.pct_exito.toFixed(2)}%`} />
                <MiniKpi label="Post-21" valor={`${previa.resumen.post21_total} (${previa.resumen.post21_pct_del_dia.toFixed(2)}%)`} />
                <MiniKpi label="Demorados" valor={`${previa.resumen.en_camino_destinatario} (${previa.resumen.en_camino_destinatario_pct.toFixed(2)}%)`} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {previa.clientes.length} clientes · {previa.tardeZona.length} zonas con tardanza · {previa.tardeChofer.length} choferes con tardanza
              </p>
            </>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmarCarga} disabled={guardando || !previa} className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              {guardando ? "Guardando…" : "Confirmar y guardar"}
            </Button>
            <Button size="sm" variant="outline" onClick={descartarCarga}>
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
          chartClientesTotales={chartClientesTotales}
          totalesPeriodo={totalesPeriodo}
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
            <KpiCard icon={Truck} label="Demorados" valor={`${resumen.en_camino_destinatario} (${resumen.en_camino_destinatario_pct.toFixed(2)}%)`}
              sub="post-21hs sin entregar" color="text-violet-600 dark:text-violet-300" />
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

          {/* Clientes — demorados (en camino al destinatario) */}
          <div className="border rounded-xl overflow-hidden">
            <p className="text-xs font-bold px-4 py-2.5 bg-muted/30 border-b flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Clientes — demorados ("en camino al destinatario")
            </p>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Paquetes</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">% del día</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Demorados</th>
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
  cargando, chartGeneral, chartCliente, chartClientesTotales, totalesPeriodo, historicoCliente, ct,
}: {
  desde: string; setDesde: (v: string) => void;
  hasta: string; setHasta: (v: string) => void;
  clienteSel: string; setClienteSel: (v: string) => void;
  clientesDisponibles: string[];
  cargando: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chartGeneral: any[]; chartCliente: any[]; chartClientesTotales: any[];
  totalesPeriodo: { total: number; post21: number; enCamino: number };
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
        <div className="space-y-5">
          {/* KPIs globales del período */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard icon={Package} label="Total paquetes del período" valor={totalesPeriodo.total.toLocaleString("es-AR")} color="text-blue-600 dark:text-blue-300" />
            <KpiCard icon={Clock} label="Total post-21hs" valor={totalesPeriodo.post21.toLocaleString("es-AR")}
              sub={totalesPeriodo.total > 0 ? `${round2(totalesPeriodo.post21 / totalesPeriodo.total * 100).toFixed(2)}% del total` : undefined}
              color="text-amber-600 dark:text-amber-300" />
            <KpiCard icon={Truck} label="Total demorados" valor={totalesPeriodo.enCamino.toLocaleString("es-AR")}
              sub={totalesPeriodo.total > 0 ? `${round2(totalesPeriodo.enCamino / totalesPeriodo.total * 100).toFixed(2)}% del total — post-21hs sin entregar` : undefined}
              color="text-violet-600 dark:text-violet-300" />
          </div>

          {/* Paquetes totales del día */}
          <div className="border rounded-xl p-4">
            <p className="text-xs font-bold mb-2">Paquetes totales por día — y % de éxito</p>
            {chartGeneral.length === 0 ? (
              <EmptyState icon={Package} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartGeneral}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="cant" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                  <Tooltip {...ct.tooltip} />
                  <Bar yAxisId="cant" dataKey="total" name="Paquetes totales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="pctExito" name="% éxito" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Demorados / post-21hs por día */}
          <div className="border rounded-xl p-4">
            <p className="text-xs font-bold mb-2">Demorados (post-21hs) por día — cantidad y % del día</p>
            {chartGeneral.length === 0 ? (
              <EmptyState icon={Clock} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartGeneral}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="cant" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                  <Tooltip {...ct.tooltip} />
                  <Bar yAxisId="cant" dataKey="post21Total" name="Demorados (post-21hs)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="post21Pct" name="% del día" stroke="#b45309" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Demorados ("en camino al destinatario") por día */}
          <div className="border rounded-xl p-4">
            <p className="text-xs font-bold mb-2">Demorados por día — cantidad y % del día</p>
            <p className="text-[10px] text-muted-foreground mb-2">Demorado = todo lo post-21hs que no fue entregado ("en camino al destinatario")</p>
            {chartGeneral.length === 0 ? (
              <EmptyState icon={Truck} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartGeneral}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="cant" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                  <Tooltip {...ct.tooltip} />
                  <Bar yAxisId="cant" dataKey="enCaminoTotal" name="Demorados" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="enCaminoPct" name="% del día" stroke="#6d28d9" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Total de paquetes por cliente (acumulado del período) */}
          <div className="border rounded-xl p-4">
            <p className="text-xs font-bold mb-2">Paquetes totales por cliente (top 15 del período)</p>
            {chartClientesTotales.length === 0 ? (
              <EmptyState icon={Users} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, chartClientesTotales.length * 28)}>
                <ComposedChart data={chartClientesTotales} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis type="category" dataKey="cliente" width={130} tick={{ fontSize: 10, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <Tooltip {...ct.tooltip} labelFormatter={(_, p) => p?.[0]?.payload?.clienteCompleto ?? ""} />
                  <Bar dataKey="total" name="Paquetes totales" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="enCamino" name="Demorados" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold">% demorados de {clienteSel}</p>
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
                  <Line yAxisId="pct" type="monotone" dataKey="enCaminoPct" name="% demorados" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
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
                  <p className="text-muted-foreground">Total demorados</p>
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
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Demorados</th>
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
