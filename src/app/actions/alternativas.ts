"use server";

import { createClient } from "@/lib/supabase/server";

// Vía 1: no se pudo entregar y se le pide al cliente otra dirección.
// Vía 2: se le avisa la demora y se le asegura la entrega del día.
export type TipoAlternativa = "alternativa" | "demora";

// pendiente → enviado → alternativa → impreso   |   demora: pendiente → enviado → cerrado
export type EstadoAlternativa = "pendiente" | "enviado" | "alternativa" | "impreso" | "cerrado";

export interface CasoAlternativa {
  id: string;
  fecha: string;
  tipo: TipoAlternativa;
  cliente: string;
  telefono: string | null;
  direccion: string | null;
  recorrido_id: string | null;
  codigo: string | null;
  zona: string | null;
  chofer: string | null;
  estado: EstadoAlternativa;
  alternativa: string | null;
  observacion: string | null;
  enviado_en: string | null;
}

export interface FilaImportada {
  cliente: string;
  telefono: string;
  direccion: string;
  chofer: string;
}

export async function getAlternativas(fecha: string): Promise<{ ok: boolean; data?: CasoAlternativa[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_alternativas", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as CasoAlternativa[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function upsertAlternativa(
  id: string | null, fecha: string, tipo: TipoAlternativa, cliente: string,
  telefono: string, direccion: string, recorridoId: string | null, chofer: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("upsert_alternativa", {
      p_id: id, p_fecha: fecha, p_tipo: tipo, p_cliente: cliente,
      p_telefono: telefono, p_direccion: direccion,
      p_recorrido_id: recorridoId, p_chofer: chofer,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data as string };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Devuelve cuántos entraron y cuántos se omitieron por estar ya cargados ese
// día con el mismo teléfono (pegar la planilla dos veces no duplica el aviso).
export async function importarAlternativas(
  fecha: string, tipo: TipoAlternativa, filas: FilaImportada[]
): Promise<{ ok: boolean; agregados?: number; omitidos?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("importar_alternativas", {
      p_fecha: fecha, p_tipo: tipo, p_filas: filas,
    });
    if (error) return { ok: false, error: error.message };
    const r = (data ?? {}) as { agregados?: number; omitidos?: number };
    return { ok: true, agregados: r.agregados ?? 0, omitidos: r.omitidos ?? 0 };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function setEstadoAlternativa(
  id: string, estado: EstadoAlternativa
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("set_estado_alternativa", { p_id: id, p_estado: estado });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function marcarImpresas(ids: string[]): Promise<{ ok: boolean; marcadas?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("marcar_impresas_alternativas", { p_ids: ids });
    if (error) return { ok: false, error: error.message };
    return { ok: true, marcadas: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function guardarRespuesta(
  id: string, alternativa: string, observacion: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("guardar_respuesta_alternativa", {
      p_id: id, p_alternativa: alternativa, p_observacion: observacion,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function eliminarAlternativa(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_alternativa", { p_id: id });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function limpiarAlternativasDia(fecha: string): Promise<{ ok: boolean; borrados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("limpiar_alternativas_dia", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, borrados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}
