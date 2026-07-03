"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAnalisisRecorridos, type AnalisisRecorrido } from "@/app/actions/operaciones-diarias";

// Cache de módulo: el análisis es el mismo para todos los recorridos, así que
// una sola llamada sirve para todos los clicks de la sesión (TTL 5 min).
let cacheAnalisis: { data: AnalisisRecorrido[]; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getAnalisisCacheado(): Promise<AnalisisRecorrido[]> {
  if (cacheAnalisis && Date.now() - cacheAnalisis.ts < CACHE_TTL_MS) return cacheAnalisis.data;
  const res = await getAnalisisRecorridos(30);
  const data = res.ok && res.data ? res.data : [];
  cacheAnalisis = { data, ts: Date.now() };
  return data;
}

const TENDENCIA = {
  subiendo: { icon: TrendingUp, label: "Subiendo", cls: "text-amber-600 dark:text-amber-300" },
  bajando: { icon: TrendingDown, label: "Bajando", cls: "text-blue-600 dark:text-blue-300" },
  estable: { icon: Minus, label: "Estable", cls: "text-emerald-600 dark:text-emerald-300" },
} as const;

/** Datos operativos del recorrido (vinculados por código) al clickearlo en el mapa. */
export function RendimientoRecorrido({ codigo }: { codigo: string }) {
  const [stats, setStats] = useState<AnalisisRecorrido | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    getAnalisisCacheado()
      .then(data => {
        if (!vivo) return;
        setStats(data.find(r => r.codigo.toUpperCase() === codigo.toUpperCase()) ?? null);
      })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [codigo]);

  if (cargando) {
    return <p className="text-xs text-muted-foreground animate-pulse">Cargando rendimiento…</p>;
  }
  if (!stats || stats.dias_registrados === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin datos operativos de <span className="font-medium">{codigo}</span> en los últimos 30 días.
      </p>
    );
  }

  const t = TENDENCIA[stats.tendencia] ?? TENDENCIA.estable;
  const TIcon = t.icon;
  const sobrecargado = stats.pct_sobrecarga >= 30;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {Number(stats.prom_total).toFixed(1)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">paquetes/día promedio</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", t.cls)}>
          <TIcon className="h-3.5 w-3.5" />{t.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-muted/40 px-1 py-1.5">
          <p className="text-sm font-bold tabular-nums">{stats.dias_registrados}</p>
          <p className="text-[10px] text-muted-foreground">días c/datos</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-1 py-1.5">
          <p className="text-sm font-bold tabular-nums">{stats.min_total}–{stats.max_total}</p>
          <p className="text-[10px] text-muted-foreground">mín–máx</p>
        </div>
        <div className={cn("rounded-lg px-1 py-1.5",
          sobrecargado ? "bg-red-50 dark:bg-red-950/40" : "bg-muted/40")}>
          <p className={cn("text-sm font-bold tabular-nums",
            sobrecargado && "text-red-600 dark:text-red-300")}>
            {Number(stats.pct_sobrecarga).toFixed(0)}%
          </p>
          <p className="text-[10px] text-muted-foreground">días &gt;40 pkg</p>
        </div>
      </div>

      {sobrecargado && (
        <p className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-300">
          <BarChart2 className="h-3 w-3 shrink-0" />
          Sobrecarga frecuente — evaluar dividir la zona o sumar refuerzo.
        </p>
      )}
    </div>
  );
}
