"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type EstadoRecepcion = "pendiente" | "recibido" | "no_recibido";

export interface PendienteFila {
  fecha_hogareno: string | null;
  macrozona: string;
  zona: string | null;
  urgencia: string | null;
  tracking: string | null;
  direccion: string | null;
  estado: string | null;
  cadete: string | null;
  cliente: string | null;
}

export interface Pendiente {
  id: string;
  fecha: string;
  fecha_hogareno: string | null;
  macrozona: string;
  zona: string | null;
  urgencia: string | null;
  tracking: string | null;
  direccion: string | null;
  estado: string | null;
  cadete: string | null;
  cliente: string | null;
  recibido: boolean;
  estado_recepcion: EstadoRecepcion;
  motivo_no_recibido: string | null;
  observacion: string | null;
  recibido_en: string | null;
  recibido_por: string | null;
  fecha_ultima_vista: string;
  reincidencia: boolean;
  nro_ciclo: number;
}

export interface ResultadoImport {
  nuevos: number;
  actualizados: number;
  reincidencias: number;
  total: number;
}

export interface FechaPendiente {
  fecha: string;
  total: number;
  recibidos: number;
  no_recibidos: number;
}

export interface ResumenMesDia {
  fecha: string;
  total: number;
  recibidos: number;
  no_recibidos: number;
  pendientes: number;
}

export interface MotivoNoRecibido {
  motivo: string;
  cantidad: number;
}

export async function getPendientesFechas(): Promise<{ ok: boolean; data?: FechaPendiente[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_pendientes_fechas");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as FechaPendiente[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getPendientes(fecha: string): Promise<{ ok: boolean; data?: Pendiente[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_pendientes", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Pendiente[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Importa un reporte de Pendientes. Ya no "borra y repone un día": cada fila se
// fusiona por tracking. Si el tracking sigue abierto (no recibido), se actualiza
// en el lugar sin duplicar ni tocar su fecha original ni sus marcas. Si el
// tracking ya estaba recibido y reaparece, es una reincidencia real y se crea
// una fila nueva ligada al mismo tracking. Por eso un mismo Excel puede traer
// pendientes de días distintos (últimas 48hs hábiles) sin generar duplicados.
export async function importarPendientes(
  fecha: string, filas: PendienteFila[]
): Promise<{ ok: boolean; resultado?: ResultadoImport; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("importar_pendientes", {
      p_fecha: fecha, p_filas: filas,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pendientes");
    return { ok: true, resultado: data as ResultadoImport };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function marcarPendiente(
  id: string, estado: EstadoRecepcion, motivo?: string | null, observacion?: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("marcar_pendiente", {
      p_id: id, p_estado: estado, p_motivo: motivo ?? null, p_observacion: observacion ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function marcarPendientesCadete(
  fecha: string, cadete: string | null, estado: EstadoRecepcion, motivo?: string | null, observacion?: string | null
): Promise<{ ok: boolean; actualizados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("marcar_pendientes_cadete", {
      p_fecha: fecha, p_cadete: cadete, p_estado: estado, p_motivo: motivo ?? null, p_observacion: observacion ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, actualizados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Marcar un conjunto por id (para "recibí todo" de cualquier agrupación)
export async function marcarPendientesLote(
  ids: string[], estado: EstadoRecepcion, motivo?: string | null, observacion?: string | null
): Promise<{ ok: boolean; actualizados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("marcar_pendientes_lote", {
      p_ids: ids, p_estado: estado, p_motivo: motivo ?? null, p_observacion: observacion ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, actualizados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Dashboard histórico mensual
export async function getResumenMesPendientes(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: ResumenMesDia[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_pendientes_resumen_mes", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ResumenMesDia[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getMotivosNoRecibido(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: MotivoNoRecibido[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_pendientes_motivos", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as MotivoNoRecibido[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}
