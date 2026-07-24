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

export type TipoDiaPlantilla = "lun_feriado" | "mar_vie" | "sabado";

// Aplica el "piso" de recorridos de un tipo de día a la fecha: activa los que
// están en la plantilla y desactiva el resto (preserva paquetes y notas).
export async function aplicarPlantillaOperacion(
  fecha: string, tipoDia: TipoDiaPlantilla
): Promise<{ ok: boolean; afectados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("aplicar_plantilla_operacion", {
      p_fecha: fecha, p_tipo_dia: tipoDia,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true, afectados: data as number };
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

// Bulk: guardar toda la operación del día en una sola RPC transaccional
// (antes eran ~55 llamadas individuales que podían quedar a medias)
export async function guardarOperacionBulk(
  fecha: string,
  rutas: { recorrido_id: string; activo: boolean; notas_dia: string | null; paquetes_asignados: number }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_operacion_bulk", {
      p_fecha: fecha,
      p_rutas: rutas,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// Total de paquetes importados de clientes para una fecha
export async function getTotalPaquetesFecha(
  fecha: string
): Promise<{ ok: boolean; total?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clientes_diarios")
      .select("paquetes")
      .eq("fecha", fecha);
    if (error) return { ok: false, error: error.message };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = (data ?? []).reduce((s: number, r: any) => s + (r.paquetes ?? 0), 0);
    return { ok: true, total };
  } catch (e) { return { ok: false, error: String(e) }; }
}


export interface SugerenciaRuta {
  recorrido_id: string;
  codigo: string;
  nombre: string;
  zona: string;
  tipo: string;
  veces_activo: number;
  total_dias_dow: number;
  freq_pct: number;
  sugerido: boolean;
}

// Pre-armado del día: sugiere qué recorridos activar según su frecuencia
// histórica en el mismo día de la semana (los fijos siempre).
export async function getSugerenciaOperacion(
  fecha: string, umbral = 0.5
): Promise<{ ok: boolean; data?: SugerenciaRuta[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("sugerir_operacion_dia", {
      p_fecha: fecha, p_dias: 90, p_umbral: umbral,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as SugerenciaRuta[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}
