"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface FilaOperacion {
  codigo: string;
  zona: string;
  tipo: string;
  sistema: number;
  x_fuera: number;
  total: number;
}

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

export interface PatronDiaSemana {
  dow: number;
  dia_nombre: string;
  registros: number;
  prom_total: number;
  prom_x_fuera: number;
}

export async function importarOperacionDiaria(
  fecha: string,
  turno: "tarde" | "preturno",
  filas: FilaOperacion[]
): Promise<{ ok: boolean; importados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("importar_operacion_diaria", {
      p_fecha: fecha,
      p_turno: turno,
      p_filas: filas,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true, importados: data as number };
  } catch (e) { return { ok: false, error: String(e) }; }
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

export async function getPatronDiaSemana(
  codigo: string
): Promise<{ ok: boolean; data?: PatronDiaSemana[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_patron_diasemana", { p_codigo: codigo });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as PatronDiaSemana[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface DashboardUnificado {
  fecha: string;
  dia_nombre: string;
  semana_mes: number;
  total_paquetes: number;
  total_clientes: number;
  rutas_activas: number;
  rutas_fijas: number;
  rutas_preturno: number;
  suma_total_ops: number;
  prom_por_ruta: number;
  pct_x_fuera: number;
  choferes_30: number;
  choferes_35: number;
  estado: string;
  tiene_clientes: boolean;
  tiene_ops: boolean;
}

export interface RutaAlerta {
  codigo: string;
  zona: string;
  dias_datos: number;
  prom_total: number;
  pct_sobre: number;
  max_total: number;
  recomendacion: string;
}

export async function eliminarDiaCompleto(
  fecha: string
): Promise<{ ok: boolean; clientes?: number; operaciones?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("eliminar_dia_completo", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true, clientes: data?.clientes ?? 0, operaciones: data?.operaciones ?? 0 };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getDashboardUnificado(
  dias = 30
): Promise<{ ok: boolean; data?: DashboardUnificado[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_dashboard_unificado", { p_dias: dias });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as DashboardUnificado[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getRutasAlerta(
  dias = 30, umbral = 40
): Promise<{ ok: boolean; data?: RutaAlerta[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_rutas_alerta", { p_dias: dias, p_umbral: umbral });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as RutaAlerta[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface HistorialDiaV2 {
  fecha: string;
  dia_semana: string;
  semana_mes: number;
  total_paquetes: number;
  total_clientes: number;
  rutas_activas: number;
  prom_por_ruta: number;
  rutas_en_alerta: number;
  pct_x_fuera: number;
  choferes_30: number;
  vs_semana_ant: number | null;
  tiene_ops: boolean;
}

export interface Recomendacion {
  codigo: string;
  nombre: string;
  zona: string;
  tipo: string;
  motivo: string;
  prioridad: "alta" | "media" | "baja";
  prom_hist: number;
  pct_sobre: number;
}

export async function getHistorialDiasV2(
  dias = 60
): Promise<{ ok: boolean; data?: HistorialDiaV2[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_historial_dias_v2", { p_dias: dias });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as HistorialDiaV2[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getDiaCompleto(fecha: string): Promise<{
  ok: boolean; data?: Record<string, unknown>; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_dia_completo", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as Record<string, unknown> };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getRecomendacionesOperacion(
  fecha: string, totalProyectado: number, rutasActivas: number
): Promise<{ ok: boolean; data?: Recomendacion[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_recomendaciones_operacion", {
      p_fecha: fecha, p_total_proyectado: totalProyectado, p_rutas_activas: rutasActivas,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as Recomendacion[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getHistorialRecorridoV2(
  codigo: string, dias = 60
): Promise<{ ok: boolean; data?: { fecha: string; turno: string; sistema: number; x_fuera: number; total: number }[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_historial_recorrido_v2", { p_codigo: codigo, p_dias: dias });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) { return { ok: false, error: String(e) }; }
}
