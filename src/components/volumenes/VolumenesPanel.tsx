"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, Users, CheckCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  getDashboardSemanalV2, getResumenSemanalV2,
  getTopClientes,
  getProyeccionDiaV2, getBandasControl,
  getCalidadDatos,
  getRecorridosBase,
  getPlantillasSemanales,
} from "@/app/actions/volumenes";
import { getRecomendacionesOperacion } from "@/app/actions/operaciones-diarias";
import { OperacionDia } from "./OperacionDia";
import { AnalisisOperaciones } from "./AnalisisOperaciones";
import { PlantillasSemanales } from "./PlantillasSemanales";
import { KpisMonitoreo } from "./KpisMonitoreo";
import { HistorialDias } from "./HistorialDias";
import type {
  DashboardDiaV2, ResumenSemanalV2, ClienteDia,
  ProyeccionDiaV2, BandaControl, CalidadDatos,
  PlantillaCelda,
} from "@/app/actions/volumenes";
import { PALETA, ESTADO, clasificarRiesgo } from "@/lib/estados";
import { useChartTheme } from "@/hooks/useChartTheme";
import { EstadoBadge } from "@/components/ui/estado-badge";
import { NumeroAnimado } from "@/components/ui/numero-animado";
import { SkeletonCards, SkeletonChart } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/ui/metric-card";

function hoy(): string { return new Date().toISOString().slice(0, 10); }
function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function mañanaISO(): string { return addDias(hoy(), 1); }
function dowISO(iso: string): number {
  const d = new Date(iso + "T12:00:00"); return d.getDay() === 0 ? 7 : d.getDay();
}

let RUTAS_FIJAS = 55;

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
    <div className="border rounded-xl p-5 bg-background">
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
  const [calculando, setCalculando] = useState(false);
  const [recomendaciones, setRecomendaciones] = useState<import("@/app/actions/operaciones-diarias").Recomendacion[]>([]);
  const [calcPaquetes, setCalcPaquetes] = useState<number>(0);
  const [calcRutas, setCalcRutas] = useState<number>(53);
  const [bandas, setBandas] = useState<BandaControl[]>([]);
  const [rutasFijasCount, setRutasFijasCount] = useState(53);

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

  const promDiaActual = resumen?.hoy_total && resumen.hoy_total > 0 ? (resumen.hoy_total / RUTAS_FIJAS) : 0;
  const choferesHoy = resumen?.hoy_total ? Math.ceil(resumen.hoy_total / targetPkg) : 0;
  const confianza = diasConDatos.length >= 4 ? "alta" : diasConDatos.length >= 2 ? "media" : "baja";

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
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
      const resProy = await getProyeccionDiaV2(fechaProyeccion, targetPkg, RUTAS_FIJAS);
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
  const DeltaIcon = vsAnteriorPct > 2 ? TrendingUp : vsAnteriorPct < -2 ? TrendingDown : Minus;
  const deltaColor = vsAnteriorPct > 2 ? "text-emerald-600 dark:text-emerald-300" : vsAnteriorPct < -2 ? "text-red-500" : "text-muted-foreground";

  const ct = useChartTheme();

  // suppress unused warning
  void promDiaActual;
  void MetricCard;
  void SkeletonCards;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b px-5 py-3 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold leading-tight">Volúmenes</h1>
          <p className="text-[10px] text-muted-foreground">{RUTAS_FIJAS} recorridos fijos · objetivo {targetPkg} pkg/chofer</p>
        </div>
        <div className="flex items-center gap-4 ml-4 flex-wrap">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Hoy</p>
            <p className="text-base font-bold tabular-nums text-blue-700 dark:text-blue-300 leading-tight">
              {resumen?.hoy_total ? resumen.hoy_total.toLocaleString("es-AR") : "—"}
            </p>
            <p className="text-[9px] text-muted-foreground">{choferesHoy > 0 ? `${choferesHoy} choferes` : "sin datos"}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Semana</p>
            <p className="text-base font-bold tabular-nums leading-tight">
              {resumen?.semana_total ? resumen.semana_total.toLocaleString("es-AR") : "—"}
            </p>
            <p className="text-[9px] text-muted-foreground">{resumen?.semana_dias ?? 0} días</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">vs anterior</p>
            <p className={cn("text-base font-bold tabular-nums leading-tight flex items-center gap-1", deltaColor)}>
              <DeltaIcon className="h-3.5 w-3.5" />
              {vsAnteriorPct !== 0 ? `${vsAnteriorPct > 0 ? "+" : ""}${vsAnteriorPct}%` : "—"}
            </p>
            <p className="text-[9px] text-muted-foreground">{resumen?.anterior_total ? resumen.anterior_total.toLocaleString("es-AR") : "—"}</p>
          </div>
          {proyectadoTotal && (
            <>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Proyección mañana</p>
                <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-300 leading-tight">
                  {proyectadoTotal.toLocaleString("es-AR")}
                </p>
                <p className="text-[9px] text-muted-foreground">confianza {confianza}</p>
              </div>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cargar} disabled={cargando}>
            <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="border-b px-3 sm:px-5 flex gap-0.5 overflow-x-auto no-scrollbar">
        {([
          ["proyeccion",   "📐 Proyección"],
          ["operacion",    "⚙ Operación del Día"],
          ["analisis",     "📊 Análisis"],
          ["herramientas", "🗓 Herramientas"],
        ] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              tab === t ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
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
                            🗓 {plantillaPara(fechaProyeccion).toLocaleString("es-AR")}
                          </Button>
                        )}
                      </div>
                    </div>
                    {calcPaquetes > 0 && (
                      <Button className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
                        onClick={() => { setPkgProyectado(calcPaquetes); setTipoProyeccion("esperado"); setTab("operacion"); }}>
                        ✓ Usar {calcPaquetes.toLocaleString("es-AR")} paq → Operación del Día
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
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Mín {targetPkg-5}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold">Obj {targetPkg}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Máx {targetPkg+5}</span>
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
                        <div className="flex justify-between text-[9px] text-muted-foreground">
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
                              {sel && <p className="text-[9px] text-emerald-600 dark:text-emerald-300 font-bold mt-0.5">✓ Seleccionado</p>}
                            </button>
                          );
                        })}
                      </div>
                      {recomendaciones.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">💡 Recomendaciones basadas en historial</span>
                          </div>
                          <div className="divide-y max-h-40 overflow-y-auto">
                            {recomendaciones.map(r => (
                              <div key={r.codigo} className="px-3 py-2 flex items-start gap-3">
                                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 mt-0.5",
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
                          ✓ Ir a Operación del Día con {pkgProyectado.toLocaleString("es-AR")} paq
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
                          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                          <XAxis dataKey="dia" tick={{ fontSize: 9, fill: ct.axis }} stroke={ct.axisLine} interval={Math.floor(bandas.length / 6)} />
                          <YAxis tick={{ fontSize: 9, fill: ct.axis }} stroke={ct.axisLine} domain={[0, targetPkg + 15]} />
                          <Tooltip formatter={(v) => [`${v} pkg/ruta`]} {...ct.tooltip} />
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 border rounded-xl p-5 bg-background">
                  <p className="text-sm font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-4">Volumen semanal</p>
                  {cargando && !dashboard.length ? <SkeletonChart height={250} /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                        <XAxis dataKey="dia" tick={{ fontSize: 11, fontWeight: 600, fill: ct.axis }} stroke={ct.axisLine} />
                        <YAxis tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.axisLine} tickFormatter={v => v.toLocaleString("es-AR")} />
                        <Tooltip content={<TooltipGrafico />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Semana anterior" fill={PALETA.gris} opacity={0.45} radius={[3,3,0,0]} barSize={20} />
                        <Bar dataKey="Esta semana" radius={[3,3,0,0]} barSize={20}>
                          {chartData.map((e, i) => <Cell key={i} fill={e.esHoy ? "#1d4ed8" : "#3b82f6"} />)}
                        </Bar>
                        <Bar dataKey="Proyección mañana" fill="#7dd3fc" radius={[3,3,0,0]} barSize={20} />
                        <Line type="monotone" dataKey="Promedio histórico" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: "#f97316" }} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {topClientes.length > 0 && (
                  <div className="border rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-muted/20"><p className="text-xs font-semibold">Top clientes hoy</p></div>
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
                )}
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
            onConfirmar={() => {}}
          />
        )}

        {tab === "analisis" && <AnalisisOperaciones />}

        {tab === "herramientas" && (
          <div className="divide-y">
            <div>
              <div className="px-5 py-3 bg-muted/30 border-b">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">🗓 Plantillas semanales</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Valores de referencia por semana del mes y día de la semana</p>
              </div>
              <PlantillasSemanales onUsarValor={(p) => { setPkgProyectado(p); setCalcPaquetes(p); setTipoProyeccion("esperado"); setTab("operacion"); }} />
            </div>
            <div>
              <div className="px-5 py-3 bg-muted/30 border-b">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">📈 Monitoreo de KPIs</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Indicadores de performance a largo plazo</p>
              </div>
              <KpisMonitoreo />
            </div>
            <div>
              <div className="px-5 py-3 bg-muted/30 border-b">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">📋 Historial de días</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Registro completo de operaciones pasadas</p>
              </div>
              <HistorialDias />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
