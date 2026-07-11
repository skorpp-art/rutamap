"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import type * as XLSX from "xlsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Upload, BarChart2, AlertTriangle, TrendingUp, TrendingDown, Minus,
  FileSpreadsheet, CheckCircle, Package, Users, RefreshCw, Trash2,
  ChevronDown, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import {
  ComposedChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, ReferenceArea,
} from "recharts";
import {
  getAnalisisRecorridos,
  getDashboardUnificado, getRutasAlerta, eliminarDiaCompleto,
  getDiaCompleto, getPatronDiaSemana,
} from "@/app/actions/operaciones-diarias";
import type {
  AnalisisRecorrido,
  DashboardUnificado, RutaAlerta, PatronDiaSemana,
} from "@/app/actions/operaciones-diarias";
import { PALETA } from "@/lib/estados";
import { useChartTheme } from "@/hooks/useChartTheme";
import { SkeletonCards, SkeletonChart } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { hoyAR } from "@/lib/fechas";

// ── Colores ───────────────────────────────────────────────────────────────────
const ZONA_COLORS: Record<string, { bg: string; text: string }> = {
  Oeste: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  Norte: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  Sur:   { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300" },
  CABA:  { bg: "bg-red-100 dark:bg-red-900/40",   text: "text-red-700 dark:text-red-300" },
  "Pre-Turno": { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
};
function colorProm(p: number) {
  if (p > 40) return "text-red-600 dark:text-red-300 font-bold";
  if (p > 35) return "text-amber-600 dark:text-amber-300 font-semibold";
  if (p < 20) return "text-slate-400 dark:text-slate-500";
  return "text-green-600 dark:text-green-300 font-semibold";
}

// ── Tooltip del gráfico ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipUnif({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: DashboardUnificado = payload[0]?.payload;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-bold">{label} · {d?.dia_nombre}</p>
      {d?.total_paquetes > 0 && <p>Paquetes: <b>{d.total_paquetes.toLocaleString("es-AR")}</b></p>}
      {d?.rutas_activas > 0 && <p>Rutas: <b>{d.rutas_activas}</b> ({d.rutas_fijas}F {d.rutas_preturno}PT)</p>}
      {d?.prom_por_ruta > 0 && <p>Prom/ruta: <b className={colorProm(d.prom_por_ruta)}>{d.prom_por_ruta}</b></p>}
      {d?.choferes_30 > 0 && <p>Choferes @30: <b>{d.choferes_30}</b></p>}
      <p className="text-[10px] text-muted-foreground flex gap-1">
        {d?.tiene_clientes && <span className="text-blue-600 dark:text-blue-300">● Clientes</span>}
        {d?.tiene_ops && <span className="text-green-600 dark:text-green-300">● Operaciones</span>}
      </p>
    </div>
  );
}

// ── Detalle expandible de un día (top clientes + zonas + alertas) ──────────────
function DiaDetalleInline({ fecha }: { fecha: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detalle, setDetalle] = useState<Record<string, any> | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getDiaCompleto(fecha).then(res => {
      if (res.ok && res.data) setDetalle(res.data);
      setCargando(false);
    });
  }, [fecha]);

  if (cargando) return <td colSpan={10} className="bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-xs text-muted-foreground text-center">Cargando detalle…</td>;
  if (!detalle) return <td colSpan={10} className="bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-xs text-muted-foreground text-center">Sin detalle</td>;

  const porZona: { zona: string; rutas: number; total: number; prom: number; alertas: number }[] = detalle.por_zona ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rutasAlerta: any[] = detalle.rutas_alerta ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topClientes: any[] = (detalle.top_clientes ?? []).slice(0, 6);

  return (
    <td colSpan={10} className="bg-slate-50 dark:bg-slate-800/40 px-4 py-4 border-b">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top clientes */}
        {topClientes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" /> Top clientes
            </p>
            {topClientes.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-4 text-right">{i+1}</span>
                <span className="flex-1 truncate font-medium">{c.cliente}</span>
                <span className="font-bold tabular-nums">{c.paquetes}</span>
              </div>
            ))}
            {detalle.total_clientes > 6 && (
              <p className="text-[10px] text-muted-foreground">+ {detalle.total_clientes - 6} más · Total {Number(detalle.total_paquetes).toLocaleString("es-AR")} paq</p>
            )}
          </div>
        )}
        {/* Por zona */}
        {porZona.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Por zona
            </p>
            {porZona.map(z => (
              <div key={z.zona} className="flex items-center gap-2 text-xs">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium min-w-14 text-center shrink-0", ZONA_COLORS[z.zona]?.bg, ZONA_COLORS[z.zona]?.text)}>{z.zona}</span>
                <span className="text-muted-foreground tabular-nums w-14">{z.rutas} rutas</span>
                <span className={cn("font-semibold tabular-nums", colorProm(z.prom))}>{z.prom} prom</span>
                {z.alertas > 0 && <span className="text-[10px] text-red-600 dark:text-red-300 font-bold">⚠{z.alertas}</span>}
              </div>
            ))}
          </div>
        )}
        {/* Rutas en alerta */}
        {rutasAlerta.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-300 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Sobrecarga (&gt;35)
            </p>
            {rutasAlerta.slice(0, 6).map((r: { codigo: string; total: number; x_fuera: number }) => (
              <div key={r.codigo} className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-blue-700 dark:text-blue-300 w-20">{r.codigo}</span>
                <span className={cn("font-bold tabular-nums", r.total > 40 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300")}>{r.total} paq</span>
                {r.x_fuera > 0 && <span className="text-[10px] text-amber-500">+{r.x_fuera}</span>}
              </div>
            ))}
          </div>
        )}
        {porZona.length === 0 && rutasAlerta.length === 0 && (
          <div className="col-span-3 text-center text-xs text-muted-foreground py-2">
            Sin datos de recorridos para este día. Importá el Excel de operaciones para ver el detalle por zona.
          </div>
        )}
      </div>
    </td>
  );
}

// ── Patrón por día de la semana de un recorrido (dato ya calculado en la BD) ───
function hexProm(p: number) {
  if (p > 40) return PALETA.rojo;
  if (p > 35) return PALETA.ambar;
  if (p < 20) return PALETA.gris;
  return PALETA.verde;
}
function PatronDiaInline({ codigo }: { codigo: string }) {
  const ct = useChartTheme();
  const [data, setData] = useState<PatronDiaSemana[] | null>(null);

  useEffect(() => {
    let vivo = true;
    getPatronDiaSemana(codigo).then(r => {
      if (!vivo) return;
      setData(r.ok && r.data ? r.data : []);
    });
    return () => { vivo = false; };
  }, [codigo]);

  if (!data) return <div className="py-4 text-center text-xs text-muted-foreground">Cargando patrón por día…</div>;
  if (data.length === 0) return <div className="py-4 text-center text-xs text-muted-foreground">Sin datos suficientes por día</div>;

  const chart = data.map(d => ({ dia: d.dia_nombre.slice(0, 3), prom: Number(d.prom_total), reg: d.registros, xf: Number(d.prom_x_fuera) }));
  const pico = chart.reduce((a, b) => (b.prom > a.prom ? b : a), chart[0]);
  const valle = chart.reduce((a, b) => (b.prom < a.prom && b.prom > 0 ? b : a), pico);

  return (
    <div className="py-3 px-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Promedio por día de la semana</p>
        {pico.prom > 35 && (
          <span className="text-[10px] text-muted-foreground">
            · Pico <b style={{ color: hexProm(pico.prom) }}>{pico.dia} ({pico.prom})</b>
            {valle.prom < pico.prom && <> · valle <b className="text-green-600 dark:text-green-300">{valle.dia} ({valle.prom})</b></>}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.axisLine} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: ct.axis }} stroke={ct.axisLine} tickLine={false} axisLine={false} />
          <Tooltip {...ct.tooltip} cursor={ct.tooltipCursor}
            formatter={(v) => [`${v} pkg/día`, "Promedio"]} />
          <ReferenceLine y={35} stroke={PALETA.ambar} strokeDasharray="3 4" strokeWidth={1} strokeOpacity={0.5} />
          <ReferenceLine y={40} stroke={PALETA.rojo} strokeDasharray="3 4" strokeWidth={1} strokeOpacity={0.5} />
          <Bar dataKey="prom" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chart.map((e, i) => <Cell key={i} fill={hexProm(e.prom)} fillOpacity={0.85} />)}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function AnalisisOperaciones() {
  const [dashboard, setDashboard] = useState<DashboardUnificado[]>([]);
  const [alertas, setAlertas] = useState<RutaAlerta[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisRecorrido[]>([]);
  const [diasVista, setDiasVista] = useState(30);
  const [cargando, setCargando] = useState(false);
  const [borrandoDia, setBorrandoDia] = useState<string | null>(null);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);
  const [ordenCol, setOrdenCol] = useState<keyof AnalisisRecorrido>("prom_total");
  const [ordenDir, setOrdenDir] = useState<"asc" | "desc">("desc");
  const [recorridoExpandido, setRecorridoExpandido] = useState<string | null>(null);

  function ordenarPor(col: keyof AnalisisRecorrido) {
    if (ordenCol === col) setOrdenDir(d => (d === "desc" ? "asc" : "desc"));
    else { setOrdenCol(col); setOrdenDir("desc"); }
  }
  const analisisOrdenado = [...analisis].sort((a, b) => {
    const av = a[ordenCol], bv = b[ordenCol];
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return ordenDir === "asc" ? cmp : -cmp;
  });

  async function eliminarDia(fecha: string) {
    const fechaFmt = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    if (!confirm(`¿Eliminar TODOS los datos del ${fechaFmt}?\n\nSe borran los paquetes/clientes y los recorridos importados de ese día. No se puede deshacer.`)) return;
    setBorrandoDia(fecha);
    try {
      const res = await eliminarDiaCompleto(fecha);
      if (!res.ok) { toast.error("Error al eliminar el día", { description: res.error }); return; }
      toast.success(`Día eliminado (${res.clientes ?? 0} clientes · ${res.operaciones ?? 0} recorridos)`);
      await cargarDatos(diasVista);
    } finally { setBorrandoDia(null); }
  }

  // Cargar datos al montar
  useEffect(() => { cargarDatos(diasVista); }, []);

  async function cargarDatos(dias: number) {
    setCargando(true);
    try {
      const [resDash, resAlertas, resAnalisis] = await Promise.all([
        getDashboardUnificado(dias),
        getRutasAlerta(dias),
        getAnalisisRecorridos(dias),
      ]);
      if (resDash.ok && resDash.data) setDashboard(resDash.data);
      if (resAlertas.ok && resAlertas.data) setAlertas(resAlertas.data);
      if (resAnalisis.ok && resAnalisis.data) setAnalisis(resAnalisis.data);
    } finally { setCargando(false); }
  }

  // ── Datos del gráfico (últimos 14 días, orden cronológico) ─────────────────
  const chartData = [...dashboard]
    .slice(0, 14)
    .reverse()
    .map(d => ({
      ...d,
      dia: d.fecha.slice(5),
      paquetes: d.total_paquetes || undefined,
      promedio: d.prom_por_ruta > 0 ? d.prom_por_ruta : undefined,
      choferes: d.choferes_30 || undefined,
    }));

  const tieneClientes = dashboard.some(d => d.tiene_clientes);
  const tieneOps = dashboard.some(d => d.tiene_ops);
  const sinDatos = dashboard.length === 0;
  const ct = useChartTheme();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar único */}
      <div className="px-5 py-2 border-b flex items-center gap-2 bg-background flex-wrap">
        <div className="flex gap-1">
          {[14, 30, 60].map(d => (
            <button key={d} onClick={() => { setDiasVista(d); cargarDatos(d); }}
              className={cn("text-[10px] px-2 py-1 rounded border transition-colors",
                diasVista === d ? "bg-slate-700 text-white border-slate-700" : "border-border text-muted-foreground")}>
              {d} días
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cargarDatos(diasVista)} disabled={cargando}>
          <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
        </Button>
      </div>

      {/* ── Contenido en scroll único ── */}
      <div className="flex-1 overflow-y-auto">

        <div className="p-5 space-y-6 stagger-children">

          {/* ── Sección 1: Visión general ─────────────────────────────────────── */}
          {cargando && sinDatos ? (
            <>
              <SkeletonCards n={4} />
              <SkeletonChart height={280} />
            </>
          ) : sinDatos ? (
            <EmptyState
              icon={BarChart2}
              title="No hay datos todavía"
              description='Cargá y publicá el día desde "Carga del Día" (incluye el Excel de paquetes por cliente) para ver el análisis unificado.'
            />
          ) : (
            <>
              {/* Resumen proactivo: qué necesita atención */}
              {analisis.length > 0 && (() => {
                const sob = analisis.filter(a => a.pct_sobrecarga >= 50).length;
                const xf = analisis.filter(a => a.prom_x_fuera >= 3).length;
                const alza = analisis.filter(a => a.tendencia === "subiendo" && a.prom_total > 32).length;
                const atencion = new Set<string>();
                analisis.forEach(a => {
                  if (a.pct_sobrecarga >= 50 || a.prom_x_fuera >= 3 || (a.tendencia === "subiendo" && a.prom_total > 32)) atencion.add(a.codigo);
                });
                if (atencion.size === 0) {
                  return (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5">
                      <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Todo en orden — ningún recorrido requiere atención</span>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 flex-wrap">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" />
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                      {atencion.size} recorrido{atencion.size > 1 ? "s" : ""} necesita{atencion.size > 1 ? "n" : ""} atención
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                      {sob > 0 && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{sob} sobrecargado{sob > 1 ? "s" : ""}</span>}
                      {xf > 0 && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{xf} con X fuera alto</span>}
                      {alza > 0 && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">{alza} en alza</span>}
                    </div>
                  </div>
                );
              })()}

              {/* Badges de fuentes */}
              <div className="flex gap-2 text-[10px] flex-wrap">
                <span className={cn("px-2 py-1 rounded-full border flex items-center gap-1",
                  tieneClientes ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300" : "bg-slate-50 dark:bg-slate-800/40 border-dashed text-muted-foreground")}>
                  <Package className="h-3 w-3" />
                  {tieneClientes ? "Paquetes/clientes ✓" : "Sin datos de paquetes"}
                </span>
                <span className={cn("px-2 py-1 rounded-full border flex items-center gap-1",
                  tieneOps ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300" : "bg-slate-50 dark:bg-slate-800/40 border-dashed text-muted-foreground")}>
                  <Users className="h-3 w-3" />
                  {tieneOps ? "Operaciones por recorrido ✓" : "Sin datos de recorridos"}
                </span>
                {!tieneClientes && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-300 self-center">→ Importá el Excel de clientes para ver paquetes totales</span>
                )}
              </div>

              {/* Gráficos de evolución */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded-xl p-5 bg-background">
                  <p className="text-sm font-bold mb-4">Paquetes — últimos {Math.min(14, dashboard.length)} días</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 5 }} barCategoryGap="20%">
                      <defs>
                        <linearGradient id="gradPaquetes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.axisLine} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.axisLine} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString("es-AR")} />
                      <Tooltip content={<TooltipUnif />} cursor={ct.tooltipCursor} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        formatter={(value) => <span style={{ color: ct.legendColor }}>{value}</span>} />
                      {tieneClientes && (
                        <Bar dataKey="paquetes" name="Paquetes totales" fill="url(#gradPaquetes)" radius={[4,4,0,0]} maxBarSize={32} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="border rounded-xl p-5 bg-background">
                  <p className="text-sm font-bold mb-4">Choferes y promedio/ruta — últimos {Math.min(14, dashboard.length)} días</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 5 }} barCategoryGap="35%">
                      <defs>
                        <linearGradient id="gradChoferes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={PALETA.verde} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={PALETA.verde} stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.axisLine} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.axisLine} tickLine={false} axisLine={false} domain={[0, 'dataMax + 5']} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.axisLine} tickLine={false} axisLine={false} domain={[0, 60]} />
                      <Tooltip content={<TooltipUnif />} cursor={ct.tooltipCursor} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        formatter={(value) => <span style={{ color: ct.legendColor }}>{value}</span>} />
                      {tieneOps && (
                        <ReferenceArea yAxisId="right" y1={25} y2={35} fill={PALETA.verde} fillOpacity={ct.dark ? 0.10 : 0.07} stroke="none" />
                      )}
                      {tieneOps && (
                        <>
                          <Bar yAxisId="left" dataKey="choferes" name="Choferes @30" fill="url(#gradChoferes)" radius={[4,4,0,0]} maxBarSize={28} />
                          <Line yAxisId="right" type="monotone" dataKey="promedio" stroke="#1d4ed8" strokeWidth={2.5} name="Prom pkg/ruta" dot={{ r: 3.5, fill: "#1d4ed8", strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                          <ReferenceLine yAxisId="right" y={30} stroke={PALETA.verde} strokeDasharray="5 4" strokeWidth={1.25} />
                          <ReferenceLine yAxisId="right" y={40} stroke={PALETA.rojo} strokeDasharray="3 4" strokeWidth={1} strokeOpacity={0.5} />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className="text-red-400">- - - 40 (máx)</span>
                    <span className="text-green-600 dark:text-green-300">— — 30 (P.E.)</span>
                  </div>
                </div>
              </div>

              {/* Tabla detalle por día */}
              <div className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center">
                  <p className="text-xs font-semibold">Detalle por día</p>
                  <p className="text-[10px] text-muted-foreground ml-auto">Clic en fila para ver detalle</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 dark:bg-muted/20 border-b sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        <th className="w-6 px-2 py-2" />
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Fecha</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Día</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Paq.</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Rutas</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Prom.</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">X%</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Efect.</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Chof.@30</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Estado</th>
                        <th className="text-center px-2 py-2 text-muted-foreground font-medium text-[10px]">Borrar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dashboard.map(d => {
                        const exp = diaExpandido === d.fecha;
                        return (
                          <Fragment key={d.fecha + d.dia_nombre}>
                            <tr onClick={() => setDiaExpandido(exp ? null : d.fecha)}
                              className={cn("hover:bg-accent/30 cursor-pointer transition-colors", exp && "bg-blue-50/50 dark:bg-blue-950/40")}>
                              <td className="px-2 py-1.5 text-center text-muted-foreground">
                                {exp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </td>
                              <td className="px-3 py-1.5 font-semibold tabular-nums">
                                {new Date(d.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">{d.dia_nombre}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {d.total_paquetes > 0 ? d.total_paquetes.toLocaleString("es-AR") : <span className="text-muted-foreground/40">—</span>}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {d.rutas_activas > 0
                                  ? <span>{d.rutas_activas} <span className="text-[10px] text-muted-foreground">({d.rutas_fijas}F {d.rutas_preturno}PT)</span></span>
                                  : <span className="text-muted-foreground/40">—</span>}
                              </td>
                              <td className={cn("px-3 py-1.5 text-right tabular-nums font-semibold", colorProm(d.prom_por_ruta))}>
                                {d.prom_por_ruta > 0 ? d.prom_por_ruta : "—"}
                              </td>
                              <td className={cn("px-3 py-1.5 text-right tabular-nums", d.pct_x_fuera > 5 ? "text-amber-600 dark:text-amber-300 font-semibold" : "text-muted-foreground")}>
                                {d.pct_x_fuera > 0 ? `${d.pct_x_fuera}%` : "—"}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {d.efectividad_pct != null ? (
                                  <span className={cn("font-semibold",
                                    d.efectividad_pct >= 90 ? "text-emerald-600 dark:text-emerald-300" :
                                    d.efectividad_pct >= 75 ? "text-amber-600 dark:text-amber-300" : "text-red-500")}
                                    title={`Proyectado: ${d.proyectado_pkg} · Real: ${d.total_paquetes}`}>
                                    {d.efectividad_pct}%
                                  </span>
                                ) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-blue-700 dark:text-blue-300 font-semibold">
                                {d.choferes_30 > 0 ? d.choferes_30 : "—"}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                  d.estado === "SOBRECARGA" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                                  d.estado === "SOBRE TARGET" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                                  d.estado === "OK" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                                  "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}>
                                  {d.estado}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); eliminarDia(d.fecha); }}
                                  disabled={borrandoDia === d.fecha}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                                  title="Eliminar datos del día">
                                  {borrandoDia === d.fecha
                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              </td>
                            </tr>
                            {exp && (
                              <tr><DiaDetalleInline fecha={d.fecha} /></tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Alertas de recorridos */}
              {alertas.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b bg-red-50 dark:bg-red-950/40 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">Recorridos con sobrecarga frecuente — últimos {diasVista} días</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-background border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Código</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Zona</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Prom.</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Máx.</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">% días &gt;40</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Recomendación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {alertas.map(r => (
                        <tr key={r.codigo} className="hover:bg-accent/20">
                          <td className="px-3 py-2 font-mono font-bold text-blue-700 dark:text-blue-300">{r.codigo}</td>
                          <td className="px-3 py-2">
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", ZONA_COLORS[r.zona]?.bg, ZONA_COLORS[r.zona]?.text)}>{r.zona}</span>
                          </td>
                          <td className={cn("px-3 py-2 text-right font-bold tabular-nums", colorProm(r.prom_total))}>{r.prom_total}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.max_total}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={cn("font-bold", r.pct_sobre >= 75 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300")}>{r.pct_sobre}%</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full",
                              r.recomendacion.includes("permanente") ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold" :
                              r.recomendacion.includes("frecuente") ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                              "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}>
                              {r.recomendacion}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── Sección 2: Análisis por recorrido ────────────────────────────── */}
          {analisis.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/20 border-b flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" /> Análisis por recorrido — últimos {diasVista} días
                </p>
                <p className="text-[10px] text-muted-foreground ml-auto">Clic en una fila → patrón por día</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/40 dark:bg-muted/20 border-b sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    {([
                      ["codigo", "Código", "left"],
                      ["zona", "Zona", "left"],
                      ["dias_registrados", "Días", "right"],
                      ["prom_total", "Prom.", "right"],
                      ["prom_x_fuera", "X Fuera", "right"],
                      ["max_total", "Máx", "right"],
                      ["pct_sobrecarga", "% >40", "right"],
                    ] as const).map(([col, label, align]) => {
                      const activo = ordenCol === col;
                      return (
                        <th key={col}
                          onClick={() => ordenarPor(col)}
                          className={cn("px-3 py-2.5 font-medium cursor-pointer select-none transition-colors",
                            align === "right" ? "text-right" : "text-left",
                            activo ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                          <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
                            {label}
                            {activo
                              ? (ordenDir === "desc" ? <ArrowDown className="h-3 w-3 text-primary" /> : <ArrowUp className="h-3 w-3 text-primary" />)
                              : <ArrowUpDown className="h-3 w-3 opacity-25" />}
                          </span>
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Tend.</th>
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Alerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analisisOrdenado.map(r => {
                    const exp = recorridoExpandido === r.codigo;
                    return (
                    <Fragment key={r.codigo}>
                    <tr onClick={() => setRecorridoExpandido(exp ? null : r.codigo)}
                      className={cn("transition-colors hover:bg-accent/30 cursor-pointer",
                      exp ? "bg-primary/5" : r.pct_sobrecarga >= 50 ? "bg-red-50/40 dark:bg-red-950/30" : "even:bg-muted/15 dark:even:bg-muted/10")}>
                      <td className="px-3 py-2 font-mono font-bold text-blue-700 dark:text-blue-300">
                        <span className="inline-flex items-center gap-1.5">
                          {exp ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                          {r.codigo}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", ZONA_COLORS[r.zona]?.bg, ZONA_COLORS[r.zona]?.text)}>{r.zona}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.dias_registrados}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", colorProm(r.prom_total))}>{r.prom_total}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", r.prom_x_fuera >= 3 ? "text-amber-600 dark:text-amber-300 font-semibold" : "text-muted-foreground")}>
                        {r.prom_x_fuera > 0 ? `+${r.prom_x_fuera}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.max_total}</td>
                      <td className="px-3 py-2 text-right">
                        {r.pct_sobrecarga > 0
                          ? <span className={cn("font-semibold", r.pct_sobrecarga >= 50 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300")}>{r.pct_sobrecarga}%</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          r.tendencia === "subiendo" ? "text-red-500" :
                          r.tendencia === "bajando"  ? "text-green-600 dark:text-green-300" : "text-muted-foreground"
                        )}>
                          {r.tendencia === "subiendo" ? <TrendingUp className="h-3.5 w-3.5" /> :
                           r.tendencia === "bajando"  ? <TrendingDown className="h-3.5 w-3.5" /> :
                           <Minus className="h-3.5 w-3.5" />}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {r.pct_sobrecarga >= 50 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">⚠ Sobrecarga</span>}
                          {r.prom_x_fuera >= 3 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">X Fuera alto</span>}
                          {r.tendencia === "subiendo" && r.prom_total > 32 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">↑ Revisar</span>}
                        </div>
                      </td>
                    </tr>
                    {exp && (
                      <tr>
                        <td colSpan={11} className="bg-muted/20 dark:bg-muted/10 border-b p-0">
                          <PatronDiaInline codigo={r.codigo} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
