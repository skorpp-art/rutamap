import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { ClientesPanel } from "@/components/deposito/ClientesPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function DepositoClientesPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/deposito/clientes");
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ClientesPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
