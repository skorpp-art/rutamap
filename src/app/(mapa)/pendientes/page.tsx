import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PendientesPanel } from "@/components/pendientes/PendientesPanel";
import { tieneSolapa, puedeEditarPerfil } from "@/lib/permisos";

export default async function PendientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pendientes");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "pendientes")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <PendientesPanel puedeEditar={puedeEditarPerfil(perfil)} />
    </div>
  );
}
