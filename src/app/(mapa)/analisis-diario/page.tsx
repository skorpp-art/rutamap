import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { AnalisisDiario } from "@/components/volumenes/AnalisisDiario";
import { tieneSolapa } from "@/lib/permisos";

export default async function AnalisisDiarioPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/analisis-diario");
  if (!tieneSolapa(perfil, "analisis")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <AnalisisDiario />
    </div>
  );
}
