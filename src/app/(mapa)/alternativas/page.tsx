import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AlternativasPanel } from "@/components/alternativas/AlternativasPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function AlternativasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/alternativas");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "alternativas")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <AlternativasPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
