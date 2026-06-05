"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Zona, TipoRecorrido } from "@/types/database.types";

// ─── Geometría ────────────────────────────────────────────────────────────────

export async function actualizarAreaRecorrido(
  id: string,
  geojsonStr: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("actualizar_area_recorrido", {
      p_id: id,
      p_area_geojson: geojsonStr,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function actualizarTrazaRecorrido(
  id: string,
  geojsonStr: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("actualizar_traza_recorrido", {
      p_id: id,
      p_traza_geojson: geojsonStr,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Crear / editar campos ────────────────────────────────────────────────────

export interface DatosRecorrido {
  codigo: string;
  nombre: string;
  zona: Zona;
  tipo: TipoRecorrido;
  color: string;
  descripcion?: string | null;
}

export async function crearRecorrido(
  datos: DatosRecorrido
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("crear_recorrido", {
      p_codigo: datos.codigo,
      p_nombre: datos.nombre,
      p_zona: datos.zona,
      p_tipo: datos.tipo,
      p_color: datos.color,
      p_descripcion: datos.descripcion ?? null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true, id: data as string };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function actualizarCamposRecorrido(
  id: string,
  datos: DatosRecorrido
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("actualizar_campos_recorrido", {
      p_id: id,
      p_codigo: datos.codigo,
      p_nombre: datos.nombre,
      p_zona: datos.zona,
      p_tipo: datos.tipo,
      p_color: datos.color,
      p_descripcion: datos.descripcion ?? null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function toggleActivoRecorrido(
  id: string,
  activo: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("toggle_activo_recorrido", {
      p_id: id,
      p_activo: activo,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function eliminarRecorrido(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_recorrido", { p_id: id });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getSiguienteCodigo(
  zona: string, tipo: string
): Promise<{ ok: boolean; codigo?: string; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_siguiente_codigo", {
      p_zona: zona, p_tipo: tipo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, codigo: data as string };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function duplicarRecorrido(
  id: string,
  nuevoCodigo: string
): Promise<{ ok: boolean; nuevoId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("duplicar_recorrido", {
      p_id: id,
      p_nuevo_codigo: nuevoCodigo.trim().toUpperCase(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true, nuevoId: data as string };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
