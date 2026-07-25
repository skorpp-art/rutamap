import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Encabezado de página con el lenguaje visual "editorial": título contundente,
 * descripción corta al lado (no debajo, para no gastar una fila), dato de
 * contexto a la derecha y una regla que separa del contenido.
 *
 * El tamaño del título es el mismo en toda la app (y coincide con el de la
 * barra superior en Mapa/Planificación) para que no haya títulos de distinto
 * porte según la pantalla.
 */
export function PageHeader({
  titulo,
  desc,
  meta,
  acciones,
  className,
}: {
  titulo: ReactNode;
  /** Descripción corta: se muestra en línea, a la derecha del título. */
  desc?: ReactNode;
  /** Contexto a la derecha: fecha, período, etc. */
  meta?: ReactNode;
  /** Acciones opcionales debajo de la regla. */
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-up", className)}>
      <div className="flex items-baseline gap-3 flex-wrap pb-2">
        <h2 className="text-2xl font-black tracking-tight leading-none shrink-0">
          {titulo}
        </h2>
        {desc && (
          <p className="text-sm text-muted-foreground min-w-0 flex-1">{desc}</p>
        )}
        {/* first-letter (y no capitalize) para no romper "24 de julio" */}
        {meta && (
          <span className="ml-auto text-sm text-muted-foreground first-letter:uppercase shrink-0">
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
