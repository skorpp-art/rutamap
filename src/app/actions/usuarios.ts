"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const ROLES = ["maestro", "gerencia", "supervisor", "coordinador", "asesor"] as const;
export type Rol = (typeof ROLES)[number];

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  rol: Rol;
  email: string;
  creado_en: string;
  ultimo_login: string | null;
}

export async function getUsuarios(): Promise<{ ok: boolean; data?: UsuarioAdmin[]; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_usuarios");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as UsuarioAdmin[] };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function setRolUsuario(
  id: string, rol: Rol
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_set_rol", { p_id: id, p_rol: rol });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/usuarios");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}
