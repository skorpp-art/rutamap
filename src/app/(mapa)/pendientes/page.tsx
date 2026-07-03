import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PendientesPanel } from "@/components/pendientes/PendientesPanel";

export default async function PendientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pendientes");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single<{ rol: string }>();
  const puedeEditar = ["maestro", "supervisor", "coordinador"].includes(perfil?.rol ?? "");

  return (
    <div className="h-full w-full overflow-hidden">
      <PendientesPanel puedeEditar={puedeEditar} />
    </div>
  );
}
