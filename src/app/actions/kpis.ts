"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface KpiDia {
  fecha: string;
  dia_nombre: string;
  carga_playon_min: number | null;
  pct_en_termino: number | null;
  total_despachado: number | null;
  devoluciones: number | null;
  pct_devoluciones: number | null;
  incidencias: number | null;
  notas: string | null;
}

export interface KpiForm {
  fecha: string;
  carga_playon_min: number | null;
  pct_en_termino: number | null;
  total_despachado: number | null;
  devoluciones: number | null;
  incidencias: number | null;
  notas: string | null;
}

export async function getKpisDiarios(dias = 30): Promise<{
  ok: boolean; data?: KpiDia[]; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_kpis_diarios", { p_dias: dias });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as KpiDia[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getKpiDia(fecha: string): Promise<{
  ok: boolean; data?: KpiForm | null; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_kpi_dia", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: ((data as KpiForm[]) ?? [])[0] ?? null };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function upsertKpiDiario(k: KpiForm): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_kpi_diario", {
      p_fecha: k.fecha,
      p_carga: k.carga_playon_min,
      p_pct_termino: k.pct_en_termino,
      p_total: k.total_despachado,
      p_devoluciones: k.devoluciones,
      p_incidencias: k.incidencias,
      p_notas: k.notas,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}
