import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CargaDia } from "@/components/carga/CargaDia";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function CargaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/carga");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "carga")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <CargaDia puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
