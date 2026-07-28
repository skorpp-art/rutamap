import type { EstadoAlternativa, TipoAlternativa } from "@/app/actions/alternativas";

/** Recorrido de la Carga del Día, para asociar el caso a un móvil real. */
export interface RecorridoDia {
  recorrido_id: string;
  codigo: string;
  zona: string;
  chofer: string | null;
}

export const TIPO_INFO: Record<TipoAlternativa, { label: string; clase: string }> = {
  alternativa: {
    label: "Alternativa",
    clase: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  demora: {
    label: "Demora",
    clase: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
};

export const ESTADO_INFO: Record<EstadoAlternativa, { label: string; clase: string }> = {
  pendiente: {
    label: "Sin enviar",
    clase: "bg-muted text-muted-foreground",
  },
  enviado: {
    label: "Enviado",
    clase: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  alternativa: {
    label: "C/ alternativa",
    clase: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  impreso: {
    label: "Impreso",
    clase: "bg-foreground text-background",
  },
  cerrado: {
    label: "Cerrado",
    clase: "bg-muted text-muted-foreground",
  },
};

/** Estados en los que el caso todavía espera algo de nosotros. */
export const ABIERTOS: EstadoAlternativa[] = ["pendiente", "enviado", "alternativa"];
