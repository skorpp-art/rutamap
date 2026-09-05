"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Alta de empresa por autoservicio (plan Free) ────────────────────────────
// Es la única vía de la app donde alguien que no es el superadmin puede crear
// una empresa. Existe para que probar RutaMap no dependa de que Lucas esté
// mirando /admin en ese momento: el plan Free se activa solo.

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

export async function crearEmpresaFree(nombre: string): Promise<Res<string>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("self_crear_empresa_free", {
      p_nombre: nombre,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
