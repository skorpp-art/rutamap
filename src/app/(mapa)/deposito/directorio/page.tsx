import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectorioPanel } from "@/components/deposito/DirectorioPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function DepositoDirectorioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/deposito/directorio");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "deposito")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <DirectorioPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
