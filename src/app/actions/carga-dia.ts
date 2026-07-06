"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TurnoCarga = "tarde" | "preturno";

export interface CargaFila {
  id: string;
  fecha: string;
  turno: TurnoCarga;
  recorrido_id: string;
  codigo: string;
  nombre: string;
  zona: string;
  tipo: string;
  chofer: string | null;
  sistema: number;
  x_fuera: number;
  estado_control: "verde" | "rojo" | null;
}

export async function getCargaDia(fecha: string): Promise<{ ok: boolean; data?: CargaFila[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_carga_dia", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as CargaFila[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function upsertCargaFila(
  fecha: string, turno: TurnoCarga, recorridoId: string,
  chofer: string | null, sistema: number, xFuera: number
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("upsert_carga_fila", {
      p_fecha: fecha, p_turno: turno, p_recorrido_id: recorridoId,
      p_chofer: chofer, p_sistema: sistema, p_x_fuera: xFuera,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data as string };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function eliminarCargaFila(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_carga_fila", { p_id: id });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function iniciarCargaDesdeOperacion(
  fecha: string, turno: TurnoCarga
): Promise<{ ok: boolean; agregados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("iniciar_carga_desde_operacion", {
      p_fecha: fecha, p_turno: turno,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, agregados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Publica la carga en operaciones_diarias → alimenta el análisis (reemplaza el import de Excel)
export async function publicarCargaDia(fecha: string): Promise<{ ok: boolean; publicados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("publicar_carga_dia", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true, publicados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Control de los coordinadores de noche: cada hora chequean cuántos paquetes
// tiene el chofer y marcan el recorrido en verde u rojo. Independiente de
// sistema/x_fuera (ese es el que cargó el coordinador de zona antes del reparto).
export async function setEstadoControlFila(
  id: string, estado: "verde" | "rojo" | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("set_estado_control_fila", { p_id: id, p_estado: estado });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getChoferesConocidos(): Promise<{ ok: boolean; data?: string[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_choferes_carga");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: ((data ?? []) as { chofer: string }[]).map(r => r.chofer) };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── Banco de conductores ──────────────────────────────────────────────────────
// Nómina estable de conductores (equivale a la hoja "Conductores" del Excel).
// Se puede importar desde el Excel o agregar de a uno.

export async function getConductores(): Promise<{ ok: boolean; data?: string[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_conductores");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: ((data ?? []) as { nombre: string }[]).map(r => r.nombre) };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function agregarConductor(nombre: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("agregar_conductor", { p_nombre: nombre });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function importarConductores(nombres: string[]): Promise<{ ok: boolean; agregados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("importar_conductores", { p_nombres: nombres });
    if (error) return { ok: false, error: error.message };
    return { ok: true, agregados: (data ?? 0) as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function eliminarConductor(nombre: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_conductor", { p_nombre: nombre });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}
