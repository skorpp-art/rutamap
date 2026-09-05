import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { ClienteFicha } from "@/components/deposito/ClienteFicha";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function DepositoClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getPerfilActual();
  if (!perfil) redirect(`/login?next=/deposito/clientes/${id}`);
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ClienteFicha clienteId={id} puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
