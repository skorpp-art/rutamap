import { createClient } from "@/lib/supabase/server";
import { VistaMapaClient } from "@/components/mapa/VistaMapaClient";
import type { RecorridoGeo } from "@/types/database.types";

export default async function MapaPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_recorridos_con_geojson");

  if (error) {
    console.error("Error cargando recorridos:", error.message);
  }

  const recorridos: RecorridoGeo[] = (data as unknown as RecorridoGeo[]) ?? [];

  return (
    <div className="h-full w-full overflow-hidden">
      <VistaMapaClient recorridos={recorridos} />
    </div>
  );
}
