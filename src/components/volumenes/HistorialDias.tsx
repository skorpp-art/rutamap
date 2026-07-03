"use client";

import { useState, useEffect, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, AlertTriangle, RefreshCw, Package, Users, TrendingDown, CalendarDays } from "lucide-react";
import { getHistorialDiasV2, getDiaCompleto } from "@/app/actions/operaciones-diarias";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { HistorialDiaV2 } from "@/app/actions/operaciones-diarias";

const ZONA_COLORS: Record<string, string> = {
  Oeste: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
  Norte: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
  Sur:   "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900",
  CABA:  "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
};
const SEMANA_LABELS: Record<number, string> = {
  1: "Tarjetas", 2: "Sueldos", 3: "Baja", 4: "Normal",
};

function colorProm(p: number) {
  if (p > 40) return "text-red-600 dark:text-red-300 font-bold";
  if (p > 35) return "text-amber-600 dark:text-amber-300 font-semibold";
  if (p < 20) return "text-slate-400 dark:text-slate-500";
  return "text-green-600 dark:text-green-300 font-semibold";
}

interface DiaDetalleProps {
  fecha: string;
}
function DiaDetalle({ fecha }: DiaDetalleProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detalle, setDetalle] = useState<Record<string, any> | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getDiaCompleto(fecha).then(res => {
      if (res.ok && res.data) setDetalle(res.data);
      setCargando(false);
    });
  }, [fecha]);

  if (cargando) return <div className="p-4 text-xs text-muted-foreground text-center">Cargando detalle…</div>;
  if (!detalle) return null;

  const porZona: { zona: string; rutas: number; total: number; prom: number; alertas: number }[] = detalle.por_zona ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rutasAlerta: any[] = detalle.rutas_alerta ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topClientes: any[] = (detalle.top_clientes ?? []).slice(0, 5);

  return (
    <tr>
      <td colSpan={10} className="bg-slate-50 dark:bg-slate-800/40 px-4 py-4 border-b">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Paquetes por cliente */}
          {topClientes.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" /> Top clientes del día
              </p>
              <div className="space-y-1">
                {topClientes.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-4 text-right shrink-0">{i+1}</span>
                    <span className="flex-1 truncate font-medium">{c.cliente}</span>
                    <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="font-bold tabular-nums w-8 text-right">{c.paquetes}</span>
                  </div>
                ))}
                {detalle.total_clientes > 5 && (
                  <p className="text-[10px] text-muted-foreground">
                    + {detalle.total_clientes - 5} clientes más · Total: {Number(detalle.total_paquetes).toLocaleString("es-AR")} paq
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Por zona */}
          {porZona.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Recorridos por zona
              </p>
              <div className="space-y-1.5">
                {porZona.map(z => (
                  <div key={z.zona} className="flex items-center gap-2 text-xs">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border w-14 text-center shrink-0", ZONA_COLORS[z.zona])}>
                      {z.zona}
                    </span>
                    <span className="text-muted-foreground tabular-nums w-16">{z.rutas} rutas</span>
                    <span className={cn("font-semibold tabular-nums", colorProm(z.prom))}>{z.prom} prom</span>
                    {z.alertas > 0 && (
                      <span className="text-[10px] text-red-600 dark:text-red-300 font-bold">⚠ {z.alertas}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rutas en alerta */}
          {rutasAlerta.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-300 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Rutas con sobrecarga (&gt;35)
              </p>
              <div className="space-y-1">
                {rutasAlerta.slice(0, 6).map((r: { codigo: string; zona: string; total: number; x_fuera: number }) => (
                  <div key={r.codigo} className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-300 w-20 shrink-0">{r.codigo}</span>
                    <span className={cn("font-bold tabular-nums", r.total > 40 ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300")}>
                      {r.total} paq
                    </span>
                    {r.x_fuera > 0 && (
                      <span className="text-[10px] text-amber-500">+{r.x_fuera} fuera</span>
                    )}
                  </div>
                ))}
                {rutasAlerta.length > 6 && (
                  <p className="text-[10px] text-muted-foreground">+ {rutasAlerta.length - 6} más</p>
                )}
              </div>
            </div>
          )}

          {/* Sin datos de operaciones */}
          {porZona.length === 0 && rutasAlerta.length === 0 && (
            <div className="col-span-3 text-center text-xs text-muted-foreground py-2">
              <TrendingDown className="h-4 w-4 mx-auto mb-1 opacity-40" />
              No hay datos de recorridos para este día. Importá el Excel de operaciones para ver el detalle.
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function HistorialDias() {
  const [dias, setDias] = useState(30);
  const [historial, setHistorial] = useState<HistorialDiaV2[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  // Filtro por día de la semana (null = todos)
  const [filtroDia, setFiltroDia] = useState<string | null>(null);

  useEffect(() => { cargar(dias); }, []);

  async function cargar(d: number) {
    setCargando(true);
    try {
      const res = await getHistorialDiasV2(d);
      if (res.ok && res.data) setHistorial(res.data);
    } finally { setCargando(false); }
  }

  // Filtrar por día + promedios de la selección
  const historialFiltrado = filtroDia
    ? historial.filter(d => d.dia_semana === filtroDia)
    : historial;

  const prom = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const resumen = filtroDia ? (() => {
    const conPaq = historialFiltrado.filter(d => d.total_paquetes > 0);
    const conRutas = historialFiltrado.filter(d => d.rutas_activas > 0);
    const promRutaVals = historialFiltrado.filter(d => Number(d.prom_por_ruta) > 0).map(d => Number(d.prom_por_ruta));
    return {
      diasMostrados: historialFiltrado.length,
      diasConPaq: conPaq.length,
      promPaquetes: prom(conPaq.map(d => d.total_paquetes)),
      promRutas: prom(conRutas.map(d => d.rutas_activas)),
      promPorRuta: promRutaVals.length ? (promRutaVals.reduce((a, b) => a + b, 0) / promRutaVals.length).toFixed(1) : "—",
    };
  })() : null;

  // Días de semana presentes en el rango cargado (para no mostrar botones vacíos)
  const diasPresentes = new Set(historial.map(d => d.dia_semana));

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b flex items-center gap-3 bg-background flex-wrap">
        <p className="text-sm font-semibold">Historial de días</p>
        <div className="flex gap-1">
          {[14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => { setDias(d); cargar(d); }}
              className={cn("text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                dias === d ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground")}>
              {d}d
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        {/* Filtro por día de la semana */}
        <div className="flex gap-1 items-center">
          <button onClick={() => setFiltroDia(null)}
            className={cn("text-[10px] px-1.5 py-0.5 rounded border transition-colors",
              filtroDia === null ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground")}>
            Todos
          </button>
          {DIAS_SEMANA.filter(d => diasPresentes.has(d)).map(d => (
            <button key={d} onClick={() => setFiltroDia(filtroDia === d ? null : d)}
              className={cn("text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                filtroDia === d ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground")}>
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => cargar(dias)} disabled={cargando}>
          <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Clic en una fila para ver el detalle completo del día
        </p>
      </div>

      {/* Resumen de la selección por día de semana */}
      {resumen && (
        <div className="px-5 py-3 border-b bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-5 flex-wrap">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
            {filtroDia}s en los últimos {dias} días
          </span>
          <span className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground tabular-nums text-base">{resumen.diasConPaq}</span> {resumen.diasConPaq === 1 ? "día" : "días"} con datos
          </span>
          <span className="text-xs text-muted-foreground">
            Promedio paquetes: <span className="font-bold text-blue-700 dark:text-blue-300 tabular-nums text-base">{resumen.promPaquetes.toLocaleString("es-AR")}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Promedio recorridos: <span className="font-bold text-blue-700 dark:text-blue-300 tabular-nums text-base">{resumen.promRutas}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Promedio pkg/ruta: <span className="font-bold tabular-nums">{resumen.promPorRuta}</span>
          </span>
        </div>
      )}

      {cargando ? (
        <div className="p-4"><SkeletonTable rows={8} /></div>
      ) : historialFiltrado.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filtroDia ? `Sin ${filtroDia.toLowerCase()}s en este rango` : "Sin historial todavía"}
          description={filtroDia
            ? "Ampliá el rango de días o quitá el filtro para ver más."
            : "Importá el Excel de clientes y/o el de operaciones para empezar a ver el historial día por día."}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/40 dark:bg-muted/20 border-b backdrop-blur-sm">
              <tr>
                <th className="w-6 px-2 py-2.5" />
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Fecha</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Día</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Semana</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Clientes</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Paquetes</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Rutas</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Prom/ruta</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Alertas</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Choferes</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Prom/chofer</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Acierto proy.</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">vs sem. ant.</th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map(d => {
                const isExp = expandido === d.fecha;
                return (
                  <Fragment key={d.fecha}>
                    <tr
                      onClick={() => setExpandido(isExp ? null : d.fecha)}
                      className={cn("cursor-pointer border-b transition-colors hover:bg-accent/30",
                        isExp && "bg-blue-50/40 dark:bg-blue-950/40")}>
                      <td className="px-2 py-2 text-center text-muted-foreground">
                        {isExp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {new Date(d.fecha + "T12:00:00").toLocaleDateString("es-AR", {
                          day: "2-digit", month: "short", year: "2-digit"
                        })}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{d.dia_semana}</td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                          d.semana_mes === 1 ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300" :
                          d.semana_mes === 2 ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300" :
                          d.semana_mes === 3 ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400" :
                          "bg-slate-50 dark:bg-slate-800/40 border-slate-100 text-slate-400 dark:text-slate-500")}>
                          {SEMANA_LABELS[d.semana_mes] ?? "Normal"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {d.total_clientes > 0 ? d.total_clientes : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        {d.total_paquetes > 0 ? d.total_paquetes.toLocaleString("es-AR") : <span className="text-muted-foreground/40 font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {d.rutas_activas > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            {d.rutas_activas}
                            {d.tiene_ops && <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />}
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", colorProm(Number(d.prom_por_ruta)))}>
                        {Number(d.prom_por_ruta) > 0 ? d.prom_por_ruta : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {d.rutas_en_alerta > 0 ? (
                          <span className="text-red-600 dark:text-red-300 font-bold flex items-center justify-end gap-0.5">
                            <AlertTriangle className="h-3 w-3" />{d.rutas_en_alerta}
                          </span>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-300 font-semibold">
                        {d.choferes_real != null ? d.choferes_real : (d.choferes_30 > 0 ? `~${d.choferes_30}` : "—")}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", colorProm(Number(d.prom_por_chofer_real ?? 0)))}>
                        {d.prom_por_chofer_real != null ? d.prom_por_chofer_real : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {d.acierto_pct != null ? (
                          <span className={cn("font-semibold",
                            d.acierto_pct >= 90 ? "text-emerald-600 dark:text-emerald-300" :
                            d.acierto_pct >= 75 ? "text-amber-600 dark:text-amber-300" : "text-red-500")}
                            title={`Proyectado (prom. histórico): ${d.proyectado_pkg} · Real: ${d.total_paquetes}`}>
                            {d.acierto_pct}%
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium",
                        d.vs_semana_ant == null ? "text-muted-foreground/40" :
                        Number(d.vs_semana_ant) > 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-500")}>
                        {d.vs_semana_ant != null
                          ? `${Number(d.vs_semana_ant) > 0 ? "+" : ""}${d.vs_semana_ant}%`
                          : "—"}
                      </td>
                    </tr>
                    {isExp && <DiaDetalle fecha={d.fecha} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
