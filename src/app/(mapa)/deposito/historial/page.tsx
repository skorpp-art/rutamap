import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { HistorialPanel } from "@/components/deposito/HistorialPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function DepositoHistorialPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/deposito/historial");
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <HistorialPanel />
    </div>
  );
}
