import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { VistaMapaClient } from "@/components/mapa/VistaMapaClient";
import { getCargaDia } from "@/app/actions/carga-dia";
import { hoyAR } from "@/lib/fechas";
import { tieneSolapa } from "@/lib/permisos";
import { redirect } from "next/navigation";
import type { RecorridoGeo } from "@/types/database.types";

export interface ChoferHoy { chofer: string; turno: string; }

export default async function MapaPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/mapa");
  if (!tieneSolapa(perfil, "mapa")) redirect("/");

  // Solo maestro/supervisor/coordinador pueden modificar recorridos.
  const puedeEditar = ["maestro", "supervisor", "coordinador"].includes(perfil.rol);

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_recorridos_con_geojson");
  if (error) console.error("Error cargando recorridos:", error.message);
  const recorridos: RecorridoGeo[] = (data as unknown as RecorridoGeo[]) ?? [];

  // Conductor asignado hoy a cada recorrido (por código), desde Carga del Día.
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
