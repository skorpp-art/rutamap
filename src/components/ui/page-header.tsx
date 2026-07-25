import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Encabezado de página con el lenguaje visual "editorial": título grande y
 * contundente, dato de contexto a la derecha (fecha, estado) y una regla
 * gruesa que separa del contenido. Da aire y jerarquía sin ocupar mucho alto.
 */
export function PageHeader({
  titulo,
  meta,
  acciones,
  className,
}: {
  titulo: ReactNode;
  /** Contexto a la derecha del título: fecha, período, etc. */
  meta?: ReactNode;
  /** Acciones opcionales debajo de la regla (botón primario, filtros). */
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-up", className)}>
      <div className="flex items-baseline gap-4 flex-wrap pb-2.5">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
          {titulo}
        </h2>
        {/* first-letter (y no capitalize) para no romper "24 de julio" */}
        {meta && (
          <span className="ml-auto text-sm text-muted-foreground first-letter:uppercase">
            {meta}
          </span>
        )}
      </div>
      {/* Regla marcada: la firma del estilo */}
      <div className="border-b-2 border-foreground/80" />
      {acciones && <div className="pt-3">{acciones}</div>}
    </div>
  );
}
