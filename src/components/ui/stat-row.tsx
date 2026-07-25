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
export function StatRow({
  stats,
  labelsUpper = false,
  compact = false,
  className,
}: {
  stats: Stat[];
  /** Etiquetas en mayúscula y con tracking (look de tablero). */
  labelsUpper?: boolean;
  /** Menos alto: para pantallas donde el listado necesita el espacio. */
  compact?: boolean;
  className?: string;
}) {
  if (!stats.length) return null;
  return (
    <div
      className={cn(
        "border rounded-lg bg-card overflow-hidden grid divide-x divide-border animate-fade-up",
        stats.length >= 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          : stats.length === 4 ? "grid-cols-2 sm:grid-cols-4"
          : stats.length === 3 ? "grid-cols-3"
          : "grid-cols-2",
        className
      )}
    >
      {stats.map(s => (
        <div key={s.label} className={cn("min-w-0", compact ? "px-3.5 py-2.5" : "px-4 py-3.5")}>
          <p className={cn(
            "text-muted-foreground",
            labelsUpper
              ? "text-xs font-bold uppercase tracking-widest"
              : compact ? "text-xs truncate" : "text-xs sm:text-sm truncate"
          )}>
            {s.label}
          </p>
          <p className={cn(
            "font-black tabular-nums leading-none",
            compact ? "text-2xl mt-1" : "text-3xl sm:text-4xl mt-1.5",
            s.valorClassName
          )}>
            {s.valor}
          </p>
          {s.sub && (
            <p className={cn("text-xs text-muted-foreground truncate", compact ? "mt-1" : "text-xs mt-1.5")}>
              {s.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
