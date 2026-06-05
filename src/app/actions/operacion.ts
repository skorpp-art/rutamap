"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface OperacionRuta {
  op_id: string;
  recorrido_id: string;
  codigo: string;
  nombre: string;
  zona: string;
  tipo: string;
  activo: boolean;
  notas_dia: string | null;
  paquetes_asignados: number;
}

export interface ResumenOperacion {
  total_rutas_activas: number;
  rutas_fijas: number;
  rutas_preturno: number;
  rutas_corte: number;
  paquetes_total: number;
  promedio_pkg_ruta: number;
  choferes_25: number;
  choferes_30: number;
  choferes_35: number;
  estado: string;
}

// Inicializar operación del día (agrega todas las rutas activas si no existen)
export async function inicializarOperacionDia(
  fecha: string
): Promise<{ ok: boolean; insertados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("inicializar_operacion_dia", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, insertados: data as number };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Obtener operación del día
export async function getOperacionDia(
  fecha: string
): Promise<{ ok: boolean; data?: OperacionRuta[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_operacion_dia", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as OperacionRuta[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Activar/desactivar una ruta + notas + paquetes
export async function upsertOperacionRuta(
  fecha: string,
  recorridoId: string,
  activo: boolean,
  notas?: string,
  paquetes?: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_operacion_ruta", {
      p_fecha: fecha,
      p_recorrido_id: recorridoId,
      p_activo: activo,
      p_notas: notas ?? null,
      p_paquetes: paquetes ?? 0,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Bulk: guardar toda la operación del día de una vez
export async function guardarOperacionBulk(
  fecha: string,
  rutas: { recorrido_id: string; activo: boolean; notas_dia: string | null; paquetes_asignados: number }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const resultados = await Promise.all(
      rutas.map((r) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc("upsert_operacion_ruta", {
          p_fecha: fecha,
          p_recorrido_id: r.recorrido_id,
          p_activo: r.activo,
          p_notas: r.notas_dia,
          p_paquetes: r.paquetes_asignados,
        })
      )
    );
    const err = resultados.find((r) => r.error);
    if (err) return { ok: false, error: err.error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Resumen para el cálculo en tiempo real
export async function getResumenOperacion(
  fecha: string,
  totalPaquetes: number
): Promise<{ ok: boolean; data?: ResumenOperacion; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_resumen_operacion", {
      p_fecha: fecha,
      p_total_paquetes: totalPaquetes,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data as ResumenOperacion[])?.[0] };
  } catch (e) { return { ok: false, error: String(e) }; }
}
