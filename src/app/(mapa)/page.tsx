import { createClient } from "@/lib/supabase/server";
import { VistaMapaClient } from "@/components/mapa/VistaMapaClient";
import type { RecorridoGeo } from "@/types/database.types";

export default async function MapaPage() {
  const supabase = await createClient();

  // Invitados y roles de solo lectura (gerencia/asesor) ven sin editar;
  // solo maestro/supervisor/coordinador pueden modificar recorridos.
  const { data: { user } } = await supabase.auth.getUser();
  let puedeEditar = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles").select("rol").eq("id", user.id).single<{ rol: string }>();
    puedeEditar = ["maestro", "supervisor", "coordinador"].includes(perfil?.rol ?? "");
  }

  const { data, error } = await supabase.rpc("get_recorridos_con_geojson");

  if (error) {
    console.error("Error cargando recorridos:", error.message);
  }

  const recorridos: RecorridoGeo[] = (data as unknown as RecorridoGeo[]) ?? [];

  return (
    <div className="h-full w-full overflow-hidden">
      <VistaMapaClient recorridos={recorridos} puedeEditar={puedeEditar} />
    </div>
  );
}
