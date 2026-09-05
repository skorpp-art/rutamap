// ─── Quién ve qué ─────────────────────────────────────────────────────────────
// Hay dos permisos encadenados, y hace falta pasar los dos:
//
//   1. La EMPRESA tiene contratado el módulo (su plan). Es el techo.
//   2. El USUARIO tiene esa solapa asignada dentro de su empresa. Es el recorte.
//
// Un asesor de una empresa con plan Bronce no ve el Mapa aunque le asignen la
// solapa: su empresa no lo contrató. Y al revés, en una empresa con plan Oro
// un asesor sigue viendo sólo lo que su maestro le habilitó.

export const SOLAPAS = [
  { key: "mapa", label: "Mapa", href: "/mapa" },
  { key: "carga", label: "Carga del Día", href: "/carga" },
  { key: "volumenes", label: "Planificación", href: "/volumenes" },
  { key: "analisis", label: "Resultados", href: "/analisis-diario" },
  { key: "pendientes", label: "Pendientes", href: "/pendientes" },
  { key: "alternativas", label: "Alternativas", href: "/alternativas" },
  { key: "deposito", label: "Depósito", href: "/deposito" },
  { key: "casos", label: "Casos", href: "/casos" },
  { key: "ruta", label: "Mi ruta", href: "/ruta" },
] as const;

export type SolapaKey = (typeof SOLAPAS)[number]["key"];

/**
 * Qué módulos trae cada plan. Es sólo la plantilla que se aplica de un clic al
 * asignar el plan: después el superadmin puede sumarle o quitarle módulos
 * sueltos a una empresa, y lo que manda es la lista guardada en `modulos`.
 */
export const MODULOS_POR_PLAN: Record<string, SolapaKey[]> = {
  // El plan de autoservicio: lo elige la propia empresa al registrarse, sin
  // pasar por el superadmin. Deliberadamente el más chico de todos.
  free: ["pendientes", "ruta"],
  bronce: ["pendientes", "ruta"],
  plata: ["pendientes", "ruta", "alternativas", "casos", "deposito"],
  oro: ["pendientes", "ruta", "alternativas", "casos", "deposito",
        "mapa", "carga", "volumenes", "analisis"],
};

export const PLANES = ["free", "bronce", "plata", "oro"] as const;

interface EmpresaPermisos {
  modulos: string[];
  activa: boolean;
}

interface PerfilPermisos {
  rol: string;
  solapas?: string[] | null;
  puede_editar?: boolean | null;
  estado?: string;
  es_superadmin?: boolean;
  empresa?: EmpresaPermisos | null;
}

// Roles que editan por defecto (cuando puede_editar es null)
const ROLES_EDITORES = ["maestro", "supervisor", "coordinador"];

export function tieneSolapa(perfil: PerfilPermisos | null, solapa: SolapaKey): boolean {
  if (!perfil) return false;                       // sin sesión no hay nada

  // El superadmin administra el SaaS, no una empresa: su acceso es solo a
  // /admin (chequeado aparte, con perfil.es_superadmin directo). Si además
  // pertenece a una empresa como usuario normal, ve lo que esa membresía le
  // permita — pero no por ser superadmin, sino por ser miembro real de ella.

  // Quien se registró y todavía no fue habilitado no pertenece a ninguna
  // empresa: no hay dato que pueda ver.
  if (perfil.estado && perfil.estado !== "activo") return false;

  // Empresa dada de baja (dejó de pagar, se terminó la prueba): se corta el
  // acceso sin borrarle los datos.
  if (!perfil.empresa || !perfil.empresa.activa) return false;

  // El techo: lo que la empresa tiene contratado.
  if (!perfil.empresa.modulos.includes(solapa)) return false;

  // El recorte dentro de la empresa. El maestro es el administrador de su
  // empresa: ve todo lo que ella tenga contratado.
  if (perfil.rol === "maestro") return true;
  if (perfil.solapas == null) return true;         // sin restricción asignada
  return perfil.solapas.includes(solapa);
}

export function puedeEditarPerfil(perfil: PerfilPermisos | null): boolean {
  if (!perfil) return false;
  if (perfil.estado && perfil.estado !== "activo") return false;
  if (!perfil.empresa?.activa) return false;
  if (perfil.rol === "maestro") return true;
  return perfil.puede_editar ?? ROLES_EDITORES.includes(perfil.rol);
}

/** Primera sección disponible: a dónde mandar a alguien después del login. */
export function primeraSolapa(perfil: PerfilPermisos | null): string | null {
  for (const s of SOLAPAS) {
    if (tieneSolapa(perfil, s.key)) return s.href;
  }
  return null;
}
