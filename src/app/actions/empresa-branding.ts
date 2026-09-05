"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Personalización de la empresa ───────────────────────────────────────────
// Sólo el maestro puede cambiar el logo y el nombre visible de su empresa. La
// base vuelve a verificar el rol (actualizar_marca_empresa) y el path del
// archivo (policies de storage): que el botón esté oculto para los demás no es
// el control real.

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

const TAMANO_MAXIMO = 2 * 1024 * 1024; // 2 MB: es un logo, no una foto de alta res.
const TIPOS_PERMITIDOS = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function subirLogoEmpresa(formData: FormData): Promise<Res<string>> {
  try {
    const archivo = formData.get("logo") as File | null;
    if (!archivo || archivo.size === 0) return { ok: false, error: "Elegí un archivo" };
    if (archivo.size > TAMANO_MAXIMO) return { ok: false, error: "El archivo pesa más de 2 MB" };
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      return { ok: false, error: "Formato no admitido: usá PNG, JPG, WEBP o SVG" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles").select("rol, empresa_id").eq("id", user.id)
      .single<{ rol: string; empresa_id: string | null }>();
    if (perfil?.rol !== "maestro" || !perfil.empresa_id) {
      return { ok: false, error: "Sólo el usuario maestro puede cambiar el logo" };
    }

    // Un solo archivo por empresa: siempre el mismo nombre, así lo pisa en vez
    // de acumular versiones viejas sueltas en el bucket.
    const ext = archivo.name.split(".").pop() ?? "png";
    const ruta = `${perfil.empresa_id}/logo.${ext}`;

    const { error: errSubir } = await supabase.storage
      .from("logos-empresas")
      .upload(ruta, archivo, { upsert: true, contentType: archivo.type });
    if (errSubir) return { ok: false, error: errSubir.message };

    const { data: pub } = supabase.storage.from("logos-empresas").getPublicUrl(ruta);
    // Cache-bust: si alguien sube un logo nuevo con el mismo nombre de
    // archivo, el navegador no debe seguir mostrando el viejo desde caché.
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errGuardar } = await (supabase as any).rpc("actualizar_marca_empresa", {
      p_nombre: null, p_logo_url: url, // nombre en null: la función no lo toca
    });
    if (errGuardar) return { ok: false, error: errGuardar.message };

    revalidatePath("/", "layout");
    return { ok: true, data: url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function renombrarEmpresa(nombre: string): Promise<Res<null>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("actualizar_marca_empresa", {
      p_nombre: nombre, p_logo_url: null, // logo en null: la función no lo toca
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
