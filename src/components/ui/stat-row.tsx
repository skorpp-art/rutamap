import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  valor: ReactNode;
  /** Línea chica debajo del número (contexto: objetivo, desglose, etc.) */
  sub?: ReactNode;
  /** Color explícito del número (para estados ok / alerta / malo). */
  valorClassName?: string;
}

/**
 * Fila de métricas en una sola caja dividida por separadores — el bloque de
 * KPIs del lenguaje visual nuevo: etiqueta en gris arriba, número grande y
 * contundente abajo. Pensada para 2 a 4 métricas de cabecera.
 */
export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  if (!stats.length) return null;
  return (
    <div
      className={cn(
        "border rounded-lg bg-card overflow-hidden grid divide-x divide-border animate-fade-up",
        stats.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2",
        className
      )}
    >
      {stats.map(s => (
        <div key={s.label} className="px-4 py-3.5 min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{s.label}</p>
          <p className={cn("text-3xl sm:text-4xl font-black tabular-nums leading-none mt-1.5", s.valorClassName)}>
            {s.valor}
          </p>
          {s.sub && <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}
