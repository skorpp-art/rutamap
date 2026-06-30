"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface VolumenFila {
  recorrido_id: string;
  codigo: string;
  nombre: string;
  zona: string;
  activo: boolean;
  volumen: number;
}

// Obtener volúmenes de una fecha
export async function getVolumenesFecha(
  fecha: string // YYYY-MM-DD
): Promise<{ ok: boolean; data?: VolumenFila[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_volumenes_fecha", {
      p_fecha: fecha,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as VolumenFila[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Guardar volumen de un recorrido para una fecha
export async function upsertVolumen(
  recorridoId: string,
  fecha: string,
  volumen: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_volumen_diario", {
      p_recorrido_id: recorridoId,
      p_fecha: fecha,
      p_volumen: volumen,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Guardar múltiples volúmenes a la vez
export async function upsertVolumenesBulk(
  filas: { recorrido_id: string; volumen: number }[],
  fecha: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // Ejecutar todas las operaciones en paralelo
    const resultados = await Promise.all(
      filas.map((f) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc("upsert_volumen_diario", {
          p_recorrido_id: f.recorrido_id,
          p_fecha: fecha,
          p_volumen: f.volumen,
        })
      )
    );
    const err = resultados.find((r) => r.error);
    if (err) return { ok: false, error: err.error.message };
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function importarVolumenesExcel(
  fecha: string,
  filas: { codigo: string; volumen: number }[]
): Promise<{ ok: boolean; resultados?: { codigo: string; ok: boolean; mensaje: string }[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("importar_volumenes_excel", {
      p_fecha: fecha,
      p_filas: JSON.stringify(filas),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true, resultados: data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Clientes diarios (desde Excel real) ────────────────────────────────────
export interface ClienteDia {
  cliente: string;
  paquetes: number;
  pct?: number;
}

export interface DashboardDiaV2 {
  dia_semana: number;
  dia_nombre: string;
  fecha_actual: string;
  fecha_anterior: string;
  total_actual: number;
  total_anterior: number;
  promedio_hist: number;
  total_clientes: number;
}

export interface ResumenSemanalV2 {
  hoy_total: number;
  hoy_fecha: string;
  hoy_clientes: number;
  semana_total: number;
  semana_dias: number;
  semana_prom_dia: number;
  anterior_total: number;
  vs_anterior_pct: number;
}

export async function importarClientesExcel(
  fecha: string,
  filas: { cliente: string; paquetes: number }[]
): Promise<{ ok: boolean; importados?: number; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("importar_clientes_excel", {
      p_fecha: fecha,
      p_filas: filas, // pasar array directamente, no JSON.stringify
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true, importados: data as number };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Clientes manuales (cliente grande que no figura en el Excel) ───────────
export interface ClienteManual {
  id: string;
  cliente: string;
  paquetes: number;
}

export async function upsertClienteManual(
  fecha: string, cliente: string, paquetes: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_cliente_manual", {
      p_fecha: fecha, p_cliente: cliente, p_paquetes: paquetes,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getClientesManuales(
  fecha: string
): Promise<{ ok: boolean; data?: ClienteManual[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_clientes_manuales", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as ClienteManual[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function eliminarClienteManual(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_cliente_manual", { p_id: id });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getDashboardSemanalV2(): Promise<{
  ok: boolean; data?: DashboardDiaV2[]; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_dashboard_semanal_v2");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as DashboardDiaV2[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getResumenSemanalV2(): Promise<{
  ok: boolean; data?: ResumenSemanalV2; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_resumen_semanal_v2");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data as ResumenSemanalV2[])?.[0] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface BandaControl {
  fecha: string;
  dia_semana: string;
  semana_mes: number;
  tipo_semana: string;
  total_paquetes: number;
  promedio_ruta: number;
  pct_vs_target: number;
  zona_riesgo: string;
}

export async function getBandasControl(
  dias = 30, target = 30, rutas = 55
): Promise<{ ok: boolean; data?: BandaControl[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_bandas_control", {
      p_dias: dias, p_target: target, p_rutas: rutas,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as BandaControl[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface ProyeccionDia {
  dia_nombre: string;
  dow: number;
  esperado: number;
  minimo: number;
  maximo: number;
  std_dev: number;
  registros: number;
  confianza: "alta" | "media" | "baja";
  zona_norte: number;
  zona_sur: number;
  zona_oeste: number;
  zona_caba: number;
}

export interface ProyeccionDiaV2 extends ProyeccionDia {
  semana_mes: number;
  tipo_semana: string;
  factor_semana: number;
  esperado_base: number;
  esperado_ajust: number;
  choferes_min: number;
  choferes_esp: number;
  choferes_max: number;
  zona_riesgo: string;
}

export async function getProyeccionDiaV2(
  fecha: string, target = 30, rutas = 55
): Promise<{ ok: boolean; data?: ProyeccionDiaV2; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_proyeccion_dia_v2", {
      p_fecha: fecha, p_target: target, p_rutas: rutas,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data as ProyeccionDiaV2[])?.[0] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface HistorialDiaDetalle {
  fecha: string;
  dia_nombre: string;
  semana_mes: number;
  tipo_semana: string;
  total_paquetes: number;
  total_clientes: number;
  promedio_ruta: number;
  choferes_30: number;
  choferes_35: number;
  pct_vs_semana_ant: number | null;
}

export interface CalidadDatos {
  dow: number;
  dia_nombre: string;
  registros: number;
  confianza: string;
  pct_confianza: number;
  ultimo_dato: string | null;
}

export async function getHistorialDias(
  dias = 90
): Promise<{ ok: boolean; data?: HistorialDiaDetalle[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_historial_dias", { p_dias: dias });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as HistorialDiaDetalle[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getCalidadDatos(): Promise<{
  ok: boolean; data?: CalidadDatos[]; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_calidad_datos");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as CalidadDatos[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface RecorridoBaseItem {
  id: string;
  codigo: string;
  nombre: string;
  zona: string;
  tipo: string;
  activo: boolean;
  color: string;
}

export async function getRecorridosBase(): Promise<{
  ok: boolean; data?: RecorridoBaseItem[]; error?: string;
}> {
  try {
    const supabase = await createClient();
    // Usamos RPC con SECURITY DEFINER para evitar problemas de RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_recorridos_base");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as RecorridoBaseItem[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getTopClientes(
  fecha: string, limit = 10
): Promise<{ ok: boolean; data?: ClienteDia[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_top_clientes", {
      p_fecha: fecha, p_limit: limit,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as ClienteDia[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Plantillas semanales (bloques pre-definidos por semana del mes × día) ─────
export interface PlantillaCelda {
  semana_mes: number;
  dia_semana: number;
  dia_nombre: string;
  tipo_semana: string;
  factor_semana: number | null;
  paquetes_base: number;
  rutas_sugeridas: number | null;
  notas: string | null;
  prom_historico: number;
  registros: number;
}

export async function getPlantillasSemanales(): Promise<{
  ok: boolean; data?: PlantillaCelda[]; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_plantillas_semanales");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as PlantillaCelda[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function upsertPlantillaSemanal(
  semana: number, dia: number, paquetes: number,
  rutas: number | null = null, notas: string | null = null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_plantilla_semanal", {
      p_semana: semana, p_dia: dia, p_paquetes: paquetes,
      p_rutas: rutas, p_notas: notas,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function upsertFactorSemana(
  semana: number, factor: number | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_factor_semana", {
      p_semana: semana, p_factor: factor,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function seedPlantillasDesdeHistorico(): Promise<{
  ok: boolean; celdas?: number; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("seed_plantillas_desde_historico");
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true, celdas: data as number };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Calor de volumen por recorrido (mapa privado) ─────────────────────────────
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

// ─── Feriados ────────────────────────────────────────────────────────────────
export interface Feriado {
  fecha: string;
  descripcion: string | null;
}

export async function getFeriados(desde?: string, hasta?: string): Promise<{
  ok: boolean; data?: Feriado[]; error?: string;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_feriados", {
      p_desde: desde ?? undefined, p_hasta: hasta ?? undefined,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as Feriado[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function marcarFeriado(fecha: string, descripcion?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("marcar_feriado", { p_fecha: fecha, p_descripcion: descripcion ?? null });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function eliminarFeriado(fecha: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("eliminar_feriado", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/volumenes");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}
