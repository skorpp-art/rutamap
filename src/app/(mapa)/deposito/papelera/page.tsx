import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { PapeleraPanel } from "@/components/deposito/PapeleraPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function DepositoPapeleraPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/deposito/papelera");
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <PapeleraPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
