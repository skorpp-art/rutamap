"use server";

import { createClient } from "@/lib/supabase/server";

export interface Parada {
  id: string;
  fecha: string;
  direccion: string;
  lat: number;
  lon: number;
  orden: number;
  recorrido_codigo: string | null;
  dentro: boolean | null;
  estado: string;
}

export async function getRuta(fecha: string): Promise<{ ok: boolean; data?: Parada[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_ruta", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Parada[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function agregarParada(
  fecha: string, direccion: string, lat: number, lon: number,
  recorridoCodigo: string | null, dentro: boolean | null
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("agregar_parada", {
      p_fecha: fecha, p_direccion: direccion, p_lat: lat, p_lon: lon,
      p_recorrido_codigo: recorridoCodigo, p_dentro: dentro,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data as string };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function eliminarParada(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_parada", { p_id: id });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function limpiarRuta(fecha: string): Promise<{ ok: boolean; eliminadas?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("limpiar_ruta", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, eliminadas: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function reordenarRuta(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("reordenar_ruta", { p_ids: ids });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}
