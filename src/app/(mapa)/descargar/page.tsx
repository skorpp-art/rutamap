import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DescargarApp } from "@/components/descargar/DescargarApp";

export default async function DescargarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/descargar");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single<{ rol: string }>();

  return (
    <div className="h-full w-full overflow-hidden">
      <DescargarApp esMaestro={perfil?.rol === "maestro"} />
    </div>
  );
}
