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
  estado: "pendiente" | "entregado";
  pendiente_id: string | null;
}

export interface CadeteHoy {
  cadete: string;
  total: number;
  geocodificados: number;
}

export interface PendienteParaRuta {
  id: string;
  direccion: string;
  cliente: string | null;
  tracking: string | null;
  zona: string | null;
  lat: number | null;
  lon: number | null;
}

type Res<T> = { ok: true; data: T } | { ok: false; error: string };
function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sb(): Promise<any> { return await createClient(); }

export async function getRuta(fecha: string): Promise<Res<Parada[]>> {
  try {
    const { data, error } = await (await sb()).rpc("get_ruta", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Parada[] };
  } catch (e) { return fallo(e); }
}

/** Quiénes reparten hoy y cuántos paquetes ya están listos para salir. */
export async function getCadetesHoy(fecha: string): Promise<Res<CadeteHoy[]>> {
  try {
    const { data, error } = await (await sb()).rpc("get_cadetes_hoy", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as CadeteHoy[] };
  } catch (e) { return fallo(e); }
}

export async function getPendientesParaRuta(fecha: string, cadete: string): Promise<Res<PendienteParaRuta[]>> {
  try {
    const { data, error } = await (await sb()).rpc("get_pendientes_para_ruta", {
      p_fecha: fecha, p_cadete: cadete,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as PendienteParaRuta[] };
  } catch (e) { return fallo(e); }
}

/** Cachea el resultado del geocoding en el propio pendiente: no se vuelve a pedir. */
export async function guardarGeocodificacion(id: string, lat: number, lon: number): Promise<Res<null>> {
  try {
    const { error } = await (await sb()).rpc("guardar_geocodificacion_pendiente", {
      p_id: id, p_lat: lat, p_lon: lon,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}

export async function agregarParada(
  fecha: string, direccion: string, lat: number, lon: number,
  recorridoCodigo: string | null, dentro: boolean | null, pendienteId: string | null = null,
): Promise<Res<string | null>> {
  try {
    const { data, error } = await (await sb()).rpc("agregar_parada", {
      p_fecha: fecha, p_direccion: direccion, p_lat: lat, p_lon: lon,
      p_recorrido_codigo: recorridoCodigo, p_dentro: dentro, p_pendiente_id: pendienteId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as string | null };
  } catch (e) { return fallo(e); }
}

export async function eliminarParada(id: string): Promise<Res<null>> {
  try {
    const { error } = await (await sb()).rpc("eliminar_parada", { p_id: id });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}

export async function limpiarRuta(fecha: string): Promise<Res<number>> {
  try {
    const { data, error } = await (await sb()).rpc("limpiar_ruta", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? 0) as number };
  } catch (e) { return fallo(e); }
}

export async function reordenarRuta(ids: string[]): Promise<Res<null>> {
  try {
    const { error } = await (await sb()).rpc("reordenar_ruta", { p_ids: ids });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}

/**
 * Marca (o desmarca) una parada como entregada. Si venía de un pendiente,
 * intenta reflejarlo también ahí — devuelve si lo logró, porque requiere ser
 * editor y quien carga la ruta puede no serlo.
 */
export async function marcarParadaEstado(id: string, entregada: boolean): Promise<Res<boolean>> {
  try {
    const { data, error } = await (await sb()).rpc("marcar_parada_estado", {
      p_id: id, p_entregada: entregada,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: !!data };
  } catch (e) { return fallo(e); }
}
