"use client";

import dynamic from "next/dynamic";
import type { RecorridoGeo } from "@/types/database.types";
import type { ModoEdicion } from "./MapaLeaflet";
import type { Zona } from "@/types/database.types";

// Leaflet no funciona en SSR — importar dinámicamente solo en el cliente
const MapaLeaflet = dynamic(
  () => import("./MapaLeaflet").then((m) => ({ default: m.MapaLeaflet })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
          <span className="text-sm">Cargando mapa…</span>
        </div>
      </div>
    ),
  }
);

interface MapaWrapperProps {
  recorridos: RecorridoGeo[];
  recorridoActivo: RecorridoGeo | null;
  onSelectRecorrido: (id: string) => void;
  modoEdicion: ModoEdicion;
  recorridoEditando: RecorridoGeo | null;
  onGeometriaChange: (geojson: string | null) => void;
  polygonAgregar?: string | null;
  onPolygonAgregado?: () => void;
  polygonReemplazar?: string | null;
  onPolygonReemplazado?: () => void;
  herramientaActiva?: "lapiz" | "tijera" | null;
  onHerramientaFin?: () => void;
  capaSatelite?: boolean;
  zoomarAZona?: Zona | null;
  solapamientos?: string[];
  onClickMapa?: () => void;
  trazaReemplazar?: string | null;
  onTrazaReemplazada?: () => void;
  modoPluma?: "agregar" | "quitar" | null;
  onModoPluma?: (modo: "agregar" | "quitar" | null) => void;
  modoEditarNodos?: boolean;
  vaciarTrigger?: number;
  modoEnfoque?: boolean;
}

export function MapaWrapper(props: MapaWrapperProps) {
  return (
    <div className="h-full w-full">
      <MapaLeaflet {...props} />
    </div>
  );
}
