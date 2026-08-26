import type { EstadoCaso } from "@/app/actions/casos";

// ─── Vocabulario compartido de la pantalla de Casos ──────────────────────────

export interface InfoEstado {
  label: string;
  /** Qué significa, en una línea, para quien no vive adentro del módulo. */
  desc: string;
  clase: string;
  cerrado?: boolean;
}

export const ESTADO_INFO: Record<EstadoCaso, InfoEstado> = {
  abierto: {
    label: "Abierto", desc: "Se cargó el caso y todavía no lo tomó nadie",
    clase: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  },
  en_gestion: {
    label: "En gestión", desc: "Coordinación lo está trabajando",
    clase: "bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300",
  },
  reintento: {
    label: "Reintento", desc: "Vuelve a salir a reparto",
    clase: "bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-300",
  },
  entrega_imposible: {
    label: "Entrega imposible", desc: "No se puede entregar; decide Asesoría",
    clase: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300",
  },
  pendiente_cliente: {
    label: "Pendiente cliente", desc: "Esperando respuesta del cliente",
    clase: "bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-300",
  },
  entregado: {
    label: "Entregado", desc: "Se entregó: el caso queda cerrado",
    clase: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
    cerrado: true,
  },
  cancelado: {
    label: "Cancelado", desc: "Se dio de baja sin entrega",
    clase: "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/60",
    cerrado: true,
  },
};

export const ESTADOS: EstadoCaso[] = [
  "abierto", "en_gestion", "reintento", "entrega_imposible",
  "pendiente_cliente", "entregado", "cancelado",
];

// Las etiquetas que se usaban en el Excel para anotar qué se hizo con cada
// paquete. Se ofrecen como atajos: un clic las mete en el cuadro de texto de
// la nota (plan de acción, observación o reintento) en vez de tipearlas cada
// vez. No reemplazan el texto libre, lo completan.
export const PLANES_ACCION = [
  "Salen mañana", "Sale en recorrido por la mañana", "Moto Personalizada",
  "Recorrido C/ Suplente", "Recorrido C/ Titular",
  "Especial Post 12hs", "Preturno C/ Suplente", "Preturno C/ Titular",
  "Extraviado/Roto", "Cambio/Devolucion Retirado",
  "No vino el chofer", "No llego reposicion", "Direccion alternativa conseguida",
  "Repetido", "Rechazado", "Devuelto al cliente", "Sin devoluciones",
  "Pendiente de respuesta chofer", "Reprogramado en deposito", "En deposito",
  "Retiro de paquete", "Alternativa solicitada", "Devolucion armada",
  "Paquete cruzado", "Figura a retirar", "Cliente brindo direccion correcta",
  "RETENER", "A la espera respuesta de cliente",
];

export const TIPOS_INCIDENCIA = [
  "Dirección incorrecta",
  "Ausente",
  "Rechazado por el cliente",
  "Paquete dañado",
  "Faltante en depósito",
  "Demorado",
  "Zona sin cobertura",
  "Otro",
];

export const AREA_LABEL: Record<string, string> = {
  asesoria: "Asesoría",
  coordinacion: "Coordinación",
  cerrado: "Cerrado",
  ambas: "Las dos áreas",
};

// ─── El corte de las 10:00 ───────────────────────────────────────────────────
// Hasta las 10 de la mañana Coordinación todavía puede tocar los recorridos del
// día. Pasada esa hora, lo que entre ya no se puede meter en la salida de hoy y
// va a la del día siguiente. Por eso la lista lo marca: es la diferencia entre
// "esto se resuelve hoy" y "esto ya es de mañana".

export const HORA_CORTE = 10;

const TZ_AR = "America/Argentina/Buenos_Aires";

const fmtHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ_AR, hour: "2-digit", minute: "2-digit", hour12: false,
});
const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ_AR, day: "2-digit", month: "2-digit",
});
const fmtISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_AR, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Hora argentina (0-23) de un timestamp. */
function horaAR(iso: string): number {
  return Number(fmtHora.format(new Date(iso)).slice(0, 2));
}

export function fechaAR(iso: string): string {
  return fmtISO.format(new Date(iso));
}

/** "14/08 09:35" — formato corto para tablas y línea de tiempo. */
export function fechaHoraCorta(iso: string): string {
  return `${fmtFecha.format(new Date(iso))} ${fmtHora.format(new Date(iso))}`;
}

export function horaCorta(iso: string): string {
  return fmtHora.format(new Date(iso));
}

/** ¿Entró a tiempo para ajustar los recorridos de ese mismo día? */
export function antesDelCorte(iso: string): boolean {
  return horaAR(iso) < HORA_CORTE;
}

/** ¿Ya pasó el corte de hoy? Define si la lista muestra el aviso. */
export function corteYaPaso(): boolean {
  return horaAR(new Date().toISOString()) >= HORA_CORTE;
}
