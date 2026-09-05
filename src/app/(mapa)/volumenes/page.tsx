import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { VolumenesPanel } from "@/components/volumenes/VolumenesPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function VolumenesPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/volumenes");
  if (!tieneSolapa(perfil, "volumenes")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <VolumenesPanel />
    </div>
  );
}
