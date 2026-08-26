"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Casos logísticos ────────────────────────────────────────────────────────
// Reemplaza el Excel que compartían Asesoría Comercial y Coordinación. La
// escritura siempre pasa por funciones de la base (crear_caso,
// cambiar_estado_caso, agregar_evento_caso): son las que dejan el evento en la
// línea de tiempo y avisan al área que queda con la pelota. Desde acá nunca se
// hace un update directo sobre la tabla.

export type EstadoCaso =
  | "abierto" | "en_gestion" | "reintento" | "entrega_imposible"
  | "pendiente_cliente" | "entregado" | "cancelado";

export type AreaCaso = "asesoria" | "coordinacion";

export interface Caso {
  id: string;
  numero: string;
  tracking: string | null;
  cliente: string;
  direccion: string | null;
  tipo_incidencia: string;
  observaciones: string | null;
  ejecutivo: string | null;
  area_origen: AreaCaso;
  estado: EstadoCaso;
  /** Columna calculada en la base: de qué lado está la pelota. */
  area_responsable: AreaCaso | "cerrado";
  created_by: string | null;
  created_at: string;
  actualizado_en: string;
  cerrado_en: string | null;
}

export interface EventoCaso {
  id: string;
  caso_id: string;
  tipo_evento: "apertura" | "plan_accion" | "cambio_estado" | "observacion" | "reintento";
  contenido: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  /** Nombre de quien lo hizo, resuelto acá para no pedir perfiles en el cliente. */
  autor: string | null;
}

export interface Notificacion {
  id: string;
  caso_id: string;
  tipo: string;
  titulo: string;
  leida: boolean;
  created_at: string;
  numero: string | null;
}

export interface CasoSimilar {
  id: string;
  numero: string;
  tracking: string | null;
  cliente: string;
  direccion: string | null;
  estado: EstadoCaso;
  created_at: string;
  /** Por qué se parece: "tracking", "cliente + dirección", etc. */
  motivo: string;
}

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

/** Nombre de cada usuario, para mostrar autoría en la línea de tiempo. */
async function nombresPorId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, ids: (string | null)[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => !!i))];
  if (!unicos.length) return new Map();
  const { data } = await supabase.from("perfiles").select("id, nombre").in("id", unicos);
  return new Map((data ?? []).map((p: { id: string; nombre: string }) => [p.id, p.nombre]));
}

/** Área del usuario en sesión: define qué es "en mi cancha". */
export async function getAreaUsuario(): Promise<Res<{ area: string; puedeGestionar: boolean }>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: area }, { data: puede }] = await Promise.all([
      sb.rpc("area_usuario"),
      sb.rpc("puede_gestionar_casos"),
    ]);
    return { ok: true, data: { area: (area as string) ?? "ambas", puedeGestionar: !!puede } };
  } catch (e) { return fallo(e); }
}

/**
 * Casos de los últimos `dias`, más todos los que siguen vivos aunque sean más
 * viejos: un caso abierto hace tres meses no puede desaparecer de la lista.
 */
export async function getCasos(dias = 30): Promise<Res<Caso[]>> {
  try {
    const supabase = await createClient();
    const desde = new Date(Date.now() - dias * 86400_000).toISOString();
    const { data, error } = await supabase
      .from("casos")
      .select("*")
      .or(`created_at.gte.${desde},estado.not.in.(entregado,cancelado)`)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as unknown as Caso[] };
  } catch (e) { return fallo(e); }
}

export async function getCaso(id: string): Promise<Res<{ caso: Caso; eventos: EventoCaso[] }>> {
  try {
    const supabase = await createClient();
    const [{ data: caso, error: e1 }, { data: eventos, error: e2 }] = await Promise.all([
      supabase.from("casos").select("*").eq("id", id).single(),
      supabase.from("eventos_caso").select("*").eq("caso_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (e1) return { ok: false, error: e1.message };
    if (e2) return { ok: false, error: e2.message };

    const evs = (eventos ?? []) as unknown as EventoCaso[];
    const nombres = await nombresPorId(supabase, evs.map(e => e.created_by));
    return {
      ok: true,
      data: {
        caso: caso as unknown as Caso,
        eventos: evs.map(e => ({ ...e, autor: e.created_by ? nombres.get(e.created_by) ?? null : null })),
      },
    };
  } catch (e) { return fallo(e); }
}

/**
 * Casos parecidos al que se está por cargar. Sirve para no abrir dos veces el
 * mismo problema cuando el paquete no tiene número de seguimiento.
 */
export async function buscarSimilares(
  tracking: string, cliente: string, direccion: string,
): Promise<Res<CasoSimilar[]>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("casos_similares", {
      p_tracking: tracking || null, p_cliente: cliente || null, p_direccion: direccion || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as CasoSimilar[] };
  } catch (e) { return fallo(e); }
}

export interface NuevoCaso {
  cliente: string;
  tipoIncidencia: string;
  tracking: string;
  direccion: string;
  observaciones: string;
  ejecutivo: string;
}

/**
 * Alta de caso. Si el tracking ya tiene un caso vivo, la base no crea nada y
 * devuelve `duplicado: true` con el caso existente.
 */
export async function crearCaso(
  c: NuevoCaso,
): Promise<Res<{ duplicado: boolean; caso: { id: string; numero: string; cliente?: string; estado?: string; created_at?: string } }>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("crear_caso", {
      p_cliente: c.cliente, p_tipo_incidencia: c.tipoIncidencia,
      p_tracking: c.tracking || null, p_direccion: c.direccion || null,
      p_observaciones: c.observaciones || null, p_ejecutivo: c.ejecutivo || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) { return fallo(e); }
}

export async function cambiarEstado(
  casoId: string, estado: EstadoCaso, comentario: string,
): Promise<Res<null>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("cambiar_estado_caso", {
      p_caso: casoId, p_estado: estado, p_comentario: comentario || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}

export async function agregarEvento(
  casoId: string, tipo: "plan_accion" | "observacion" | "reintento", texto: string,
): Promise<Res<null>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("agregar_evento_caso", {
      p_caso: casoId, p_tipo: tipo, p_texto: texto,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}

// ─── Notificaciones ──────────────────────────────────────────────────────────

export async function getNotificaciones(): Promise<Res<Notificacion[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .select("id, caso_id, tipo, titulo, leida, created_at, casos(numero)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: error.message };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filas = (data ?? []) as any[];
    return {
      ok: true,
      data: filas.map(f => ({
        id: f.id, caso_id: f.caso_id, tipo: f.tipo, titulo: f.titulo,
        leida: f.leida, created_at: f.created_at,
        numero: f.casos?.numero ?? null,
      })),
    };
  } catch (e) { return fallo(e); }
}

/** Marca una notificación (o todas, si no se pasa id) como leída. */
export async function marcarLeidas(id?: string): Promise<Res<null>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sin sesión" };
    // Las tablas de casos no están en los tipos generados todavía.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any).from("notificaciones")
      .update({ leida: true })
      .eq("destino_id", user.id).eq("leida", false);
    if (id) q = q.eq("id", id);
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}
