// Roles de la app. Vive en un módulo común (no "use server") para poder usarse
// tanto en el cliente como en el servidor. Un archivo "use server" solo puede
// exportar funciones async, así que ROLES no puede vivir en actions/usuarios.
export const ROLES = ["maestro", "gerencia", "supervisor", "coordinador", "asesor"] as const;
export type Rol = (typeof ROLES)[number];
