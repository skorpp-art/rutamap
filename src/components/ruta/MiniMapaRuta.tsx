"use client";

import dynamic from "next/dynamic";
import type { Parada } from "@/app/actions/ruta";
import type { RecorridoGeo } from "@/types/database.types";

// Leaflet no funciona en SSR — igual que el mapa principal, se carga sólo en
// el cliente. Éste es un mapa liviano a propósito: sin edición, sin capas de
// calor, sólo el área del recorrido elegido y las paradas del día.
const MapaInterno = dynamic(() => import("./MiniMapaRutaInterno"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
    </div>
  ),
});

export function MiniMapaRuta({
  paradas, recorrido,
}: { paradas: Parada[]; recorrido: RecorridoGeo | null }) {
  return (
    <div className="h-64 sm:h-80 w-full rounded-lg overflow-hidden border">
      <MapaInterno paradas={paradas} recorrido={recorrido} />
    </div>
  );
}
