import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { AlternativasPanel } from "@/components/alternativas/AlternativasPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function AlternativasPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/alternativas");
  if (!tieneSolapa(perfil, "alternativas")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <AlternativasPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
