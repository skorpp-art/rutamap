"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from "recharts";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RefreshCw, TrendingUp, TrendingDown, Users,
  Package, Upload, FileSpreadsheet, ChevronLeft, ChevronRight,
  CheckCircle,
} from "lucide-react";
import {
  getDashboardSemanalV2, getResumenSemanalV2,
  getTopClientes, importarClientesExcel,
  getProyeccionDiaV2, getBandasControl,
  getCalidadDatos,
  getRecorridosBase,
  upsertClienteManual, getClientesManuales, eliminarClienteManual,
  getPlantillasSemanales,
} from "@/app/actions/volumenes";
import { getRecomendacionesOperacion } from "@/app/actions/operaciones-diarias";
import { OperacionDia } from "./OperacionDia";
import { AnalisisOperaciones } from "./AnalisisOperaciones";
import { HistorialDias } from "./HistorialDias";
import { PlantillasSemanales } from "./PlantillasSemanales";
import { KpisMonitoreo } from "./KpisMonitoreo";
import type {
  DashboardDiaV2, ResumenSemanalV2, ClienteDia,
  ProyeccionDiaV2, BandaControl, CalidadDatos, ClienteManual,
  PlantillaCelda,
} from "@/app/actions/volumenes";
import { PALETA, ESTADO, clasificarRiesgo } from "@/lib/estados";
import { EstadoBadge } from "@/components/ui/estado-badge";
import { NumeroAnimado } from "@/components/ui/numero-animado";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hoy(): string { return new Date().toISOString().slice(0, 10); }
function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function mañanaISO(): string { return addDias(hoy(), 1); }
function dowISO(iso: string): number {
  const d = new Date(iso + "T12:00:00"); return d.getDay() === 0 ? 7 : d.getDay();
}

// Extraer fecha de nombre de archivo tipo "Listado_Clientes_20260530.xlsx" → "2026-05-30"
function fechaDesdeNombre(nombre: string): string | null {
  const m = nombre.match(/(\d{8})/);
  if (!m) return null;
  const s = m[1]; // "20260530"
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// Se obtiene dinámicamente del conteo de RF activos en la DB
// Default 55 hasta que cargue el valor real
let RUTAS_FIJAS = 55;

// ─── Tooltip gráfico ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipGrafico({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[200px]">
      <p className="font-bold border-b pb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) =>
        p.value > 0 ? (
          <div key={i} className="flex justify-between gap-4">
            <span style={{ color: p.color }} className="font-medium">{p.name}</span>
            <span className="font-semibold tabular-nums">{p.value.toLocaleString("es-AR")}</span>
          </div>
        ) : null
      )}
    </div>
  );
}

// ─── Card stat ────────────────────────────────────────────────────────────────
function StatCard({ label, valor, sub, delta, color, index = 0 }: {
  label: string; valor: string; sub: string; delta?: number; color?: string; index?: number;
}) {
  return (
    <div className="bg-background border rounded-xl p-4 space-y-1 animate-fade-up"
      style={{ animationDelay: `${index * 70}ms` }}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <div className="flex items-end gap-2">
        <p className={cn("text-3xl font-bold tabular-nums", color ?? "text-foreground")}>{valor}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={cn("text-sm font-semibold flex items-center gap-0.5 mb-1",
            delta > 0 ? "text-emerald-600" : "text-red-500")}>
            {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Card calidad de datos ────────────────────────────────────────────────────
function CalidadDatosCard({ calidad }: { calidad: CalidadDatos[] }) {
  if (calidad.length === 0) return null;

  const diasConDatos = calidad.filter(c => c.registros > 0).length;
  const totalDias = 6; // Lun–Sáb
  const pctGlobal = Math.round((diasConDatos / totalDias) * 100);
  const registrosTotal = calidad.reduce((s, c) => s + c.registros, 0);
  const meta = 12; // 12 semanas = confianza máxima

  return (
    <div className="border rounded-xl p-5 bg-background">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-sm font-bold">Calidad de datos</p>
        <span className={cn(
          "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full",
          pctGlobal === 100 ? "bg-emerald-100 text-emerald-700" :
          pctGlobal >= 50 ? "bg-amber-100 text-amber-700" :
          "bg-red-100 text-red-700"
        )}>
          {diasConDatos}/{totalDias} días con datos · {registrosTotal} registros totales
        </span>
      </div>
      <div className="space-y-2">
        {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"].map(dia => {
          const d = calidad.find(c => c.dia_nombre === dia);
          const registros = d?.registros ?? 0;
          const pct = Math.min(100, Math.round(registros / meta * 100));
          const color = registros >= 8 ? "bg-emerald-500"
            : registros >= 4 ? "bg-amber-400"
            : registros >= 1 ? "bg-blue-400"
            : "bg-slate-200";
          const labelColor = registros >= 8 ? "text-emerald-700" : registros >= 4 ? "text-amber-600" : registros >= 1 ? "text-blue-600" : "text-muted-foreground";
          const confianza = registros >= 8 ? "Alta" : registros >= 4 ? "Media" : registros >= 1 ? "Baja" : "Sin datos";
          return (
            <div key={dia} className="flex items-center gap-3">
              <span className="text-xs font-medium w-20 shrink-0">{dia}</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right shrink-0">
                {registros}/{meta} sem
              </span>
              <span className={`text-[10px] font-semibold w-14 shrink-0 ${labelColor}`}>{confianza}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground border-t pt-2 mt-2">
        Barra llena = {meta} semanas (confianza máxima). Objetivo mínimo: 8 semanas por día.
      </p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function VolumenesPanel() {
  const [tab, setTab] = useState<"dashboard" | "proyeccion" | "planificacion" | "operacion" | "analisis" | "historial" | "plantillas" | "kpis" | "importar">("proyeccion");
  const [dashboard, setDashboard] = useState<DashboardDiaV2[]>([]);
  const [resumen, setResumen] = useState<ResumenSemanalV2 | null>(null);
  const [topClientes, setTopClientes] = useState<ClienteDia[]>([]);
  const [calidad, setCalidad] = useState<CalidadDatos[]>([]);
  const [cargando, setCargando] = useState(false);
  const [targetPkg, setTargetPkg] = useState(30);

  // Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ cliente: string; paquetes: number }[]>([]);
  const [fechaImport, setFechaImport] = useState(hoy());
  const [importando, setImportando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [vistaTab, setVistaTab] = useState<"preview" | "topClientes">("preview");

  // Clientes manuales (cliente grande que no figura en el Excel)
  const [clientesManuales, setClientesManuales] = useState<ClienteManual[]>([]);
  const [manualNombre, setManualNombre] = useState("");
  const [manualPaquetes, setManualPaquetes] = useState("");
  const [guardandoManual, setGuardandoManual] = useState(false);

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
      await cargar();
    } finally { setGuardandoManual(false); }
  }

  async function quitarClienteManual(id: string) {
    const res = await eliminarClienteManual(id);
    if (!res.ok) { toast.error("Error al eliminar"); return; }
    toast.success("Cliente manual eliminado");
    await cargarManuales(fechaImport);
    await cargar();
  }

  // Proyección v2
  const [fechaProyeccion, setFechaProyeccion] = useState(addDias(hoy(), 1));
  const [proyeccion, setProyeccion] = useState<ProyeccionDiaV2 | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [recomendaciones, setRecomendaciones] = useState<import("@/app/actions/operaciones-diarias").Recomendacion[]>([]);
  // Calculadora interactiva
  const [calcPaquetes, setCalcPaquetes] = useState<number>(0);
  const [calcRutas, setCalcRutas] = useState<number>(53);
  // Bandas de control
  const [bandas, setBandas] = useState<BandaControl[]>([]);
  const [rutasFijasCount, setRutasFijasCount] = useState(53);

  // Plantillas semanales (bloques pre-definidos)
  const [plantillas, setPlantillas] = useState<PlantillaCelda[]>([]);
  useEffect(() => {
    getPlantillasSemanales().then(r => { if (r.ok && r.data) setPlantillas(r.data); });
  }, []);
  // Valor de plantilla para una fecha (semana del mes × día de semana)
  const plantillaPara = useCallback((iso: string): number => {
    const dia = new Date(iso + "T12:00:00").getDate();
    const semana = Math.min(5, Math.ceil(dia / 7));
    const dow = dowISO(iso); // 1-7
    if (dow > 6) return 0; // domingo no opera
    const c = plantillas.find(p => p.semana_mes === semana && p.dia_semana === dow);
    return c?.paquetes_base ?? 0;
  }, [plantillas]);

  // Debounce ref para recomendaciones automáticas
  const recDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Flujo Proyección → Planificación → Operación ─────────────────────────
  const [pkgProyectado, setPkgProyectado] = useState(0);
  const [tipoProyeccion, setTipoProyeccion] = useState<"min"|"esperado"|"max"|null>(null);

  // ── Proyección (regresión lineal sobre últimos días cargados) ─────────────
  const diasConDatos = dashboard.filter(d => d.total_actual > 0);
  const proyectadoTotal = (() => {
    if (diasConDatos.length < 2) return null;
    const ult = diasConDatos.slice(-4);
    const n = ult.length;
    const xs = ult.map((_, i) => i), ys = ult.map(d => d.total_actual);
    const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
    const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sx2 = xs.reduce((a, x) => a + x * x, 0);
    const denom = n * sx2 - sx * sx;
    if (denom === 0) return Math.round(sy / n);
    const m = (n * sxy - sx * sy) / denom;
    const b = (sy - m * sx) / n;
    return Math.max(0, Math.round(m * n + b));
  })();

  const promDiaActual = resumen?.hoy_total && resumen.hoy_total > 0
    ? (resumen.hoy_total / RUTAS_FIJAS) : 0;
  const choferesHoy = resumen?.hoy_total ? Math.ceil(resumen.hoy_total / targetPkg) : 0;
  const confianza = diasConDatos.length >= 4 ? "alta" : diasConDatos.length >= 2 ? "media" : "baja";

  // ── Cargar datos ──────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Obtener conteo real de RF via server action
      try {
        const rfRes = await getRecorridosBase();
        if (rfRes.ok && rfRes.data) {
          const rfCount = rfRes.data.filter(r => r.tipo === "fijo" && r.activo).length;
          if (rfCount > 0) { RUTAS_FIJAS = rfCount; setRutasFijasCount(rfCount); setCalcRutas(rfCount); }
        }
      } catch { /* usar default */ }

      const [resDash, resSum, resTop, resBandas, resCal] = await Promise.all([
        getDashboardSemanalV2(),
        getResumenSemanalV2(),
        getTopClientes(hoy(), 10),
        getBandasControl(60, targetPkg, RUTAS_FIJAS),
        getCalidadDatos(),
      ]);
      if (resDash.ok && resDash.data) setDashboard(resDash.data);
      if (resSum.ok && resSum.data) setResumen(resSum.data);
      if (resTop.ok && resTop.data) setTopClientes(resTop.data);
      if (resBandas.ok && resBandas.data) setBandas(resBandas.data);
      if (resCal.ok && resCal.data) setCalidad(resCal.data);
    } finally { setCargando(false); }
  }, [targetPkg]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Recomendaciones con debounce al cambiar calcPaquetes / calcRutas ──────
  useEffect(() => {
    if (calcPaquetes <= 0) return;
    if (recDebounceRef.current) clearTimeout(recDebounceRef.current);
    recDebounceRef.current = setTimeout(async () => {
      try {
        const res = await getRecomendacionesOperacion(fechaProyeccion, calcPaquetes, calcRutas);
        if (res.ok && res.data) setRecomendaciones(res.data);
      } catch { /* silencioso */ }
    }, 500);
    return () => { if (recDebounceRef.current) clearTimeout(recDebounceRef.current); };
  }, [calcPaquetes, calcRutas, fechaProyeccion]);

  // ── Datos del gráfico ─────────────────────────────────────────────────────
  const dowMañana = dowISO(mañanaISO());
  const chartData = dashboard.map(d => ({
    dia: d.dia_nombre,
    "Esta semana": d.total_actual || undefined,
    "Semana anterior": d.total_anterior || undefined,
    "Promedio histórico": Number(d.promedio_hist) || undefined,
    "Proyección mañana": d.dia_semana === dowMañana && proyectadoTotal ? proyectadoTotal : undefined,
    esHoy: d.fecha_actual === hoy(),
  }));

  // ── Parsear Excel real (Cliente / Cantidad de Paquetes) ──────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);

    // Auto-detectar fecha del nombre
    const fechaDet = fechaDesdeNombre(file.name);
    if (fechaDet) setFechaImport(fechaDet);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        const parsed: { cliente: string; paquetes: number }[] = [];
        for (let i = 1; i < rows.length; i++) { // skip header row
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
      await cargar();
      setTab("dashboard");
    } finally { setImportando(false); }
  }

  const totalPreview = preview.reduce((s, r) => s + r.paquetes, 0);

  async function calcularProyeccion() {
    setCalculando(true);
    try {
      const resProy = await getProyeccionDiaV2(fechaProyeccion, targetPkg, RUTAS_FIJAS);
      if (!resProy.ok || !resProy.data) {
        toast.error("Error al calcular proyección", { description: resProy.error });
      } else {
        setProyeccion(resProy.data);
        // Recomendaciones se actualizan via debounce effect al cambiar calcPaquetes
        // Si no hay calcPaquetes, buscar con el esperado
        const paq = calcPaquetes || (resProy.data.esperado_ajust || resProy.data.esperado_base) || 0;
        if (paq > 0) {
          const resRec = await getRecomendacionesOperacion(fechaProyeccion, paq, calcRutas);
          if (resRec.ok && resRec.data) setRecomendaciones(resRec.data);
        }
      }
    } finally { setCalculando(false); }
  }

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header ── */}
      <div className="border-b px-6 py-4 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Resumen operativo de la semana · {RUTAS_FIJAS} recorridos fijos</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {proyectadoTotal && (
            <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              ● Proyección {["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][dowMañana]} · confianza {confianza}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cargar} disabled={cargando}>
            <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b px-3 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
        {([["proyeccion", "1 · Proyección"], ["planificacion", "2 · Planificación"], ["operacion", "3 · Operación del Día"], ["plantillas", "🗓 Plantillas"], ["kpis", "📈 Monitoreo"], ["analisis", "📊 Análisis"], ["dashboard", "Dashboard"], ["historial", "Historial"], ["importar", "Importar Excel"]] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t as typeof tab)}
            className={cn("px-3 sm:px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {lbl}
          </button>
        ))}
      </div>

      <div key={tab} className="flex-1 overflow-y-auto animate-fade-in">

        {/* ══════════════ TAB MONITOREO / KPIs ══════════════ */}
        {tab === "kpis" && <KpisMonitoreo />}

        {/* ══════════════ TAB ANÁLISIS ══════════════ */}
        {tab === "analisis" && <AnalisisOperaciones />}

        {/* ══════════════ TAB PLANTILLAS SEMANALES ══════════════ */}
        {tab === "plantillas" && (
          <PlantillasSemanales
            onUsarValor={(p) => {
              setPkgProyectado(p);
              setCalcPaquetes(p);
              setTipoProyeccion("esperado");
              setTab("operacion");
            }}
          />
        )}

        {/* ══════════════ TAB PLANIFICACIÓN (activar/desactivar rutas) ══════════════ */}
        {tab === "planificacion" && (
          <OperacionDia
            pkgProyectado={pkgProyectado || (resumen?.hoy_total ?? 0)}
            tipoProyeccion={tipoProyeccion}
            targetPkg={targetPkg}
            modo="planificacion"
            onConfirmar={() => { setTab("operacion"); }}
          />
        )}

        {/* ══════════════ TAB OPERACIÓN DEL DÍA ══════════════ */}
        {tab === "operacion" && (
          <OperacionDia
            pkgProyectado={pkgProyectado || (resumen?.hoy_total ?? 0)}
            tipoProyeccion={tipoProyeccion}
            targetPkg={targetPkg}
            onConfirmar={() => {}}
          />
        )}

        {/* ══════════════ TAB DASHBOARD ══════════════ */}
        {tab === "dashboard" && (
          <div className="p-6 space-y-5">

            {/* Fila principal: Choferes hoy MUY prominente + stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Choferes hoy — protagonista */}
              <div className="border-2 border-blue-200 rounded-xl p-5 bg-blue-50/60 flex items-center gap-4 lg:col-span-1 animate-fade-up">
                <Users className="h-10 w-10 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">Choferes hoy</p>
                  <p className="text-5xl font-black text-blue-700 tabular-nums leading-none mt-1">
                    {choferesHoy > 0 ? <NumeroAnimado value={choferesHoy} /> : "—"}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {resumen?.hoy_total ? `${resumen.hoy_total.toLocaleString("es-AR")} paq · ${promDiaActual.toFixed(1)} pkg/ruta` : "Sin datos de hoy"}
                  </p>
                </div>
              </div>

              {/* Stats secundarios */}
              <StatCard index={1} label="Hoy / Último día"
                valor={(resumen?.hoy_total ?? 0).toLocaleString("es-AR")}
                sub={`${resumen?.hoy_clientes ?? 0} clientes`} />
              <StatCard index={2} label="Semana actual"
                valor={(resumen?.semana_total ?? 0).toLocaleString("es-AR")}
                sub={`${resumen?.semana_dias ?? 0} días cargados`}
                delta={resumen && resumen.vs_anterior_pct !== 0 ? Number(resumen.vs_anterior_pct) : undefined}
                color={(resumen?.vs_anterior_pct ?? 0) < 0 ? "text-red-500" : "text-foreground"} />
              <StatCard index={3} label="VS semana anterior"
                valor={resumen ? `${resumen.vs_anterior_pct > 0 ? "+" : ""}${resumen.vs_anterior_pct}%` : "—"}
                sub={`Anterior: ${(resumen?.anterior_total ?? 0).toLocaleString("es-AR")}`}
                color={(resumen?.vs_anterior_pct ?? 0) < 0 ? "text-red-500" : "text-emerald-600"} />
            </div>

            {/* Gráfico semanal */}
            <div className="border rounded-xl p-5 bg-background">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700 mb-4">Volumen semanal</p>
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 50, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v.toLocaleString("es-AR")} />
                  <Tooltip content={<TooltipGrafico />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Semana anterior" fill={PALETA.gris} opacity={0.45} radius={[3,3,0,0]} barSize={20} />
                  <Bar dataKey="Esta semana" radius={[3,3,0,0]} barSize={20}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.esHoy ? "#1d4ed8" : "#3b82f6"} />)}
                  </Bar>
                  <Bar dataKey="Proyección mañana" fill="#7dd3fc" radius={[3,3,0,0]} barSize={20} />
                  <Line type="monotone" dataKey="Promedio histórico" stroke="#f97316" strokeWidth={2.5}
                    dot={{ r: 4, fill: "#f97316" }} name="Promedio histórico" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Calidad de datos */}
            <CalidadDatosCard calidad={calidad} />

            {/* Top clientes */}
            {topClientes.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/20">
                  <p className="text-xs font-semibold">Top clientes hoy · {resumen?.hoy_total?.toLocaleString("es-AR")} paquetes</p>
                </div>
                <div className="divide-y">
                  {topClientes.map((c, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-3 text-xs hover:bg-accent/20">
                      <span className="text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                      <span className="flex-1 font-medium truncate">{c.cliente}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.pct ?? 0}%` }} />
                        </div>
                        <span className="font-bold tabular-nums w-8 text-right">{c.paquetes}</span>
                        <span className="text-muted-foreground w-10 text-right">{c.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ TAB PROYECCIÓN ══════════════ */}
        {tab === "proyeccion" && (() => {
          // Cálculos en vivo de la calculadora
          const promPorRuta = calcRutas > 0 ? calcPaquetes / calcRutas : 0;
          const choferesCalc = calcPaquetes > 0 ? Math.ceil(calcPaquetes / targetPkg) : 0;
          const choferesMin  = calcPaquetes > 0 ? Math.ceil(calcPaquetes / (targetPkg + 5)) : 0;
          const choferesMax  = calcPaquetes > 0 ? Math.ceil(calcPaquetes / (targetPkg - 5)) : 0;
          const zonaCalc = clasificarRiesgo(promPorRuta, targetPkg);

          return (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ─ Calculadora interactiva ─ */}
              <div className="space-y-4">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Calculadora</p>

                {/* Inputs */}
                <div className="border rounded-xl p-5 space-y-4 bg-background">
                  {/* Paquetes esperados */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Paquetes esperados <span className="text-muted-foreground/60 normal-case font-normal">— escribilo a mano o usá un valor sugerido</span>
                    </label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="number" min={0} max={9999} value={calcPaquetes || ""}
                        placeholder="ej: 2700"
                        onChange={e => setCalcPaquetes(parseInt(e.target.value) || 0)}
                        className="flex-1 border rounded-lg px-3 py-2 text-lg font-bold h-11 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      {/* "Usar proyección" SOLO si la proyección tiene un valor > 0 */}
                      {proyeccion && ((proyeccion.esperado_ajust || proyeccion.esperado_base) ?? 0) > 0 && (
                        <Button variant="outline" size="sm" className="h-11 text-xs whitespace-nowrap"
                          onClick={() => setCalcPaquetes((proyeccion.esperado_ajust || proyeccion.esperado_base) ?? 0)}>
                          Proy. {((proyeccion.esperado_ajust || proyeccion.esperado_base) ?? 0).toLocaleString("es-AR")}
                        </Button>
                      )}
                      {!!resumen?.hoy_total && resumen.hoy_total > 0 && (
                        <Button variant="outline" size="sm" className="h-11 text-xs whitespace-nowrap"
                          onClick={() => setCalcPaquetes(resumen.hoy_total)}>
                          Hoy {resumen.hoy_total.toLocaleString("es-AR")}
                        </Button>
                      )}
                      {plantillaPara(fechaProyeccion) > 0 && (
                        <Button variant="outline" size="sm"
                          className="h-11 text-xs whitespace-nowrap border-blue-300 text-blue-700 hover:bg-blue-50"
                          title={`Plantilla de Semana ${Math.min(5, Math.ceil(new Date(fechaProyeccion + "T12:00:00").getDate() / 7))}`}
                          onClick={() => setCalcPaquetes(plantillaPara(fechaProyeccion))}>
                          🗓 {plantillaPara(fechaProyeccion).toLocaleString("es-AR")}
                        </Button>
                      )}
                    </div>
                    {plantillaPara(fechaProyeccion) > 0 && (
                      <p className="text-[10px] text-blue-600 mt-1">
                        🗓 Hay una plantilla cargada para esta fecha ({plantillaPara(fechaProyeccion).toLocaleString("es-AR")} paq). Editala en la pestaña Plantillas.
                      </p>
                    )}
                  </div>

                  {/* Botón para continuar con el valor cargado (manual o sugerido) */}
                  {calcPaquetes > 0 && (
                    <Button
                      className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold gap-2"
                      onClick={() => {
                        setPkgProyectado(calcPaquetes);
                        setTipoProyeccion("esperado");
                        setTab("operacion");
                      }}>
                      ✓ Usar {calcPaquetes.toLocaleString("es-AR")} paquetes → Operación del Día
                    </Button>
                  )}

                  {/* Rutas activas */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Rutas activas ese día
                    </label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Button variant="outline" size="icon" className="h-9 w-9"
                        onClick={() => setCalcRutas(v => Math.max(1, v - 1))}>−</Button>
                      <input type="number" min={1} max={200} value={calcRutas}
                        onChange={e => setCalcRutas(parseInt(e.target.value) || 1)}
                        className="w-20 text-center border rounded-lg px-2 py-2 text-lg font-bold h-9 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <Button variant="outline" size="icon" className="h-9 w-9"
                        onClick={() => setCalcRutas(v => v + 1)}>+</Button>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-9"
                        onClick={() => setCalcRutas(rutasFijasCount)}>
                        RF piso ({rutasFijasCount})
                      </Button>
                    </div>
                  </div>

                  {/* Objetivo pkg/chofer */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Objetivo pkg/chofer
                    </label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Button variant="outline" size="icon" className="h-9 w-9"
                        onClick={() => setTargetPkg(v => Math.max(10, v - 1))}>−</Button>
                      <span className="text-2xl font-bold tabular-nums w-12 text-center">{targetPkg}</span>
                      <Button variant="outline" size="icon" className="h-9 w-9"
                        onClick={() => setTargetPkg(v => Math.min(100, v + 1))}>+</Button>
                      <div className="flex gap-1 ml-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Mín {targetPkg-5}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">Obj {targetPkg}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Máx {targetPkg+5}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resultados en vivo */}
                {calcPaquetes > 0 && (
                  <div className="border rounded-xl overflow-hidden bg-background animate-pop-in">
                    {/* Resultado principal */}
                    <div className="px-5 py-4 bg-blue-600 text-white text-center">
                      <p className="text-[10px] uppercase tracking-widest opacity-80 font-semibold">Choferes necesarios</p>
                      <p className="text-6xl font-black tabular-nums mt-1"><NumeroAnimado value={choferesCalc} /></p>
                      <p className="text-sm opacity-90 mt-1">
                        {calcPaquetes.toLocaleString("es-AR")} paq ÷ {targetPkg} pkg/chofer
                      </p>
                    </div>

                    {/* Desglose mín/esp/máx */}
                    <div className="grid grid-cols-3 divide-x border-b">
                      {[
                        { l: "Mín (@"+( targetPkg+5)+")", v: choferesMin },
                        { l: "Esperado (@"+targetPkg+")", v: choferesCalc, hl: true },
                        { l: "Máx (@"+(targetPkg-5)+")", v: choferesMax },
                      ].map(({ l, v, hl }) => (
                        <div key={l} className={cn("p-3 text-center", hl && "bg-blue-50/50")}>
                          <p className="text-[10px] text-muted-foreground">{l}</p>
                          <p className={cn("text-xl font-bold tabular-nums", hl ? "text-blue-700" : "")}>{v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Promedio por ruta + banda */}
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Promedio por ruta ({calcRutas} rutas)</span>
                        <span className="text-lg font-bold tabular-nums" style={{ color: ESTADO[zonaCalc].hex }}>
                          {promPorRuta.toFixed(1)} pkg/ruta
                        </span>
                      </div>
                      {/* Barra visual de banda */}
                      <div className="relative h-5 rounded-full overflow-hidden bg-slate-100">
                        {/* Zonas coloreadas */}
                        <div className="absolute inset-0 flex">
                          <div className="flex-1 bg-red-100" />
                          <div className="flex-1 bg-amber-100" />
                          <div className="flex-1 bg-green-100" />
                          <div className="flex-1 bg-amber-100" />
                          <div className="flex-1 bg-red-100" />
                        </div>
                        {/* Indicador */}
                        {(() => {
                          const min = targetPkg - 12, max = targetPkg + 12;
                          const pct = Math.min(100, Math.max(0, (promPorRuta - min) / (max - min) * 100));
                          return (
                            <div className="absolute top-0 bottom-0 w-1 bg-blue-700 rounded-full shadow-md transition-all"
                              style={{ left: `calc(${pct}% - 2px)` }} />
                          );
                        })()}
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>↓ Ineficiente ({targetPkg-10})</span>
                        <span className="font-semibold text-green-600">P.E. ({targetPkg})</span>
                        <span>↑ Peligroso ({targetPkg+10})</span>
                      </div>
                      {zonaCalc !== "sin" && (
                        <div className="flex justify-center">
                          <EstadoBadge estado={zonaCalc} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* ─ Proyección histórica + banda de control ─ */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Proyección por fecha</p>
                </div>
                <div className="border rounded-xl p-4 flex items-center gap-3 bg-background flex-wrap">
                  <input type="date" value={fechaProyeccion}
                    onChange={e => { setFechaProyeccion(e.target.value); setProyeccion(null); }}
                    className="border rounded px-3 py-1.5 text-sm h-9 bg-background flex-1" />
                  <Button onClick={calcularProyeccion} disabled={calculando}
                    className="h-9 px-4 bg-blue-700 hover:bg-blue-800 text-white font-semibold">
                    {calculando ? "…" : "Calcular"}
                  </Button>
                </div>

                {proyeccion && (
                  <div className="border rounded-xl p-4 bg-background space-y-3 animate-fade-up">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-xs font-bold text-blue-700">{proyeccion.dia_nombre} · Semana {proyeccion.semana_mes}: {proyeccion.tipo_semana}</p>
                        <p className="text-[10px] text-muted-foreground">Factor estacional: {proyeccion.factor_semana > 1 ? "+" : ""}{Math.round((proyeccion.factor_semana - 1) * 100)}%</p>
                      </div>
                      <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full border",
                        proyeccion.confianza === "alta" ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                        proyeccion.confianza === "media" ? "bg-amber-50 border-amber-300 text-amber-700" :
                        "bg-red-50 border-red-300 text-red-700")}>
                        ● Confianza {proyeccion.confianza}
                      </span>
                    </div>
                    {/* Cards clickeables: clic → usa ese valor y va a Planificación */}
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                      Hacé clic en el escenario que querés usar:
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { l: "Mínimo",   v: proyeccion.minimo   ?? 0, c: proyeccion.choferes_min ?? 0, tipo: "min"      as const },
                        { l: "Esperado", v: (proyeccion.esperado_ajust || proyeccion.esperado_base) ?? 0, c: proyeccion.choferes_esp ?? 0, hl: true, tipo: "esperado" as const },
                        { l: "Máximo",   v: proyeccion.maximo   ?? 0, c: proyeccion.choferes_max ?? 0, tipo: "max"      as const },
                      ].map(({ l, v, c, hl, tipo }) => {
                        const seleccionado = tipoProyeccion === tipo;
                        const valOk = v > 0;
                        return (
                          <button key={l}
                            onClick={() => {
                              if (!valOk) return;
                              setPkgProyectado(v);
                              setTipoProyeccion(tipo);
                              setCalcPaquetes(v);
                            }}
                            className={cn(
                              "border rounded-xl p-3 text-center transition-all",
                              valOk ? "hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer" : "opacity-50 cursor-not-allowed",
                              seleccionado ? "border-blue-500 bg-blue-50 ring-2 ring-blue-400" : hl ? "border-blue-300 bg-blue-50/30" : ""
                            )}>
                            <p className="text-[10px] text-muted-foreground font-medium">{l}</p>
                            <p className={cn("text-xl font-bold tabular-nums mt-0.5", seleccionado || hl ? "text-blue-700" : "")}>
                              {valOk ? v.toLocaleString("es-AR") : "—"}
                            </p>
                            <p className="text-[10px] font-semibold text-blue-600 mt-0.5">{c > 0 ? `${c} choferes` : "—"}</p>
                            {seleccionado && <p className="text-[9px] text-emerald-600 font-bold mt-0.5">✓ Seleccionado</p>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Recomendaciones basadas en historial */}
                    {recomendaciones.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-700">💡 Recomendaciones basadas en historial</span>
                          {calcPaquetes > 0 && (
                            <span className="text-[10px] text-amber-600 ml-auto">
                              {calcPaquetes.toLocaleString("es-AR")} paq · {calcRutas} rutas
                            </span>
                          )}
                        </div>
                        <div className="divide-y">
                          {recomendaciones.map(r => (
                            <div key={r.codigo} className="px-3 py-2 flex items-start gap-3">
                              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 mt-0.5",
                                r.prioridad === "alta" ? "bg-red-100 text-red-700" :
                                r.prioridad === "media" ? "bg-amber-100 text-amber-700" :
                                "bg-slate-100 text-slate-500")}>
                                {r.prioridad === "alta" ? "ALTA" : r.prioridad === "media" ? "MEDIA" : "BAJA"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-blue-700">{r.codigo}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.nombre}</p>
                                <p className="text-[10px] text-slate-600 mt-0.5">{r.motivo}</p>
                              </div>
                              {r.prom_hist > 0 && (
                                <div className="text-right shrink-0">
                                  <p className={cn("text-xs font-bold", Number(r.prom_hist) > 40 ? "text-red-600" : "text-amber-600")}>
                                    {r.prom_hist} prom
                                  </p>
                                  {r.pct_sobre > 0 && <p className="text-[10px] text-muted-foreground">{r.pct_sobre}% días &gt;40</p>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Botón pasar al paso 3 con los datos */}
                    {tipoProyeccion && pkgProyectado > 0 && (
                      <div className="space-y-2">
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 font-semibold"
                          onClick={() => { setTab("operacion"); }}>
                          ✓ Usar {tipoProyeccion === "min" ? "Mínimo" : tipoProyeccion === "esperado" ? "Esperado" : "Máximo"} ({pkgProyectado.toLocaleString("es-AR")} paq) → Operación del Día
                        </Button>
                        <button className="w-full text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                          onClick={() => setTab("planificacion")}>
                          O primero ajustar rutas activas → Planificación
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center">
                      {proyeccion.registros} {proyeccion.dia_nombre}s históricos
                    </p>
                  </div>
                )}

                {/* Banda de control histórica */}
                {bandas.length > 0 && (
                  <div className="border rounded-xl p-4 bg-background">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                      Historial — Promedio pkg/ruta
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                      <ComposedChart data={bandas.map(b => ({
                        dia: b.fecha.slice(5),
                        promedio: Number(b.promedio_ruta),
                        zona: b.zona_riesgo,
                      }))} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval={Math.floor(bandas.length / 6)} />
                        <YAxis tick={{ fontSize: 9 }} domain={[0, targetPkg + 15]} />
                        <Tooltip formatter={(v) => [`${v} pkg/ruta`]} />
                        {/* Líneas de referencia fijas — ReferenceLine evita re-renders */}
                        <ReferenceLine y={targetPkg + 10} stroke={PALETA.rojo} strokeDasharray="4 3" strokeWidth={1} />
                        <ReferenceLine y={targetPkg + 5}  stroke={PALETA.ambar} strokeDasharray="4 3" strokeWidth={1} />
                        <ReferenceLine y={targetPkg}      stroke={PALETA.verde} strokeDasharray="4 3" strokeWidth={1} />
                        <ReferenceLine y={targetPkg - 5}  stroke={PALETA.ambar} strokeDasharray="4 3" strokeWidth={1} />
                        <ReferenceLine y={targetPkg - 10} stroke={PALETA.rojo} strokeDasharray="4 3" strokeWidth={1} />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Line type="monotone" dataKey="promedio" stroke="#2563eb" strokeWidth={2}
                          dot={(p: any) => {
                            if (!p.cx || !p.cy) return <g key={p.key} />;
                            const color = p?.payload?.zona==="ok"?PALETA.verde:p?.payload?.zona?.includes("peligroso")?PALETA.rojo:PALETA.ambar;
                            return <circle key={p.key} cx={p.cx} cy={p.cy} r={3} fill={color} stroke="white" strokeWidth={1} />;
                          }} name="Promedio" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ══════════════ TAB HISTORIAL ══════════════ */}
        {tab === "historial" && <HistorialDias />}

        {/* ══════════════ TAB IMPORTAR ══════════════ */}
        {tab === "importar" && (
          <div className="p-6 space-y-5 max-w-3xl">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <h2 className="text-sm font-semibold">Importar Listado de Clientes</h2>
            </div>

            {/* Formato esperado */}
            <div className="border rounded-xl p-4 bg-slate-50 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Formato detectado automáticamente:</p>
              <div className="flex items-center gap-4">
                <table className="text-xs border rounded overflow-hidden text-left">
                  <thead className="bg-slate-200">
                    <tr><th className="px-3 py-1.5">A — Cliente</th><th className="px-3 py-1.5">B — Cantidad de Paquetes</th></tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr className="border-t"><td className="px-3 py-1.5">GAMING CITY</td><td className="px-3 py-1.5 tabular-nums">258</td></tr>
                    <tr className="border-t"><td className="px-3 py-1.5">DOMESTICABLES</td><td className="px-3 py-1.5 tabular-nums">172</td></tr>
                    <tr className="border-t"><td className="px-3 py-1.5">…</td><td className="px-3 py-1.5">…</td></tr>
                  </tbody>
                </table>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>✅ Columna A: nombre del cliente</p>
                  <p>✅ Columna B: cantidad de paquetes</p>
                  <p>✅ Fecha auto-detectada del nombre del archivo</p>
                  <p className="text-slate-400">Ejemplo: <code className="bg-slate-100 px-1 rounded">Listado_Clientes_20260530.xlsx</code></p>
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
            <div className="border rounded-xl p-4 bg-amber-50/50 border-amber-200 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Cliente manual</p>
                <span className="text-[11px] text-amber-600/80">— se suma al total y sobrevive a las reimportaciones del Excel</span>
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

              {/* Lista de manuales del día */}
              {clientesManuales.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] text-amber-700 font-medium">Manuales del {fechaImport}:</p>
                  {clientesManuales.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs bg-white/70 rounded-lg px-3 py-1.5">
                      <span className="flex-1 font-medium">{c.cliente}</span>
                      <span className="font-bold tabular-nums text-amber-700">{c.paquetes} paq</span>
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
                <div className="px-4 py-2.5 border-b bg-green-50 flex items-center gap-3">
                  <Package className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">
                    {preview.length} clientes · {totalPreview.toLocaleString("es-AR")} paquetes · {(totalPreview / RUTAS_FIJAS).toFixed(1)} prom/ruta · {Math.ceil(totalPreview / targetPkg)} choferes
                  </span>
                </div>

                {/* Sub-tabs */}
                <div className="border-b flex">
                  {(["preview", "topClientes"] as const).map(t => (
                    <button key={t} onClick={() => setVistaTab(t)}
                      className={cn("px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                        vistaTab === t ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground")}>
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
        )}
      </div>
    </div>
  );
}
