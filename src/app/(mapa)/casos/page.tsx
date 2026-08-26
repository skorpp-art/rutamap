import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CasosPanel } from "@/components/casos/CasosPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function CasosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/casos");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, nombre, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; nombre: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "casos")) redirect("/");

  // Quien gestiona casos se decide en la base (puede_gestionar_casos), no acá:
  // el permiso de edición general deja afuera a los asesores, que son los que
  // abren la mayoría de los casos.
  return (
    <div className="h-full w-full overflow-hidden">
      <CasosPanel nombre={perfil?.nombre ?? ""} />
    </div>
  );
}
