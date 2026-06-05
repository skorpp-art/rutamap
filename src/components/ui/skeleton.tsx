import { cn } from "@/lib/utils";

/** Bloque gris con pulso — placeholder mientras cargan los datos. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/70", className)} style={style} />;
}

/** Fila de tarjetas-métrica simuladas. */
export function SkeletonCards({ n = 4, className }: { n?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="border rounded-xl p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Gráfico simulado. */
export function SkeletonChart({ className, height = 200 }: { className?: string; height?: number }) {
  return (
    <div className={cn("border rounded-xl p-5 space-y-3", className)}>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="w-full rounded-lg" style={{ height }} />
    </div>
  );
}

/** Tabla simulada (encabezado + filas). */
export function SkeletonTable({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("border rounded-xl overflow-hidden", className)}>
      <div className="px-4 py-2.5 border-b bg-muted/20">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-3">
            <Skeleton className="h-3 w-5 shrink-0" />
            <Skeleton className="h-3 flex-1" style={{ maxWidth: `${50 + (i % 4) * 12}%` }} />
            <Skeleton className="h-3 w-10 shrink-0 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
