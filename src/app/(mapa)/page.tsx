import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tieneSolapa } from "@/lib/permisos";

/**
 * Inicio. Antes acá vivía el mapa de recorridos; al sacarlo, la raíz pasa a ser
 * un desvío a la primera sección que el usuario tenga habilitada, para que
 * después de iniciar sesión caiga en algo útil en vez de una pantalla vacía.
 */
export default async function InicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, solapas, puede_editar").eq("id", user.id)
    .single<{ rol: string; solapas: string[] | null; puede_editar: boolean | null }>();

  if (tieneSolapa(perfil, "pendientes")) redirect("/pendientes");
  if (tieneSolapa(perfil, "mapa")) redirect("/mapa");
  if (tieneSolapa(perfil, "casos")) redirect("/casos");
  if (tieneSolapa(perfil, "deposito")) redirect("/deposito");
  if (tieneSolapa(perfil, "alternativas")) redirect("/alternativas");
  if (tieneSolapa(perfil, "carga")) redirect("/carga");
  if (tieneSolapa(perfil, "volumenes")) redirect("/volumenes");
  if (tieneSolapa(perfil, "analisis")) redirect("/analisis-diario");
  redirect("/ruta");
}
