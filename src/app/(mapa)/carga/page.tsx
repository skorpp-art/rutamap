import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CargaDia } from "@/components/carga/CargaDia";

export default async function CargaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/carga");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single<{ rol: string }>();
  const puedeEditar = ["maestro", "supervisor", "coordinador"].includes(perfil?.rol ?? "");

  return (
    <div className="h-full w-full overflow-hidden">
      <CargaDia puedeEditar={puedeEditar} />
    </div>
  );
}
