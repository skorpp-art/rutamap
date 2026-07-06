"use server";

import { createClient } from "@/lib/supabase/server";

export interface PaqueteEspecial {
  id: string;
  fecha: string;
  recorrido_id: string;
  codigo: string;
  recorrido_nombre: string;
  zona: string;
  cliente: string | null;
  tracking: string | null;
  direccion: string | null;
  alto_cm: number | null;
  ancho_cm: number | null;
  largo_cm: number | null;
  peso_kg: number | null;
  observacion: string | null;
  imagenes: string[];
  creado_en: string;
}

export interface PaqueteEspecialInput {
  cliente: string | null;
  tracking: string | null;
  direccion: string | null;
  alto_cm: number | null;
  ancho_cm: number | null;
  largo_cm: number | null;
  peso_kg: number | null;
  observacion: string | null;
  imagenes: string[];
}

export async function getPaquetesEspeciales(fecha: string): Promise<{ ok: boolean; data?: PaqueteEspecial[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_paquetes_especiales", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as PaqueteEspecial[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getPaquetesEspecialesRango(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: PaqueteEspecial[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_paquetes_especiales_rango", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as PaqueteEspecial[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function crearPaqueteEspecial(
  fecha: string, recorridoId: string, p: PaqueteEspecialInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("crear_paquete_especial", {
      p_fecha: fecha, p_recorrido_id: recorridoId,
      p_cliente: p.cliente, p_tracking: p.tracking, p_direccion: p.direccion,
      p_alto: p.alto_cm, p_ancho: p.ancho_cm, p_largo: p.largo_cm, p_peso: p.peso_kg,
      p_observacion: p.observacion, p_imagenes: p.imagenes,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data as string };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function eliminarPaqueteEspecial(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_paquete_especial", { p_id: id });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Sugerencias de clientes (los que ya operaron alguna vez)
export async function getClientesSugeridos(): Promise<{ ok: boolean; data?: string[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("clientes_diarios").select("cliente");
    if (error) return { ok: false, error: error.message };
    const unicos = [...new Set((data ?? []).map((r: { cliente: string | null }) => r.cliente).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b));
    return { ok: true, data: unicos };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Chofer asignado a cada recorrido en el rango (para el export de especiales)
export interface ChoferPorFecha { fecha: string; codigo: string; chofer: string }
export async function getChoferesRango(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: ChoferPorFecha[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_choferes_rango", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ChoferPorFecha[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}
