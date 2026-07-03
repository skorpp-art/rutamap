import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelUsuarios } from "@/components/usuarios/PanelUsuarios";

export default async function UsuariosPage() {
  // Solo el usuario maestro administra cuentas
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/usuarios");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single<{ rol: string }>();
  if (perfil?.rol !== "maestro") redirect("/");

  return (
    <div className="h-full w-full overflow-y-auto">
      <PanelUsuarios usuarioActualId={user.id} />
    </div>
  );
}
