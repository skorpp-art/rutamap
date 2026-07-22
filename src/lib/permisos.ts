// ─── Permisos por usuario ─────────────────────────────────────────────────────
// Cada usuario puede tener asignadas solapas específicas y un flag de edición.
// Si no tiene nada asignado (null), aplica el comportamiento por defecto de su
// rol (como funcionaba hasta ahora). El maestro siempre ve y edita todo.

export const SOLAPAS = [
  { key: "mapa", label: "Mapa", href: "/" },
  { key: "volumenes", label: "Volúmenes", href: "/volumenes" },
  { key: "analisis", label: "Resultados", href: "/analisis-diario" },
  { key: "carga", label: "Carga del Día", href: "/carga" },
  { key: "pendientes", label: "Pendientes", href: "/pendientes" },
] as const;

export type SolapaKey = (typeof SOLAPAS)[number]["key"];

interface PerfilPermisos {
  rol: string;
  solapas?: string[] | null;
  puede_editar?: boolean | null;
}

// Roles que editan por defecto (cuando puede_editar es null)
const ROLES_EDITORES = ["maestro", "supervisor", "coordinador"];

export function tieneSolapa(perfil: PerfilPermisos | null, solapa: SolapaKey): boolean {
  if (!perfil) return solapa === "mapa"; // invitados solo ven el mapa
  if (perfil.rol === "maestro") return true;
  if (perfil.solapas == null) return true; // sin restricción asignada: ve todo (comportamiento histórico)
  return perfil.solapas.includes(solapa);
}

export function puedeEditarPerfil(perfil: PerfilPermisos | null): boolean {
  if (!perfil) return false;
  if (perfil.rol === "maestro") return true;
  return perfil.puede_editar ?? ROLES_EDITORES.includes(perfil.rol);
}
