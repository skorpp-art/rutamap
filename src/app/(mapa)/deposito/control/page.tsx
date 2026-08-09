import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ControlOperativoPanel } from "@/components/deposito/ControlOperativoPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function DepositoControlPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/deposito/control");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <ControlOperativoPanel />
    </div>
  );
}
