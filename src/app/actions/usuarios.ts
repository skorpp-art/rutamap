"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
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

// El maestro crea una cuenta directamente (sin auto-registro ni confirmación de
// email). Evita el rechazo de dominios de email del registro público.
export async function crearUsuario(
  nombre: string, email: string, password: string, rol: Rol
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1) Verificar que quien llama es maestro
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };
    const { data: perfil } = await supabase
      .from("perfiles").select("rol").eq("id", user.id).single<{ rol: string }>();
    if (perfil?.rol !== "maestro") return { ok: false, error: "Solo el usuario maestro puede crear cuentas" };

    // 2) Crear la cuenta con la Admin API (service_role)
    const admin = createAdmin();
    if (!admin) {
      return { ok: false, error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor. Ver instrucciones." };
    }
    const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // sin mail de confirmación: queda lista para usar
      user_metadata: { nombre: nombre.trim() },
    });
    if (errCrear || !creado?.user) {
      const m = errCrear?.message ?? "Error desconocido";
      return { ok: false, error: m.includes("already") ? "Ya existe una cuenta con ese email" : m };
    }

    // 3) Asignar el rol elegido (el trigger la creó como 'asesor')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errRol } = await (admin as any)
      .from("perfiles").update({ rol }).eq("id", creado.user.id);
    if (errRol) return { ok: false, error: `Cuenta creada, pero no se pudo asignar el rol: ${errRol.message}` };

    revalidatePath("/usuarios");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}
