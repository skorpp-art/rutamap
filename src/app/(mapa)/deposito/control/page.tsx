import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { ControlOperativoPanel } from "@/components/deposito/ControlOperativoPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function DepositoControlPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/deposito/control");
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ControlOperativoPanel />
    </div>
  );
}
