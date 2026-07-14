import { createClient } from "@/lib/supabase/server";
import { VistaMapaClient } from "@/components/mapa/VistaMapaClient";
import { getCargaDia } from "@/app/actions/carga-dia";
import { hoyAR } from "@/lib/fechas";
import type { RecorridoGeo } from "@/types/database.types";

export interface ChoferHoy { chofer: string; turno: string; }

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

  // Conductor asignado hoy a cada recorrido (por código), desde Carga del Día.
  // Un recorrido aparece una sola vez en la carga del día (el turno según su
  // tipo), así que un pre-turno trae su chofer de pre-turno automáticamente.
  const choferesHoy: Record<string, ChoferHoy> = {};
  const cargaRes = await getCargaDia(hoyAR());
  if (cargaRes.ok) {
    for (const f of cargaRes.data ?? []) {
      if (f.chofer && f.chofer.trim()) choferesHoy[f.codigo] = { chofer: f.chofer.trim(), turno: f.turno };
    }
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <VistaMapaClient recorridos={recorridos} puedeEditar={puedeEditar} choferesHoy={choferesHoy} />
    </div>
  );
}
