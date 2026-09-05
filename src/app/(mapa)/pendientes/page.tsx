import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { PendientesPanel } from "@/components/pendientes/PendientesPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function PendientesPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/pendientes");
  if (!tieneSolapa(perfil, "pendientes")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <PendientesPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
