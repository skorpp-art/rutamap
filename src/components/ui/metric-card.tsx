import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de métrica unificada — misma estética en Dashboard, Monitoreo y demás.
 * - `accent` (hex): tiñe ícono, número y borde (para estados ok/alerta/malo).
 * - `delta`: muestra el chip de tendencia (+/- %).
 * - `valueClassName`: color explícito del número cuando no hay accent.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon,
  accent,
  delta,
  valueClassName,
  index = 0,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  delta?: number;
  valueClassName?: string;
  index?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("border rounded-xl p-4 bg-background animate-fade-up flex flex-col gap-1", className)}
      style={{
        animationDelay: `${index * 70}ms`,
        borderColor: accent ? accent + "55" : undefined,
      }}
    >
      {/* Encabezado: ícono opcional + etiqueta */}
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color: accent }} className={cn(!accent && "text-muted-foreground")}>{icon}</span>}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold truncate">
          {label}
        </span>
      </div>

      {/* Valor + tendencia */}
      <div className="flex items-end gap-2">
        <p
          className={cn("text-3xl font-bold tabular-nums leading-none", valueClassName ?? "text-foreground")}
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </p>
        {delta !== undefined && delta !== 0 && (
          <span
            className={cn(
              "text-sm font-semibold flex items-center gap-0.5 mb-0.5",
              delta > 0 ? "text-emerald-600" : "text-red-500"
            )}
          >
            {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
