"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine, ReferenceArea,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle, ArrowLeft, TrendingUp, Settings2, BarChart3, Wrench,
  CalendarDays, CalendarOff, LineChart, ClipboardList, FileText, Lightbulb, Layers,
} from "lucide-react";
import {
  getDashboardSemanalV2, getResumenSemanalV2,
  getTopClientes,
  getProyeccionDiaV2, getProyeccionZonas, getBandasControl,
  getCalidadDatos,
  getRecorridosBase,
  getPlantillasSemanales,
} from "@/app/actions/volumenes";
import { getRecomendacionesOperacion } from "@/app/actions/operaciones-diarias";
import { OperacionDia } from "./OperacionDia";
import { AnalisisOperaciones } from "./AnalisisOperaciones";
import { PlantillasSemanales } from "./PlantillasSemanales";
import { Feriados } from "./Feriados";
import { KpisMonitoreo } from "./KpisMonitoreo";
import { HistorialDias } from "./HistorialDias";
import { InformeMensual } from "./InformeMensual";
import type {
  DashboardDiaV2, ResumenSemanalV2, ClienteDia,
  ProyeccionDiaV2, ProyeccionZona, BandaControl, CalidadDatos,
  PlantillaCelda,
} from "@/app/actions/volumenes";
import { PALETA, ESTADO, clasificarRiesgo } from "@/lib/estados";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useVolumenesStore } from "@/stores/volumenesStore";
import { EstadoBadge } from "@/components/ui/estado-badge";
import { NumeroAnimado } from "@/components/ui/numero-animado";
import { SkeletonCards, SkeletonChart } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/ui/metric-card";
import { hoyAR, addDiasAR } from "@/lib/fechas";

const hoy = hoyAR;
const addDias = addDiasAR;
function mañanaISO(): string { return addDias(hoy(), 1); }
function dowISO(iso: string): number {
  const d = new Date(iso + "T12:00:00"); return d.getDay() === 0 ? 7 : d.getDay();
}

// Cantidad de rutas fijas por defecto hasta que cargue el conteo real de la DB.
const RUTAS_FIJAS_DEFAULT = 55;

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

function CalidadDatosCard({ calidad }: { calidad: CalidadDatos[] }) {
  if (calidad.length === 0) return null;
  const diasConDatos = calidad.filter(c => c.registros > 0).length;
  const totalDias = 6;
  const registrosTotal = calidad.reduce((s, c) => s + c.registros, 0);
  const meta = 12;

  return (
    <div className="border rounded-xl p-4 bg-background">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
        <p className="text-sm font-bold">Calidad de datos históricos</p>
        <span className={cn(
          "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full",
          diasConDatos === totalDias ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
          diasConDatos >= 3 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
          "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
        )}>
          {diasConDatos}/{totalDias} días con datos · {registrosTotal} registros
        </span>
      </div>
      <div className="space-y-2">
        {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"].map(dia => {
          const d = calidad.find(c => c.dia_nombre === dia);
          const registros = d?.registros ?? 0;
          const pct = Math.min(100, Math.round(registros / meta * 100));
          const color = registros >= 8 ? "bg-emerald-500" : registros >= 4 ? "bg-amber-400" : registros >= 1 ? "bg-blue-400" : "bg-slate-200 dark:bg-slate-700";
          const labelColor = registros >= 8 ? "text-emerald-700 dark:text-emerald-300" : registros >= 4 ? "text-amber-600 dark:text-amber-300" : registros >= 1 ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground";
          const confianza = registros >= 8 ? "Alta" : registros >= 4 ? "Media" : registros >= 1 ? "Baja" : "Sin datos";
          return (
            <div key={dia} className="flex items-center gap-3">
              <span className="text-xs font-medium w-20 shrink-0">{dia}</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground w-16 text-right shrink-0">{registros}/{meta} sem</span>
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

export function VolumenesPanel() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"proyeccion" | "operacion" | "analisis" | "herramientas">("proyeccion");
  const [herramientaActiva, setHerramientaActiva] = useState<"plantillas" | "feriados" | "kpis" | "historial" | "informe" | null>(null);

  // Permite saltar directo a una pestaña desde la paleta de comandos (?tab=…)
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "proyeccion" || t === "operacion" || t === "analisis" || t === "herramientas") {
      setTab(t);
    }
  }, [searchParams]);
  const [dashboard, setDashboard] = useState<DashboardDiaV2[]>([]);
  const [resumen, setResumen] = useState<ResumenSemanalV2 | null>(null);
  const [topClientes, setTopClientes] = useState<ClienteDia[]>([]);
  const [calidad, setCalidad] = useState<CalidadDatos[]>([]);
  const [cargando, setCargando] = useState(false);
  const [targetPkg, setTargetPkg] = useState(30);

  const [fechaProyeccion, setFechaProyeccion] = useState(addDias(hoy(), 1));
  const [proyeccion, setProyeccion] = useState<ProyeccionDiaV2 | null>(null);
  const [proyeccionZonas, setProyeccionZonas] = useState<ProyeccionZona[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [recomendaciones, setRecomendaciones] = useState<import("@/app/actions/operaciones-diarias").Recomendacion[]>([]);
  const [calcPaquetes, setCalcPaquetes] = useState<number>(0);
  const [calcRutas, setCalcRutas] = useState<number>(RUTAS_FIJAS_DEFAULT);
  const [bandas, setBandas] = useState<BandaControl[]>([]);
  const [rutasFijasCount, setRutasFijasCount] = useState(RUTAS_FIJAS_DEFAULT);

  // Persistir el objetivo pkg/chofer entre sesiones
  useEffect(() => {
    const saved = parseInt(localStorage.getItem("rm-target-pkg") ?? "");
    if (saved >= 10 && saved <= 100) setTargetPkg(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("rm-target-pkg", String(targetPkg));
  }, [targetPkg]);

  const [plantillas, setPlantillas] = useState<PlantillaCelda[]>([]);
  useEffect(() => {
    getPlantillasSemanales().then(r => { if (r.ok && r.data) setPlantillas(r.data); });
  }, []);

  const plantillaPara = useCallback((iso: string): number => {
    const dia = new Date(iso + "T12:00:00").getDate();
    const semana = Math.min(5, Math.ceil(dia / 7));
    const dow = dowISO(iso);
    if (dow > 6) return 0;
    const c = plantillas.find(p => p.semana_mes === semana && p.dia_semana === dow);
    return c?.paquetes_base ?? 0;
  }, [plantillas]);

  const recDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pkgProyectado, setPkgProyectado] = useState(0);
  const [tipoProyeccion, setTipoProyeccion] = useState<"min"|"esperado"|"max"|null>(null);

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

  const promDiaActual = resumen?.hoy_total && resumen.hoy_total > 0 ? (resumen.hoy_total / rutasFijasCount) : 0;
  const choferesHoy = resumen?.hoy_total ? Math.ceil(resumen.hoy_total / targetPkg) : 0;
  const confianza = diasConDatos.length >= 4 ? "alta" : diasConDatos.length >= 2 ? "media" : "baja";

  // Precisión del modelo: qué tan cerca estuvo el volumen real del esperado
  // histórico (promedio del mismo día de semana). 100% = clavado.
  const precision = (() => {
    const dias = dashboard.filter(d => d.total_actual > 0 && Number(d.promedio_hist) > 0);
    if (dias.length < 2) return null;
    const errores = dias.map(d => Math.abs(d.total_actual - Number(d.promedio_hist)) / d.total_actual);
    const mape = errores.reduce((a, b) => a + b, 0) / errores.length;
    return { pct: Math.max(0, Math.min(100, Math.round((1 - mape) * 100))), n: dias.length };
  })();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      let rutasFijas = RUTAS_FIJAS_DEFAULT;
      try {
        const rfRes = await getRecorridosBase();
        if (rfRes.ok && rfRes.data) {
          const rfCount = rfRes.data.filter(r => r.tipo === "fijo" && r.activo).length;
          if (rfCount > 0) { rutasFijas = rfCount; setRutasFijasCount(rfCount); setCalcRutas(rfCount); }
        }
      } catch { /* usar default */ }
      const [resDash, resSum, resTop, resBandas, resCal] = await Promise.all([
        getDashboardSemanalV2(),
        getResumenSemanalV2(),
        getTopClientes(hoy(), 10),
        getBandasControl(60, targetPkg, rutasFijas),
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

  const dowMañana = dowISO(mañanaISO());
  const chartData = dashboard.map(d => ({
    dia: d.dia_nombre,
    "Esta semana": d.total_actual || undefined,
    "Semana anterior": d.total_anterior || undefined,
    "Promedio histórico": Number(d.promedio_hist) || undefined,
    "Proyección mañana": d.dia_semana === dowMañana && proyectadoTotal ? proyectadoTotal : undefined,
    esHoy: d.fecha_actual === hoy(),
  }));

  async function calcularProyeccion() {
    setCalculando(true);
    try {
      const [resProy, resZonas] = await Promise.all([
        getProyeccionDiaV2(fechaProyeccion, targetPkg, rutasFijasCount),
        getProyeccionZonas(fechaProyeccion, targetPkg),
      ]);
      setProyeccionZonas(resZonas.ok ? (resZonas.data ?? []) : []);
      if (!resProy.ok || !resProy.data) {
        toast.error("Error al calcular proyección", { description: resProy.error });
      } else {
        setProyeccion(resProy.data);
        const paq = calcPaquetes || (resProy.data.esperado_ajust || resProy.data.esperado_base) || 0;
        if (paq > 0) {
          const resRec = await getRecomendacionesOperacion(fechaProyeccion, paq, calcRutas);
          if (resRec.ok && resRec.data) setRecomendaciones(resRec.data);
        }
      }
    } finally { setCalculando(false); }
  }

  const vsAnteriorPct = resumen?.vs_anterior_pct ?? 0;

  const ct = useChartTheme();

  // ── Publicar KPIs al header global (barra superior) ──────────────────────
  const setKpis = useVolumenesStore(s => s.setKpis);
  const setOnRefrescar = useVolumenesStore(s => s.setOnRefrescar);
  useEffect(() => {
    setKpis({
      hoyTotal: resumen?.hoy_total ?? null,
      choferesHoy,
      semanaTotal: resumen?.semana_total ?? null,
      semanaDias: resumen?.semana_dias ?? 0,
      vsAnteriorPct,
      anteriorTotal: resumen?.anterior_total ?? null,
      proyectadoTotal: proyectadoTotal ?? null,
      confianza,
      precisionPct: precision?.pct ?? null,
      precisionN: precision?.n ?? null,
      rutasFijas: rutasFijasCount,
      targetPkg,
      cargando,
    });
  }, [resumen, choferesHoy, vsAnteriorPct, proyectadoTotal, confianza, precision, rutasFijasCount, targetPkg, cargando, setKpis]);
  useEffect(() => {
    setOnRefrescar(() => cargar);
    return () => { setKpis(null); setOnRefrescar(null); };
  }, [cargar, setOnRefrescar, setKpis]);

  // suppress unused warning
  void promDiaActual;
  void MetricCard;
  void SkeletonCards;

  return (
    <div className="flex flex-col h-full bg-background">

      <div className="border-b px-3 sm:px-5 flex gap-0.5 overflow-x-auto no-scrollbar">
        {([
          ["proyeccion",   "Proyección",        TrendingUp],
          ["operacion",    "Operación",         Settings2],
          ["analisis",     "Rendimiento de recorridos", BarChart3],
          ["herramientas", "Herramientas",      Wrench],
        ] as const).map(([t, lbl, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              tab === t ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <Icon className="h-3.5 w-3.5" />
            {lbl}
          </button>
        ))}
      </div>

      <div key={tab} className="flex-1 overflow-y-auto animate-fade-up">

        {tab === "proyeccion" && (() => {
          const promPorRuta = calcRutas > 0 ? calcPaquetes / calcRutas : 0;
          const choferesCalc = calcPaquetes > 0 ? Math.ceil(calcPaquetes / targetPkg) : 0;
          const choferesMin  = calcPaquetes > 0 ? Math.ceil(calcPaquetes / (targetPkg + 5)) : 0;
          const choferesMax  = calcPaquetes > 0 ? Math.ceil(calcPaquetes / (targetPkg - 5)) : 0;
          const zonaCalc = clasificarRiesgo(promPorRuta, targetPkg);
          return (
            <div className="p-5 space-y-5 stagger-children">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Calculadora rápida</p>
                  <div className="border rounded-xl p-5 space-y-4 bg-background">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paquetes esperados</label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <input type="number" min={0} max={9999} value={calcPaquetes || ""}
                          placeholder="ej: 2700"
                          onChange={e => setCalcPaquetes(parseInt(e.target.value) || 0)}
                          className="flex-1 border rounded-lg px-3 py-2 text-lg font-bold h-11 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
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
                            className="h-11 text-xs whitespace-nowrap border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50"
                            onClick={() => setCalcPaquetes(plantillaPara(fechaProyeccion))}>
                            <CalendarDays className="h-3.5 w-3.5" /> {plantillaPara(fechaProyeccion).toLocaleString("es-AR")}
                          </Button>
                        )}
                      </div>
                    </div>
                    {calcPaquetes > 0 && (
                      <Button className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
                        onClick={() => { setPkgProyectado(calcPaquetes); setTipoProyeccion("esperado"); setTab("operacion"); }}>
                        <CheckCircle className="h-4 w-4" /> Usar {calcPaquetes.toLocaleString("es-AR")} paq · Operación del Día
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rutas activas</label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCalcRutas(v => Math.max(1, v - 1))}>−</Button>
                          <input type="number" min={1} max={200} value={calcRutas}
                            onChange={e => setCalcRutas(parseInt(e.target.value) || 1)}
                            className="w-16 text-center border rounded-lg px-2 py-2 text-base font-bold h-9 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCalcRutas(v => v + 1)}>+</Button>
                        </div>
                        <button className="text-[10px] text-blue-600 dark:text-blue-300 mt-1" onClick={() => setCalcRutas(rutasFijasCount)}>RF piso ({rutasFijasCount})</button>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Obj. pkg/chofer</label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setTargetPkg(v => Math.max(10, v - 1))}>−</Button>
                          <span className="text-xl font-bold tabular-nums w-10 text-center">{targetPkg}</span>
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setTargetPkg(v => Math.min(100, v + 1))}>+</Button>
                        </div>
                        <div className="flex gap-1 mt-1">
                          <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Mín {targetPkg-5}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold">Obj {targetPkg}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Máx {targetPkg+5}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {calcPaquetes > 0 && (
                    <div className="border rounded-xl overflow-hidden bg-background">
                      <div className="px-5 py-4 bg-blue-600 text-white text-center">
                        <p className="text-[10px] uppercase tracking-widest opacity-80 font-semibold">Choferes necesarios</p>
                        <p className="text-6xl font-black tabular-nums mt-1"><NumeroAnimado value={choferesCalc} /></p>
                        <p className="text-sm opacity-90 mt-1">{calcPaquetes.toLocaleString("es-AR")} paq ÷ {targetPkg} pkg/chofer</p>
                      </div>
                      <div className="grid grid-cols-3 divide-x border-b">
                        {[
                          { l: "Mín (@"+(targetPkg+5)+")", v: choferesMin },
                          { l: "Esperado (@"+targetPkg+")", v: choferesCalc, hl: true },
                          { l: "Máx (@"+(targetPkg-5)+")", v: choferesMax },
                        ].map(({ l, v, hl }) => (
                          <div key={l} className={cn("p-3 text-center", hl && "bg-blue-50/50 dark:bg-blue-950/40")}>
                            <p className="text-[10px] text-muted-foreground">{l}</p>
                            <p className={cn("text-xl font-bold tabular-nums", hl ? "text-blue-700 dark:text-blue-300" : "")}>{v}</p>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Promedio por ruta ({calcRutas} rutas)</span>
                          <span className="text-lg font-bold tabular-nums" style={{ color: ESTADO[zonaCalc].hex }}>{promPorRuta.toFixed(1)} pkg/ruta</span>
                        </div>
                        <div className="relative h-5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <div className="absolute inset-0 flex">
                            <div className="flex-1 bg-red-100 dark:bg-red-900/40" /><div className="flex-1 bg-amber-100 dark:bg-amber-900/40" />
                            <div className="flex-1 bg-green-100 dark:bg-green-900/40" /><div className="flex-1 bg-amber-100 dark:bg-amber-900/40" />
                            <div className="flex-1 bg-red-100 dark:bg-red-900/40" />
                          </div>
                          {(() => {
                            const min = targetPkg - 12, max = targetPkg + 12;
                            const pct = Math.min(100, Math.max(0, (promPorRuta - min) / (max - min) * 100));
                            return <div className="absolute top-0 bottom-0 w-1 bg-blue-700 rounded-full shadow-md transition-all" style={{ left: `calc(${pct}% - 2px)` }} />;
                          })()}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>↓ Ineficiente ({targetPkg-10})</span>
                          <span className="font-semibold text-green-600 dark:text-green-300">P.E. ({targetPkg})</span>
                          <span>↑ Peligroso ({targetPkg+10})</span>
                        </div>
                        {zonaCalc !== "sin" && <div className="flex justify-center"><EstadoBadge estado={zonaCalc} /></div>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Proyección por fecha</p>
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
                    <div className="border rounded-xl p-4 bg-background space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{proyeccion.dia_nombre} · Semana {proyeccion.semana_mes}: {proyeccion.tipo_semana}</p>
                          <p className="text-[10px] text-muted-foreground">Factor estacional: {proyeccion.factor_semana > 1 ? "+" : ""}{Math.round((proyeccion.factor_semana - 1) * 100)}%</p>
                        </div>
                        <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full border",
                          proyeccion.confianza === "alta" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" :
                          proyeccion.confianza === "media" ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300" :
                          "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300")}>
                          ● Confianza {proyeccion.confianza}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Seleccioná un escenario para usar en Operación:</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { l: "Mínimo", v: proyeccion.minimo ?? 0, c: proyeccion.choferes_min ?? 0, tipo: "min" as const },
                          { l: "Esperado", v: (proyeccion.esperado_ajust || proyeccion.esperado_base) ?? 0, c: proyeccion.choferes_esp ?? 0, hl: true, tipo: "esperado" as const },
                          { l: "Máximo", v: proyeccion.maximo ?? 0, c: proyeccion.choferes_max ?? 0, tipo: "max" as const },
                        ].map(({ l, v, c, hl, tipo }) => {
                          const sel = tipoProyeccion === tipo;
                          const valOk = v > 0;
                          return (
                            <button key={l}
                              onClick={() => { if (!valOk) return; setPkgProyectado(v); setTipoProyeccion(tipo); setCalcPaquetes(v); }}
                              className={cn("border rounded-xl p-3 text-center",
                                valOk ? "hover-lift hover:border-blue-400 cursor-pointer" : "opacity-50 cursor-not-allowed",
                                sel ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400" : hl ? "border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/40" : "")}>
                              <p className="text-[10px] text-muted-foreground font-medium">{l}</p>
                              <p className={cn("text-xl font-bold tabular-nums mt-0.5", sel || hl ? "text-blue-700 dark:text-blue-300" : "")}>{valOk ? v.toLocaleString("es-AR") : "—"}</p>
                              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-300 mt-0.5">{c > 0 ? `${c} choferes` : "—"}</p>
                              {sel && <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold mt-0.5">✓ Seleccionado</p>}
                            </button>
                          );
                        })}
                      </div>
                      {/* ── Proyección por zona (dónde poner la gente) ── */}
                      {proyeccionZonas.some(z => z.esperado > 0) && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5" /> Proyección por zona — choferes sugeridos
                            </span>
                            <span className="text-[10px] text-muted-foreground">objetivo {targetPkg} pkg/chofer</span>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-muted/30 text-muted-foreground">
                              <tr>
                                <th className="text-left px-3 py-1.5 font-medium">Zona</th>
                                <th className="text-right px-2 py-1.5 font-medium">Paq. esperados</th>
                                <th className="text-right px-2 py-1.5 font-medium">Rango</th>
                                <th className="text-right px-3 py-1.5 font-medium">Choferes</th>
                                <th className="text-center px-2 py-1.5 font-medium">Conf.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {proyeccionZonas.map(z => {
                                const sinDatos = z.esperado <= 0;
                                return (
                                <tr key={z.zona} className={cn("hover:bg-accent/20", sinDatos && "opacity-60")}>
                                  <td className="px-3 py-1.5 font-semibold">{z.zona}</td>
                                  {sinDatos ? (
                                    <>
                                      <td colSpan={3} className="px-2 py-1.5 text-center text-[11px] text-muted-foreground italic">
                                        Sin historial para este día todavía
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-2 py-1.5 text-right tabular-nums font-bold text-blue-700 dark:text-blue-300">{z.esperado.toLocaleString("es-AR")}</td>
                                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{z.minimo}–{z.maximo}</td>
                                      <td className="px-3 py-1.5 text-right tabular-nums font-bold">
                                        {z.choferes_esp}
                                        <span className="text-[10px] text-muted-foreground font-normal"> ({z.choferes_min}–{z.choferes_max})</span>
                                      </td>
                                    </>
                                  )}
                                  <td className="px-2 py-1.5 text-center">
                                    <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                                      sinDatos ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500" :
                                      z.confianza === "alta" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
                                      z.confianza === "media" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                                      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300")}>
                                      {sinDatos ? "s/d" : z.confianza}
                                    </span>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="border-t bg-muted/20 font-semibold">
                              <tr>
                                <td className="px-3 py-1.5">Total</td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-blue-700 dark:text-blue-300">
                                  {proyeccionZonas.reduce((s, z) => s + z.esperado, 0).toLocaleString("es-AR")}
                                </td>
                                <td />
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {proyeccionZonas.reduce((s, z) => s + z.choferes_esp, 0)}
                                </td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                          <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-t">
                            Basado en el histórico de Carga del Día del mismo día de la semana. La confianza sube a medida que se acumulan semanas.
                          </p>
                        </div>
                      )}

                      {recomendaciones.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Recomendaciones basadas en historial</span>
                          </div>
                          <div className="divide-y max-h-40 overflow-y-auto">
                            {recomendaciones.map(r => (
                              <div key={r.codigo} className="px-3 py-2 flex items-start gap-3">
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 mt-0.5",
                                  r.prioridad === "alta" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                                  r.prioridad === "media" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}>
                                  {r.prioridad.toUpperCase()}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{r.codigo}</p>
                                  <p className="text-[10px] text-slate-600 dark:text-slate-300">{r.motivo}</p>
                                </div>
                                {r.prom_hist > 0 && (
                                  <p className={cn("text-xs font-bold shrink-0", Number(r.prom_hist) > 40 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300")}>{r.prom_hist} prom</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {tipoProyeccion && pkgProyectado > 0 && (
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold" onClick={() => setTab("operacion")}>
                          <CheckCircle className="h-4 w-4" /> Ir a Operación del Día con {pkgProyectado.toLocaleString("es-AR")} paq
                        </Button>
                      )}
                      <p className="text-[10px] text-muted-foreground text-center">{proyeccion.registros} {proyeccion.dia_nombre}s históricos</p>
                    </div>
                  )}
                  {bandas.length > 0 && (
                    <div className="border rounded-xl p-4 bg-background">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Historial — Promedio pkg/ruta</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <ComposedChart data={bandas.map(b => ({ dia: b.fecha.slice(5), promedio: Number(b.promedio_ruta), zona: b.zona_riesgo }))} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="gradPromedio" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.28} />
                              <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                          <XAxis dataKey="dia" tick={{ fontSize: 9, fill: ct.axis }} stroke={ct.axisLine} interval={Math.floor(bandas.length / 6)} />
                          <YAxis tick={{ fontSize: 9, fill: ct.axis }} stroke={ct.axisLine} domain={[0, targetPkg + 15]} />
                          <Tooltip formatter={(v) => [`${v} pkg/ruta`]} {...ct.tooltip} cursor={{ stroke: ct.axisLine }} />
                          {/* Banda objetivo sombreada (más limpio que 5 líneas) */}
                          <ReferenceArea y1={targetPkg - 5} y2={targetPkg + 5} fill={PALETA.verde} fillOpacity={ct.dark ? 0.12 : 0.08} stroke="none" />
                          <ReferenceLine y={targetPkg} stroke={PALETA.verde} strokeDasharray="5 4" strokeWidth={1.25} />
                          <ReferenceLine y={targetPkg + 10} stroke={PALETA.rojo} strokeDasharray="3 4" strokeWidth={1} strokeOpacity={0.55} />
                          <Area type="monotone" dataKey="promedio" stroke="none" fill="url(#gradPromedio)" />
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <Line type="monotone" dataKey="promedio" stroke="#1d4ed8" strokeWidth={2.5}
                            dot={(p: any) => {
                              if (!p.cx || !p.cy) return <g key={p.key} />;
                              const color = p?.payload?.zona==="ok"?PALETA.verde:p?.payload?.zona?.includes("peligroso")?PALETA.rojo:PALETA.ambar;
                              return <circle key={p.key} cx={p.cx} cy={p.cy} r={3.5} fill={color} stroke={ct.dark ? "#0f172a" : "white"} strokeWidth={1.5} />;
                            }} name="Promedio" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5">
                {topClientes.length > 0 && (() => {
                  const top3 = Math.round(topClientes.slice(0, 3).reduce((s, c) => s + (c.pct ?? 0), 0));
                  const riesgo = top3 >= 50 ? "alto" : top3 >= 35 ? "medio" : "bajo";
                  return (
                  <div className="border rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center gap-2">
                      <p className="text-xs font-semibold">Top clientes hoy</p>
                      {top3 > 0 && (
                        <span className={cn("ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          riesgo === "alto" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                          riesgo === "medio" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                          "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300")}
                          title={`El top 3 de clientes concentra el ${top3}% del volumen del día — riesgo ${riesgo}`}>
                          Top 3 = {top3}% del volumen
                        </span>
                      )}
                    </div>
                    <div className="divide-y">
                      {topClientes.slice(0, 8).map((c, i) => (
                        <div key={i} className="px-4 py-2 flex items-center gap-3 text-xs hover:bg-accent/20">
                          <span className="text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                          <span className="flex-1 font-medium truncate">{c.cliente}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.pct ?? 0}%` }} />
                            </div>
                            <span className="font-bold tabular-nums w-8 text-right">{c.paquetes}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
              <CalidadDatosCard calidad={calidad} />
            </div>
          );
        })()}

        {tab === "operacion" && (
          <OperacionDia
            pkgProyectado={pkgProyectado || (resumen?.hoy_total ?? 0)}
            tipoProyeccion={tipoProyeccion}
            targetPkg={targetPkg}
            fechaInicial={tipoProyeccion ? fechaProyeccion : undefined}
            onConfirmar={() => {}}
          />
        )}

        {tab === "analisis" && <AnalisisOperaciones />}

        {tab === "herramientas" && (() => {
          const HERRAMIENTAS = [
            { id: "kpis", grupo: "Reportes y consultas", Icono: LineChart, titulo: "Monitoreo de KPIs", sub: "Indicadores de performance a largo plazo" },
            { id: "historial", grupo: "Reportes y consultas", Icono: ClipboardList, titulo: "Historial de días", sub: "Registro completo de operaciones pasadas" },
            { id: "informe", grupo: "Reportes y consultas", Icono: FileText, titulo: "Informe del mes", sub: "Resumen mensual de paquetes y rutas, exportable a PDF" },
            { id: "plantillas", grupo: "Configuración", Icono: CalendarDays, titulo: "Plantillas semanales", sub: "Valores de referencia por semana del mes y día de la semana" },
            { id: "feriados", grupo: "Configuración", Icono: CalendarOff, titulo: "Feriados", sub: "Días sin operación y ajuste de proyección posterior" },
          ] as const;
          const activa = HERRAMIENTAS.find(h => h.id === herramientaActiva);

          if (!activa) {
            const grupos = ["Reportes y consultas", "Configuración"] as const;
            return (
              <div className="p-5 space-y-5">
                {grupos.map(g => (
                  <div key={g}>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{g}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {HERRAMIENTAS.filter(h => h.grupo === g).map(h => (
                        <button key={h.id} onClick={() => setHerramientaActiva(h.id)}
                          className="text-left border rounded-xl p-4 bg-background hover:border-blue-400 hover:shadow-md transition-all hover-lift">
                          <p className="text-sm font-bold flex items-center gap-2"><h.Icono className="h-4 w-4 text-blue-600 dark:text-blue-300" /> {h.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-1">{h.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div>
              <div className="px-5 py-3 bg-muted/30 border-b flex items-center gap-3">
                <button onClick={() => setHerramientaActiva(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Herramientas
                </button>
                <div className="h-4 w-px bg-border" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><activa.Icono className="h-3.5 w-3.5" /> {activa.titulo}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{activa.sub}</p>
                </div>
              </div>
              {activa.id === "plantillas" && (
                <PlantillasSemanales onUsarValor={(p) => { setPkgProyectado(p); setCalcPaquetes(p); setTipoProyeccion("esperado"); setTab("operacion"); }} />
              )}
              {activa.id === "feriados" && <Feriados />}
              {activa.id === "kpis" && <KpisMonitoreo />}
              {activa.id === "historial" && <HistorialDias />}
              {activa.id === "informe" && <InformeMensual />}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
