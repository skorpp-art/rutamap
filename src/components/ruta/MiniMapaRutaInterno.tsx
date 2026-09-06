"use client";

import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import {
  MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap,
} from "react-leaflet";
import type { Parada } from "@/app/actions/ruta";
import type { RecorridoGeo } from "@/types/database.types";

/** Encuadra el mapa para que entren todas las paradas (y el área, si hay). */
function Encuadrar({ paradas, recorrido }: { paradas: Parada[]; recorrido: RecorridoGeo | null }) {
  const map = useMap();
  const puntos: [number, number][] = paradas.map(p => [p.lat, p.lon]);
  if (puntos.length > 0) {
    const bounds: [number, number][] = [...puntos];
    if (recorrido?.area_geojson) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geom: any = JSON.parse(recorrido.area_geojson);
        const coords: number[][] =
          geom.type === "Polygon" ? geom.coordinates.flat()
          : geom.type === "MultiPolygon" ? geom.coordinates.flat(2)
          : [];
        coords.forEach(([lon, lat]: number[]) => bounds.push([lat, lon]));
      } catch { /* ignorar geometría inválida */ }
    }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }
  return null;
}

export default function MiniMapaRutaInterno({
  paradas, recorrido,
}: { paradas: Parada[]; recorrido: RecorridoGeo | null }) {
  const areaGeom = useMemo(() => {
    if (!recorrido?.area_geojson) return null;
    try { return JSON.parse(recorrido.area_geojson); } catch { return null; }
  }, [recorrido]);

  return (
    <MapContainer center={[-34.65, -58.62]} zoom={11} style={{ height: "100%", width: "100%" }} zoomControl={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {areaGeom && (
        <GeoJSON
          data={areaGeom}
          style={{ color: recorrido?.color ?? "#2563eb", weight: 2, fillOpacity: 0.08 }}
        />
      )}
      {paradas.map((p, i) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lon]}
          radius={9}
          pathOptions={{
            color: "#fff", weight: 2,
            fillColor: p.estado === "entregado" ? "#94a3b8" : p.dentro === false ? "#ef4444" : "#16a34a",
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <span className="font-semibold">{i + 1}.</span> {p.direccion}
          </Tooltip>
        </CircleMarker>
      ))}
      <Encuadrar paradas={paradas} recorrido={recorrido} />
    </MapContainer>
  );
}
