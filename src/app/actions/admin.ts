"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Administración del SaaS ─────────────────────────────────────────────────
// Sólo para el superadmin. Todas estas acciones pasan por funciones de la base
// que vuelven a verificar es_superadmin(): que la pantalla esté escondida no es
// un permiso, es sólo comodidad.

export interface EmpresaAdmin {
  id: string;
  nombre: string;
  slug: string;
  plan: "bronce" | "plata" | "oro";
  modulos: string[];
  activa: boolean;
  creada_en: string;
  usuarios: number;
  usuarios_activos: number;
}

export interface RegistroAdmin {
  id: string;
  nombre: string;
  email: string;
  estado: "pendiente" | "activo" | "rechazado";
  creado_en: string;
  empresa_id: string | null;
  empresa_nombre: string | null;
}

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sb(): Promise<any> {
  return await createClient();
}

export async function getEmpresas(): Promise<Res<EmpresaAdmin[]>> {
  try {
    const { data, error } = await (await sb()).rpc("admin_empresas");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as EmpresaAdmin[] };
  } catch (e) { return fallo(e); }
}

export async function getRegistros(estado: string | null = "pendiente"): Promise<Res<RegistroAdmin[]>> {
  try {
    const { data, error } = await (await sb()).rpc("admin_registros", { p_estado: estado });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as RegistroAdmin[] };
  } catch (e) { return fallo(e); }
}

export async function crearEmpresa(
  nombre: string, slug: string, plan: string, modulos: string[],
): Promise<Res<string>> {
  try {
    const { data, error } = await (await sb()).rpc("admin_crear_empresa", {
      p_nombre: nombre, p_slug: slug, p_plan: plan, p_modulos: modulos,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true, data: data as string };
  } catch (e) { return fallo(e); }
}

export async function actualizarEmpresa(
  id: string, nombre: string, plan: string, modulos: string[], activa: boolean,
): Promise<Res<null>> {
  try {
    const { error } = await (await sb()).rpc("admin_actualizar_empresa", {
      p_id: id, p_nombre: nombre, p_plan: plan, p_modulos: modulos, p_activa: activa,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}

export async function habilitarUsuario(
  perfilId: string, empresaId: string, rol = "maestro",
): Promise<Res<null>> {
  try {
    const { error } = await (await sb()).rpc("admin_habilitar_usuario", {
      p_perfil: perfilId, p_empresa: empresaId, p_rol: rol,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}

export async function rechazarUsuario(perfilId: string): Promise<Res<null>> {
  try {
    const { error } = await (await sb()).rpc("admin_rechazar_usuario", { p_perfil: perfilId });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch (e) { return fallo(e); }
}
