import { cn } from "@/lib/utils";
import { ESTADO, type EstadoRiesgo } from "@/lib/estados";

/** Chip de estado operativo — color y etiqueta consistentes en toda la app. */
export function EstadoBadge({
  estado,
  label,
  className,
}: {
  estado: EstadoRiesgo;
  /** Sobreescribe la etiqueta por defecto del estado. */
  label?: string;
  className?: string;
}) {
  const s = ESTADO[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
        s.bg, s.text, s.border, className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
      {label ?? s.label}
    </span>
  );
}
