import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { CargaDia } from "@/components/carga/CargaDia";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function CargaPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/carga");
  if (!tieneSolapa(perfil, "carga")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <CargaDia puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
