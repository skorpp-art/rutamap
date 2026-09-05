import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { PanelUsuarios } from "@/components/usuarios/PanelUsuarios";

export default async function UsuariosPage() {
  // El maestro administra las cuentas de SU empresa. Quién es de qué empresa
  // lo filtra la base (get_usuarios), no esta pantalla.
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/usuarios");
  if (perfil.rol !== "maestro" && !perfil.es_superadmin) redirect("/");

  return (
    <div className="h-full w-full overflow-y-auto">
      <PanelUsuarios usuarioActualId={perfil.id} />
    </div>
  );
}
