import { createClient } from "@/lib/supabase/server";

// ─── Quién está usando la app ────────────────────────────────────────────────
// Antes cada pantalla repetía la misma consulta a perfiles. Con el SaaS eso
// dejó de alcanzar: para saber qué puede ver alguien hay que mirar también su
// empresa (si está activa y qué módulos tiene contratados). Como esa decisión
// no puede quedar distinta en cada pantalla, vive acá y en tieneSolapa().

export type EstadoPerfil = "pendiente" | "activo" | "rechazado";
export type PlanEmpresa = "free" | "bronce" | "plata" | "oro";

export interface EmpresaActual {
  id: string;
  nombre: string;
  slug: string;
  plan: PlanEmpresa;
  /** Módulos habilitados. Es la verdad efectiva; el plan es sólo la plantilla. */
  modulos: string[];
  activa: boolean;
  /** null = sin logo propio todavía: la UI muestra la marca genérica. */
  logo_url: string | null;
}

export interface PerfilActual {
  id: string;
  nombre: string;
  rol: string;
  solapas: string[] | null;
  puede_editar: boolean | null;
  estado: EstadoPerfil;
  es_superadmin: boolean;
  empresa: EmpresaActual | null;
}

/**
 * El perfil de quien está en sesión, junto con su empresa.
 *
 * Devuelve null si no hay sesión. Si devuelve un perfil con
 * `estado: "pendiente"` es alguien que se registró y todavía no fue
 * habilitado: tiene cuenta pero no pertenece a ninguna empresa, así que no
 * hay un solo dato que pueda ver.
 */
export async function getPerfilActual(): Promise<PerfilActual | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, solapas, puede_editar, estado, es_superadmin, empresas(id, nombre, slug, plan, modulos, activa, logo_url)")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = data as any;
  // El join viene como objeto o como array de uno según cómo resuelva PostgREST.
  const emp = Array.isArray(p.empresas) ? p.empresas[0] : p.empresas;

  return {
    id: p.id,
    nombre: p.nombre,
    rol: p.rol,
    solapas: p.solapas,
    puede_editar: p.puede_editar,
    estado: p.estado ?? "activo",
    es_superadmin: !!p.es_superadmin,
    empresa: emp
      ? {
          id: emp.id, nombre: emp.nombre, slug: emp.slug,
          plan: emp.plan, modulos: emp.modulos ?? [], activa: emp.activa,
          logo_url: emp.logo_url ?? null,
        }
      : null,
  };
}
