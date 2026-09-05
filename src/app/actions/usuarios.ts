"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Rol } from "@/lib/roles";

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  rol: Rol;
  email: string;
  creado_en: string;
  ultimo_login: string | null;
  // null = sin restricción (ve todas las solapas / edición según rol)
  solapas: string[] | null;
  puede_editar: boolean | null;
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

// Asigna solapas visibles y flag de edición (solo maestro). null = sin restricción.
export async function setPermisosUsuario(
  id: string, solapas: string[] | null, puedeEditar: boolean | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_set_permisos", {
      p_id: id, p_solapas: solapas, p_puede_editar: puedeEditar,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/usuarios");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// El maestro establece una contraseña nueva para cualquier cuenta. No existe
// forma de "ver" la contraseña actual (Supabase la guarda hasheada, es
// irreversible por diseño) — esto es un reseteo, no una consulta.
export async function setPasswordUsuario(
  id: string, nuevaPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };
    const { data: perfil } = await supabase
      .from("perfiles").select("rol").eq("id", user.id).single<{ rol: string }>();
    if (perfil?.rol !== "maestro") return { ok: false, error: "Solo el usuario maestro puede cambiar contraseñas" };

    const admin = createAdmin();
    if (!admin) {
      return { ok: false, error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor. Ver instrucciones." };
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password: nuevaPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// El maestro crea una cuenta directamente (sin auto-registro ni confirmación de
// email). Evita el rechazo de dominios de email del registro público.
//
// Con multi-tenant, el trigger que arma el perfil al crear la cuenta la deja
// SIN empresa y en estado "pendiente" (es el mismo trigger que usa el alta
// pública, que sí tiene que quedar pendiente de que el superadmin la revise).
// Acá la situación es distinta: quien crea la cuenta ya es maestro de una
// empresa real, así que el alta queda activada de una en esa misma empresa,
// sin pasar por el superadmin.
export async function crearUsuario(
  nombre: string, email: string, password: string, rol: Rol,
  solapas: string[] | null = null, puedeEditar: boolean | null = null
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1) Verificar que quien llama es maestro, y de qué empresa
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };
    const { data: perfil } = await supabase
      .from("perfiles").select("rol, empresa_id").eq("id", user.id)
      .single<{ rol: string; empresa_id: string | null }>();
    if (perfil?.rol !== "maestro") return { ok: false, error: "Solo el usuario maestro puede crear cuentas" };
    if (!perfil.empresa_id) return { ok: false, error: "Tu cuenta no tiene una empresa asignada" };

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

    // 3) Asignarla a la misma empresa que el maestro, ya activa, con el rol y
    // los permisos elegidos (el trigger la creó pendiente y sin empresa).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errRol } = await (admin as any)
      .from("perfiles")
      .update({ rol, solapas, puede_editar: puedeEditar, empresa_id: perfil.empresa_id, estado: "activo" })
      .eq("id", creado.user.id);
    if (errRol) return { ok: false, error: `Cuenta creada, pero no se pudo asignar el rol: ${errRol.message}` };

    revalidatePath("/usuarios");
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}
