import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VolumenesPanel } from "@/components/volumenes/VolumenesPanel";
import { tieneSolapa } from "@/lib/permisos";

export default async function VolumenesPage() {
  // Volúmenes es privado — requiere sesión
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/volumenes");
  }

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();
  if (!tieneSolapa(perfil, "volumenes")) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <VolumenesPanel />
    </div>
  );
}
