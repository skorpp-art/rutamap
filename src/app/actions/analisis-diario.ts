"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ResumenAnalisisDia {
  total_paquetes: number;
  entregados: number;
  pct_exito: number;
  post21_total: number;
  post21_entregados: number;
  post21_pct_exito: number;
  post21_pct_del_dia: number;
  en_camino_destinatario: number;
  en_camino_destinatario_pct: number;
}

export interface EstadoDia {
  estado: string;
  cantidad: number;
  pct: number;
}

export interface ClienteDia {
  cliente: string;
  cantidad: number;
  pct_del_dia: number;
  en_camino_destinatario: number;
  en_camino_destinatario_pct: number;
}

export interface TardeZonaOChofer {
  zona?: string;
  chofer?: string;
  cantidad: number;
  entregados: number;
  pct_efectividad: number;
}

/** Un paquete de la hoja "Detalle de Envíos Tarde" (todos son post-21hs). */
export interface TardeDetalleFila {
  id?: string;
  fecha?: string;
  tracking: string | null;
  hora: string | null;
  estado: string | null;
  zona: string | null;
  localidad: string | null;
  chofer: string | null;
  cliente: string | null;
  destinatario: string | null;
  direccion: string | null;
}

export interface AnalisisDiarioPayload {
  fecha: string;
  resumen: ResumenAnalisisDia;
  estados: EstadoDia[];
  clientes: ClienteDia[];
  tardeZona: TardeZonaOChofer[];
  tardeChofer: TardeZonaOChofer[];
  tardeDetalle: TardeDetalleFila[];
}

export async function guardarAnalisisDiario(
  payload: AnalisisDiarioPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("guardar_analisis_diario", {
      p_fecha: payload.fecha,
      p_resumen: payload.resumen,
      p_estados: payload.estados,
      p_clientes: payload.clientes,
      p_tarde_zona: payload.tardeZona,
      p_tarde_chofer: payload.tardeChofer,
      p_tarde_detalle: payload.tardeDetalle,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/analisis-diario");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getTardeDetalleDia(
  fecha: string
): Promise<{ ok: boolean; data?: TardeDetalleFila[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_tarde_detalle_dia", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as TardeDetalleFila[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getTardeDetallePeriodo(
  desde: string, hasta: string, cliente?: string | null
): Promise<{ ok: boolean; data?: TardeDetalleFila[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_tarde_detalle_periodo", {
      p_desde: desde, p_hasta: hasta, p_cliente: cliente ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as TardeDetalleFila[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getAnalisisDiario(
  fecha: string
): Promise<{ ok: boolean; data?: ResumenAnalisisDia & { fecha: string }; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_analisis_diario", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    const fila = (data ?? [])[0];
    return { ok: true, data: fila };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getAnalisisDiarioEstados(
  fecha: string
): Promise<{ ok: boolean; data?: EstadoDia[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_analisis_diario_estados", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as EstadoDia[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getAnalisisDiarioClientes(
  fecha: string
): Promise<{ ok: boolean; data?: ClienteDia[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_analisis_diario_clientes", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ClienteDia[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}



export interface HistoricoDia {
  fecha: string;
  total_paquetes: number;
  pct_exito: number;
  post21_total: number;
  post21_entregados: number;
  post21_pct_del_dia: number;
  post21_pct_exito: number;
  en_camino_destinatario: number;
  en_camino_destinatario_pct: number;
}

export async function getAnalisisDiarioHistorico(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: HistoricoDia[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_analisis_diario_historico", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as HistoricoDia[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface HistoricoCliente {
  fecha: string;
  cantidad: number;
  pct_del_dia: number;
  en_camino_destinatario: number;
  en_camino_destinatario_pct: number;
}

export async function getHistoricoCliente(
  cliente: string, desde: string, hasta: string
): Promise<{ ok: boolean; data?: HistoricoCliente[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_historico_cliente", { p_cliente: cliente, p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as HistoricoCliente[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface ClienteTotalPeriodo {
  cliente: string;
  total_paquetes: number;
  total_en_camino: number;
  pct_en_camino: number;
  dias_con_datos: number;
}

export async function getClientesTotalesPeriodo(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: ClienteTotalPeriodo[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_clientes_totales_periodo", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ClienteTotalPeriodo[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getClientesAnalisisDiario(): Promise<{ ok: boolean; data?: string[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_clientes_analisis_diario");
    if (error) return { ok: false, error: error.message };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ok: true, data: (data ?? []).map((r: any) => r.cliente) };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── KPIs estilo "ML/Flex" calculados con datos propios (zonas y estados) ────
export interface ZonaTotalPeriodo {
  zona: string;
  cantidad: number;
  entregados: number;
  pct_efectividad: number;
  pct_del_total: number;
}

export async function getZonasTotalesPeriodo(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: ZonaTotalPeriodo[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_zonas_totales_periodo", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ZonaTotalPeriodo[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface ChoferTotalPeriodo {
  chofer: string;
  cantidad: number;
  entregados: number;
  pct_efectividad: number;
  dias_con_tardanzas: number;
}

export async function getChoferesTotalesPeriodo(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: ChoferTotalPeriodo[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_choferes_totales_periodo", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ChoferTotalPeriodo[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface EstadoTotalPeriodo {
  estado: string;
  cantidad: number;
  pct: number;
}

export async function getEstadosTotalesPeriodo(
  desde: string, hasta: string
): Promise<{ ok: boolean; data?: EstadoTotalPeriodo[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_estados_totales_periodo", { p_desde: desde, p_hasta: hasta });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as EstadoTotalPeriodo[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}
