import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { tieneSolapa } from "@/lib/permisos";
import { RutaConductor } from "@/components/ruta/RutaConductor";
import type { RecorridoGeo } from "@/types/database.types";

export default async function RutaPage() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/ruta");
  if (!tieneSolapa(perfil, "ruta")) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_recorridos_con_geojson");
  const recorridos: RecorridoGeo[] = (data as unknown as RecorridoGeo[]) ?? [];

  return (
    <div className="h-full w-full overflow-y-auto">
      <RutaConductor recorridos={recorridos} />
    </div>
  );
}
