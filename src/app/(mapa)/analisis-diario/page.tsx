import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalisisDiario } from "@/components/volumenes/AnalisisDiario";
import { tieneSolapa } from "@/lib/permisos";

export default async function AnalisisDiarioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/analisis-diario");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "analisis")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <AnalisisDiario />
    </div>
  );
}
