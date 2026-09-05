import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { primeraSolapa } from "@/lib/permisos";

/**
 * Inicio: manda a cada uno a la primera sección que tenga disponible.
 *
 * "Disponible" ahora depende de dos cosas: que la empresa tenga el módulo
 * contratado y que la persona lo tenga asignado. Por eso el orden lo decide
 * primeraSolapa() y no una lista escrita acá: si el plan de la empresa cambia,
 * el destino cambia solo.
 */
export default async function InicioPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");

  // El superadmin administra el SaaS, no una empresa: va derecho a su panel,
  // tenga o no una empresa asignada.
  if (perfil.es_superadmin) redirect("/admin");

  // Se registró pero todavía no lo habilitaron: sala de espera.
  if (perfil.estado !== "activo" || !perfil.empresa) redirect("/bienvenida");

  const destino = primeraSolapa(perfil);
  if (!destino) redirect("/bienvenida");
  redirect(destino);
}
