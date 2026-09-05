import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { DirectorioPanel } from "@/components/deposito/DirectorioPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function DepositoDirectorioPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/deposito/directorio");
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <DirectorioPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
