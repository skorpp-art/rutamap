"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  recibido_en: string | null;
  recibido_por: string | null;
}

export interface FechaPendiente {
  fecha: string;
  total: number;
  recibidos: number;
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

// Cuántos recibidos ya hay (para avisar antes de reimportar)
export async function getMarcasExistentes(fecha: string): Promise<{ ok: boolean; marcas?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("pendientes_marcas_existentes", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, marcas: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function importarPendientes(
  fecha: string, filas: PendienteFila[], forzar = false
): Promise<{ ok: boolean; importados?: number; error?: string; requiereConfirmacion?: boolean }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("importar_pendientes", {
      p_fecha: fecha, p_filas: filas, p_forzar: forzar,
    });
    if (error) {
      // El RPC lanza este mensaje cuando hay marcas y no se forzó
      if (error.message?.includes("marcados como recibidos")) {
        return { ok: false, requiereConfirmacion: true, error: error.message };
      }
      return { ok: false, error: error.message };
    }
    revalidatePath("/pendientes");
    return { ok: true, importados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function marcarPendiente(id: string, recibido: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("marcar_pendiente", { p_id: id, p_recibido: recibido });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function marcarPendientesCadete(
  fecha: string, cadete: string | null, recibido: boolean
): Promise<{ ok: boolean; actualizados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("marcar_pendientes_cadete", {
      p_fecha: fecha, p_cadete: cadete, p_recibido: recibido,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, actualizados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Marcar un conjunto por id (para "recibí todo" de cualquier agrupación)
export async function marcarPendientesLote(
  ids: string[], recibido: boolean
): Promise<{ ok: boolean; actualizados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("marcar_pendientes_lote", {
      p_ids: ids, p_recibido: recibido,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, actualizados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}
