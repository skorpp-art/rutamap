// ─── Depósito: guarda de bultos ───────────────────────────────────────────────
// Tipos de la app de depósito que se integra a RutaMap. Los nombres de tablas y
// columnas quedan en inglés, como en el origen, para que el traspaso sea
// mecánico y no haya que reescribir cada consulta.

export type EstadoBulto =
  | "stored"            // guardado en el depósito
  | "scheduled_return"  // con retiro agendado
  | "returned"          // ya retirado
  | "deleted"           // borrado (papelera)
  | "cancelled"         // cancelado
  | "duplicate"         // duplicado
  | "cambio"            // cambio
  | "devolucion"        // devolución
  | "rechazado"         // rechazado por el destinatario
  | "ficha";            // ficha administrativa

export const ESTADO_BULTO_LABEL: Record<EstadoBulto, string> = {
  stored: "Guardado",
  scheduled_return: "Retiro agendado",
  returned: "Retirado",
  deleted: "Eliminado",
  cancelled: "Cancelado",
  duplicate: "Duplicado",
  cambio: "Cambio",
  devolucion: "Devolución",
  rechazado: "Rechazado",
  ficha: "Ficha",
};

// Qué cuenta como "está en el depósito". Es una definición del negocio, no una
// obviedad: un bulto cancelado, en cambio, en devolución o rechazado sigue
// físicamente en el galpón ocupando lugar. Lo único que ya no está es lo que se
// retiró ("returned") y lo que se eliminó.
export function estaEnDeposito(status: EstadoBulto | string): boolean {
  return status !== "returned" && status !== "deleted";
}

// Estados de un bulto que está guardado a la espera de salir.
export const ESTADOS_EN_STOCK: EstadoBulto[] = ["stored", "scheduled_return"];

export interface ClienteDeposito {
  id: string;
  name: string;
  nombre_fantasia: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bulto {
  id: string;
  client_id: string;
  description: string | null;
  barcode: string | null;
  tracking_id: string | null;
  status: EstadoBulto;
  entry_date: string;
  scheduled_return_date: string | null;
  actual_return_date: string | null;
  destination_address: string | null;
  destination_locality: string | null;
  remito_number: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Remito ───────────────────────────────────────────────────────────────────
// El documento que se emite cuando el cliente retira bultos del depósito. Se
// guarda el documento, no los paquetes: las líneas quedan congeladas adentro y
// los bultos salen de la tabla, que así representa sólo lo que hay físicamente.
export interface LineaRemito {
  tracking: string | null;
  descripcion: string | null;
  ingreso: string | null;
  destino: string | null;
  localidad: string | null;
  estado: string | null;
}

export interface Remito {
  id: string;
  numero: number | null;
  client_id: string | null;
  cliente_nombre: string;
  fecha: string;
  cantidad: number;
  lineas: LineaRemito[];
  creado_en: string;
}

// La papelera es una red de seguridad para deshacer un error del día, no un
// archivo histórico: lo anterior a esto se puede purgar.
export const DIAS_PAPELERA = 30;

export interface TopCliente {
  id: string;
  name: string;
  notes: string | null;
  bultos_count: number;
}

export interface StockAntiguo {
  id: string;
  client_name: string;
  entry_date: string;
}

// En el origen se cargaron fechas imposibles (0001-01-01, 0026-05-05 y hasta
// 22026-04-17). No rompen la app pero ensucian cualquier cálculo de antigüedad,
// así que se filtran en vez de mostrarlas como si fueran stock viejo.
export function fechaVerosimil(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  const anio = new Date(iso).getFullYear();
  return anio >= 2020 && anio <= new Date().getFullYear() + 1;
}
