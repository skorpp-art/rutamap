import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteFicha } from "@/components/deposito/ClienteFicha";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function DepositoClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/deposito/clientes/${id}`);

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ClienteFicha clienteId={id} puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
