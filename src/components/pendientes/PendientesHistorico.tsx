"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getResumenMesPendientes, getMotivosNoRecibido,
  type ResumenMesDia, type MotivoNoRecibido,
} from "@/app/actions/pendientes";

function primerDiaMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
}
function ultimoDiaMes(anio: number, mes: number): string {
  const d = new Date(anio, mes + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nombreMes(anio: number, mes: number): string {
  return new Date(anio, mes, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function PendientesHistorico() {
  const hoy = new Date();
  const [cursor, setCursor] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
  const [dias, setDias] = useState<ResumenMesDia[]>([]);
  const [motivos, setMotivos] = useState<MotivoNoRecibido[]>([]);
  const [cargando, setCargando] = useState(false);

  const desde = primerDiaMes(cursor.anio, cursor.mes);
  const hasta = ultimoDiaMes(cursor.anio, cursor.mes);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rDias, rMotivos] = await Promise.all([
        getResumenMesPendientes(desde, hasta),
        getMotivosNoRecibido(desde, hasta),
      ]);
      setDias(rDias.ok ? (rDias.data ?? []) : []);
      setMotivos(rMotivos.ok ? (rMotivos.data ?? []) : []);
    } finally { setCargando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const totales = useMemo(() => {
    const total = dias.reduce((s, d) => s + d.total, 0);
    const recibidos = dias.reduce((s, d) => s + d.recibidos, 0);
    const noRecibidos = dias.reduce((s, d) => s + d.no_recibidos, 0);
    const pendientes = dias.reduce((s, d) => s + d.pendientes, 0);
    return {
      total, recibidos, noRecibidos, pendientes,
      pctRecibido: total > 0 ? Math.round(recibidos / total * 100) : 0,
      pctNoRecibido: total > 0 ? Math.round(noRecibidos / total * 100) : 0,
    };
  }, [dias]);

  const maxDia = Math.max(1, ...dias.map(d => d.total));
  const totalMotivos = motivos.reduce((s, m) => s + m.cantidad, 0);

  return (
    <div className="space-y-5">
      {/* Selector de mes */}
      <div className="flex items-center gap-2">
        <button onClick={() => setCursor(c => c.mes === 0 ? { anio: c.anio - 1, mes: 11 } : { anio: c.anio, mes: c.mes - 1 })}
          className="p-1.5 rounded-lg border hover:bg-muted/40 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold capitalize min-w-40 text-center">{nombreMes(cursor.anio, cursor.mes)}</p>
        <button onClick={() => setCursor(c => c.mes === 11 ? { anio: c.anio + 1, mes: 0 } : { anio: c.anio, mes: c.mes + 1 })}
          className="p-1.5 rounded-lg border hover:bg-muted/40 transition-colors">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {totales.total === 0 && !cargando ? (
        <EmptyState icon={BarChart3} title="Sin datos en este mes"
          description="No hay pendientes importados para el período seleccionado." />
      ) : (
        <>
          {/* Tarjetas acumuladas del mes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border rounded-xl p-4 bg-card">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Total del mes</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{totales.total}</p>
            </div>
            <div className="border rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/50">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Recibidos</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-700 dark:text-emerald-300">{totales.recibidos}</p>
              <p className="text-[11px] text-muted-foreground">{totales.pctRecibido}% del total</p>
            </div>
            <div className={cn("border rounded-xl p-4", totales.noRecibidos > 0 && "bg-red-50/50 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/50")}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">No recibidos</p>
              <p className={cn("text-2xl font-bold tabular-nums mt-1", totales.noRecibidos > 0 && "text-red-600 dark:text-red-300")}>{totales.noRecibidos}</p>
              <p className="text-[11px] text-muted-foreground">{totales.pctNoRecibido}% del total</p>
            </div>
            <div className="border rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/50">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Sin marcar</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-amber-700 dark:text-amber-300">{totales.pendientes}</p>
            </div>
          </div>

          {/* Barra comparativa recibido vs no recibido vs sin marcar */}
          <div>
            <p className="text-xs font-semibold mb-2">Recibido vs. no recibido (acumulado del mes)</p>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${totales.pctRecibido}%` }} title={`Recibidos: ${totales.recibidos}`} />
              <div className="h-full bg-red-500" style={{ width: `${totales.pctNoRecibido}%` }} title={`No recibidos: ${totales.noRecibidos}`} />
              <div className="h-full bg-muted-foreground/20" title={`Sin marcar: ${totales.pendientes}`} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Recibido ({totales.pctRecibido}%)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />No recibido ({totales.pctNoRecibido}%)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />Sin marcar</span>
            </div>
          </div>

          {/* Evolución diaria */}
          <div className="border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-2.5 border-b bg-muted/20">
              <p className="text-sm font-semibold">Evolución por día</p>
            </div>
            <div className="p-4 space-y-1.5">
              {dias.map(d => (
                <div key={d.fecha} className="flex items-center gap-2 text-[11px]">
                  <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}</span>
                  <div className="flex-1 h-4 rounded bg-muted overflow-hidden flex" style={{ maxWidth: "100%" }}>
                    <div className="h-full bg-emerald-500" style={{ width: `${d.total > 0 ? d.recibidos / maxDia * 100 : 0}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${d.total > 0 ? d.no_recibidos / maxDia * 100 : 0}%` }} />
                    <div className="h-full bg-muted-foreground/20" style={{ width: `${d.total > 0 ? d.pendientes / maxDia * 100 : 0}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">{d.recibidos}/{d.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Desglose de motivos de no recibido */}
          {motivos.length > 0 && (
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="px-4 py-2.5 border-b bg-muted/20">
                <p className="text-sm font-semibold">Motivos de no recibido</p>
              </div>
              <div className="divide-y">
                {motivos.map(m => (
                  <div key={m.motivo} className="flex items-center gap-3 px-4 py-2 text-xs">
                    <span className="flex-1 font-medium">{m.motivo}</span>
                    <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                      <div className="h-full bg-red-500" style={{ width: `${totalMotivos > 0 ? m.cantidad / totalMotivos * 100 : 0}%` }} />
                    </div>
                    <span className="tabular-nums w-10 text-right font-semibold">{m.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
