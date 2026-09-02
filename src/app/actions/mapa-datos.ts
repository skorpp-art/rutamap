"use server";

import { createClient } from "@/lib/supabase/server";

// Datos que el Mapa necesita de la operación diaria, sin traer de vuelta todo
// el módulo de Planificación/Resultados (que sigue eliminado): son dos RPC
// autocontenidas, recuperadas puntuales desde src/app/actions/volumenes.ts y
// operaciones-diarias.ts tal como estaban antes de sacar esas secciones.

// ─── Calor de volumen por recorrido ─────────────────────────────────────────
export interface CalorRecorrido {
  recorrido_id: string;
  codigo: string;
  prom_paquetes: number;
  dias: number;
  max_paquetes: number;
  ultimo_paquetes: number;
}

export async function getCalorRecorridos(dias = 30): Promise<{
  ok: boolean; data?: CalorRecorrido[]; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_calor_recorridos", { p_dias: dias });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as CalorRecorrido[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Rendimiento histórico de un recorrido ──────────────────────────────────
export interface AnalisisRecorrido {
  codigo: string;
  zona: string;
  tipo: string;
  dias_registrados: number;
  prom_total: number;
  prom_sistema: number;
  prom_x_fuera: number;
  max_total: number;
  min_total: number;
  pct_sobrecarga: number;
  pct_bajo: number;
  tendencia: "subiendo" | "bajando" | "estable";
}

export async function getAnalisisRecorridos(
  dias = 30
): Promise<{ ok: boolean; data?: AnalisisRecorrido[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_analisis_recorridos", { p_dias: dias });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as AnalisisRecorrido[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}
