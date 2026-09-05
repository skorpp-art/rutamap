import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { ControlGeneralPanel } from "@/components/deposito/ControlGeneralPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function DepositoPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/deposito");
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ControlGeneralPanel />
    </div>
  );
}
