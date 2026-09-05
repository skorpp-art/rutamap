import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { PanelAdmin } from "@/components/admin/PanelAdmin";

/**
 * Panel del superadmin: las empresas del SaaS, sus planes y quién espera
 * acceso. No muestra datos operativos de ningún cliente — eso es de cada
 * empresa, no de quien administra el servicio.
 */
export default async function AdminPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/admin");
  if (!perfil.es_superadmin) redirect("/");

  return <PanelAdmin />;
}
