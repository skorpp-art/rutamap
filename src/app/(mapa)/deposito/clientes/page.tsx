import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientesPanel } from "@/components/deposito/ClientesPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function DepositoClientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/deposito/clientes");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ClientesPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
