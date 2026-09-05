import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { CasosPanel } from "@/components/casos/CasosPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function CasosPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/casos");
  if (!tieneSolapa(perfil, "casos")) redirect("/");

  // Quien gestiona casos se decide en la base (puede_gestionar_casos), no acá:
  // el permiso de edición general deja afuera a los asesores, que son los que
  // abren la mayoría de los casos.
  return (
    <div className="h-full w-full overflow-hidden">
      <CasosPanel nombre={perfil?.nombre ?? ""} />
    </div>
  );
}
