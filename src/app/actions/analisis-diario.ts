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

export interface AnalisisDiarioPayload {
  fecha: string;
  resumen: ResumenAnalisisDia;
  estados: EstadoDia[];
  clientes: ClienteDia[];
  tardeZona: TardeZonaOChofer[];
  tardeChofer: TardeZonaOChofer[];
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
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/analisis-diario");
    return { ok: true };
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

export interface TardeFila {
  tipo: "zona" | "chofer";
  nombre: string;
  cantidad: number;
  entregados: number;
  pct_efectividad: number;
}

export async function getAnalisisDiarioTarde(
  fecha: string
): Promise<{ ok: boolean; data?: TardeFila[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_analisis_diario_tarde", { p_fecha: fecha });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as TardeFila[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export interface HistoricoDia {
  fecha: string;
  total_paquetes: number;
  pct_exito: number;
  post21_total: number;
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

// ── Informe mensual de Mercado Libre / Flex ─────────────────────────────────
export interface BatallaFlex { motivo: string; pct: number; exceso_pct: number | null }
export interface MotivoFallido { motivo: string; pct: number; exceso_pct: number | null }
export interface SellerBajoSameday { seller_id: string; nombre: string; envios_total: number; envios_sd: number; share_sd: number }
export interface OportunidadGeografica { ciudad: string; envios: number; sla: number; sla_carrier: number; delta: number; post21_pct: number }
export interface SellerOportunidad { seller_id: string; nombre: string; envios: number; sla: number }

export interface InformeMlPayload {
  periodo: string; // YYYY-MM-01
  volumenTotal: number;
  sla: { pct: number; promedio: number | null; delta: number | null };
  visitas21: { pct: number; promedio: number | null; delta: number | null };
  sameday: { pct: number; promedio: number | null; delta: number | null };
  perfectDelivery: { pct: number; promedio: number | null; delta: number | null };
  batallas: BatallaFlex[];
  motivosFallidos: MotivoFallido[];
  sellersBajoSameday: SellerBajoSameday[];
  oportunidadesGeograficas: OportunidadGeografica[];
  sellersOportunidad: SellerOportunidad[];
  sellersOptimos: SellerOportunidad[];
  sellersOportunidadSabado: { seller_id: string; nombre: string; envios_total: number; envios_sab: number; share_sab: number }[];
  sellersOportunidadCapacidad: { seller_id: string; nombre: string; envios_total: number; upside_pct: number }[];
}

export interface InformeMlRow {
  periodo: string;
  volumen_total: number;
  sla_pct: number | null; sla_promedio: number | null; sla_delta: number | null;
  visitas21_pct: number | null; visitas21_promedio: number | null; visitas21_delta: number | null;
  sameday_pct: number | null; sameday_promedio: number | null; sameday_delta: number | null;
  perfect_delivery_pct: number | null; perfect_delivery_promedio: number | null; perfect_delivery_delta: number | null;
  batallas: BatallaFlex[];
  motivos_fallidos: MotivoFallido[];
  sellers_bajo_sameday: SellerBajoSameday[];
  oportunidades_geograficas: OportunidadGeografica[];
  sellers_oportunidad: SellerOportunidad[];
  sellers_optimos: SellerOportunidad[];
  sellers_oportunidad_sabado: { seller_id: string; nombre: string; envios_total: number; envios_sab: number; share_sab: number }[];
  sellers_oportunidad_capacidad: { seller_id: string; nombre: string; envios_total: number; upside_pct: number }[];
}

export async function guardarInformeMl(p: InformeMlPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("guardar_informe_ml", {
      p_periodo: p.periodo,
      p_volumen_total: p.volumenTotal,
      p_sla_pct: p.sla.pct, p_sla_promedio: p.sla.promedio, p_sla_delta: p.sla.delta,
      p_visitas21_pct: p.visitas21.pct, p_visitas21_promedio: p.visitas21.promedio, p_visitas21_delta: p.visitas21.delta,
      p_sameday_pct: p.sameday.pct, p_sameday_promedio: p.sameday.promedio, p_sameday_delta: p.sameday.delta,
      p_perfect_pct: p.perfectDelivery.pct, p_perfect_promedio: p.perfectDelivery.promedio, p_perfect_delta: p.perfectDelivery.delta,
      p_batallas: p.batallas, p_motivos: p.motivosFallidos, p_sellers_bajo: p.sellersBajoSameday,
      p_geografia: p.oportunidadesGeograficas, p_sellers_oportunidad: p.sellersOportunidad, p_sellers_optimos: p.sellersOptimos,
      p_sellers_sabado: p.sellersOportunidadSabado, p_sellers_capacidad: p.sellersOportunidadCapacidad,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/analisis-diario");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getInformeMl(periodo: string): Promise<{ ok: boolean; data?: InformeMlRow | null; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_informe_ml", { p_periodo: periodo });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? [])[0] ?? null };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function getPeriodosMl(): Promise<{ ok: boolean; data?: { periodo: string; volumen_total: number }[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_periodos_ml");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  } catch (e) { return { ok: false, error: String(e) }; }
}
