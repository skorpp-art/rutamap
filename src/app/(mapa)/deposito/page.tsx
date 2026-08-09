import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ControlGeneralPanel } from "@/components/deposito/ControlGeneralPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function DepositoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/deposito");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ControlGeneralPanel />
    </div>
  );
}
