"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { useEffect, useRef } from "react";
import * as polyclip from "polyclip-ts";
import { toast } from "sonner";
import { MapContainer, TileLayer, GeoJSON, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { Zona } from "@/types/database.types";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import type { RecorridoGeo } from "@/types/database.types";

export type ModoEdicion = "area" | "traza" | null;

// Fix íconos de marcadores de Leaflet con webpack/Next.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Sub-componente: hace zoom a todos los recorridos de una zona
function ZoomAZona({ zona, recorridos }: { zona: Zona | null; recorridos: RecorridoGeo[] }) {
  const map = useMap();
  useEffect(() => {
    if (!zona) return;
    const layers: L.Layer[] = [];
    recorridos
      .filter((r) => r.zona === zona && r.activo && (r.area_geojson || r.traza_geojson))
      .forEach((r) => {
        const geojson = r.area_geojson ?? r.traza_geojson;
        if (geojson) {
          try {
            layers.push(L.geoJSON(JSON.parse(geojson)));
          } catch { /* ignorar */ }
        }
      });
    if (layers.length === 0) return;
    const group = L.featureGroup(layers);
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [zona, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Sub-componente: cierra popovers de zoom al hacer click en el mapa
function ClickFuera({ onClickMapa }: { onClickMapa: () => void }) {
  useMapEvents({ click: onClickMapa });
  return null;
}

// Sub-componente: ajusta la vista al polígono/traza del recorrido activo
function AjustarVista({ recorrido }: { recorrido: RecorridoGeo | null }) {
  const map = useMap();
  useEffect(() => {
    const geojson = recorrido?.area_geojson ?? recorrido?.traza_geojson;
    if (!geojson) return;
    try {
      const bounds = L.geoJSON(JSON.parse(geojson)).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } catch {
      // geometría inválida — ignorar
    }
  }, [recorrido?.id, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ─── Editor de ÁREA (polígonos) ──────────────────────────────────────────────
interface GeomanEditorProps {
  recorrido: RecorridoGeo;
  onGeometriaChange: (geojson: string | null) => void;
  polygonAgregar?: string | null;
  onPolygonAgregado?: () => void;
  polygonReemplazar?: string | null;
  onPolygonReemplazado?: () => void;
  herramientaActiva?: "lapiz" | "tijera" | null;
  onHerramientaFin?: () => void;
}

function GeomanAreaEditor({
  recorrido,
  onGeometriaChange,
  polygonAgregar,
  onPolygonAgregado,
  polygonReemplazar,
  onPolygonReemplazado,
  herramientaActiva,
  onHerramientaFin,
}: GeomanEditorProps) {
  const map = useMap();
  const onChangeRef = useRef(onGeometriaChange);
  const polyLayersRef = useRef<L.Polygon[]>([]);
  const editLayerRef = useRef<L.GeoJSON | null>(null);
  // Ref para que el manejador de pm:create del setup principal sepa si
  // la herramienta activa está procesando el evento
  const herramientaRef = useRef<"lapiz" | "tijera" | null>(null);
  // Ref que siempre guarda la última geometría notificada al padre —
  // usada como fallback defensivo en el lápiz si polyLayersRef está vacío
  const currentGeomRef = useRef<string | null>(recorrido.area_geojson ?? null);

  useEffect(() => {
    onChangeRef.current = onGeometriaChange;
  });

  // Helper: notifica y trackea la geometría actual
  function emitGeom(geojson: string | null) {
    currentGeomRef.current = geojson;
    onChangeRef.current(geojson);
  }

  // Inyectar polígono llegado desde el buscador de localidades
  useEffect(() => {
    if (!polygonAgregar) return;
    try {
      const geom = JSON.parse(polygonAgregar);
      const style = {
        color: recorrido.color,
        fillColor: recorrido.color,
        fillOpacity: 0.28,
        weight: 2.5,
      };
      const newLayer = L.geoJSON(geom, { style }).addTo(map);
      newLayer.eachLayer((sublayer) => {
        if (sublayer instanceof L.Polygon) {
          polyLayersRef.current.push(sublayer);
          sublayer.pm.enable({ allowSelfIntersection: false });
          sublayer.on("pm:edit", () => {
            const polys = polyLayersRef.current.filter((p) => map.hasLayer(p));
            if (polys.length === 0) { emitGeom(null); return; }
            const coords = polys.map((p) =>
              (p.toGeoJSON() as { geometry: { coordinates: number[][][] } }).geometry.coordinates
            );
            emitGeom(JSON.stringify({ type: "MultiPolygon", coordinates: coords }));
          });
        }
      });
      const bounds = newLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      const allPolys = polyLayersRef.current.filter((p) => map.hasLayer(p));
      if (allPolys.length > 0) {
        const coords = allPolys.map((p) =>
          (p.toGeoJSON() as { geometry: { coordinates: number[][][] } }).geometry.coordinates
        );
        emitGeom(JSON.stringify({ type: "MultiPolygon", coordinates: coords }));
      }
    } catch {
      // GeoJSON inválido — ignorar
    }
    // Siempre notificar aunque falle, para liberar el estado en el padre
    onPolygonAgregado?.();
  }, [polygonAgregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reemplazar geometría completa (simplificar / tijera / deshacer)
  useEffect(() => {
    if (!polygonReemplazar) return;
    try {
      // 1. Eliminar todas las capas editables existentes
      polyLayersRef.current.forEach((layer) => {
        layer.pm.disable();
        layer.off("pm:edit");
        if (map.hasLayer(layer)) layer.remove();
      });
      polyLayersRef.current = [];

      // 2. Eliminar el grupo contenedor inicial si sigue en el mapa
      if (editLayerRef.current) {
        if (map.hasLayer(editLayerRef.current)) editLayerRef.current.remove();
        editLayerRef.current = null;
      }

      // 3. Agregar la nueva geometría como capas editables
      const geom = JSON.parse(polygonReemplazar);
      const style = {
        color: recorrido.color,
        fillColor: recorrido.color,
        fillOpacity: 0.28,
        weight: 2.5,
      };
      const newLayer = L.geoJSON(geom, { style }).addTo(map);
      newLayer.eachLayer((sublayer) => {
        if (sublayer instanceof L.Polygon) {
          polyLayersRef.current.push(sublayer);
          sublayer.pm.enable({ allowSelfIntersection: false });
          sublayer.on("pm:edit", () => {
            const polys = polyLayersRef.current.filter((p) => map.hasLayer(p));
            if (polys.length === 0) { emitGeom(null); return; }
            const coords = polys.map((p) =>
              (p.toGeoJSON() as { geometry: { coordinates: number[][][] } }).geometry.coordinates
            );
            emitGeom(JSON.stringify({ type: "MultiPolygon", coordinates: coords }));
          });
        }
      });

      // 4. Actualizar geometría temporal con el resultado
      const allPolys = polyLayersRef.current.filter((p) => map.hasLayer(p));
      if (allPolys.length > 0) {
        const coords = allPolys.map((p) =>
          (p.toGeoJSON() as { geometry: { coordinates: number[][][] } }).geometry.coordinates
        );
        emitGeom(JSON.stringify({ type: "MultiPolygon", coordinates: coords }));
      } else {
        emitGeom(null);
      }

      // 5. Encuadrar vista
      const bounds = newLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } catch {
      // GeoJSON inválido — ignorar
    }
    // Siempre notificar aunque falle, para que el padre limpie el estado
    onPolygonReemplazado?.();
  }, [polygonReemplazar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar herramientaRef con la prop para que el manejador principal lo vea
  useEffect(() => {
    herramientaRef.current = herramientaActiva ?? null;
  }, [herramientaActiva]);

  // ── Herramienta Lápiz (unión) / Tijera (diferencia) ─────────────────────────
  useEffect(() => {
    if (!herramientaActiva) return;

    const estilo = {
      color: herramientaActiva === "tijera" ? "#f97316" : recorrido.color,
      fillColor: herramientaActiva === "tijera" ? "#f97316" : recorrido.color,
      fillOpacity: 0.25,
      weight: 2.5,
    };

    // Activar modo dibujo con color apropiado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.pm as any).setGlobalOptions({ pathOptions: estilo });
    map.pm.enableDraw("Polygon");

    function onDibujo(e: { layer: L.Layer }) {
      const drawnLayer = e.layer as L.Polygon;

      // Quitar la capa dibujada del mapa — la reemplazaremos con el resultado
      if (map.hasLayer(drawnLayer)) drawnLayer.remove();

      // Construir coords del polígono dibujado (Poly = Ring[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drawnGeom = (drawnLayer.toGeoJSON() as any).geometry;
      const drawnCoords: number[][][] =
        drawnGeom.type === "Polygon" ? drawnGeom.coordinates : drawnGeom.coordinates[0];

      // Construir coords del área actual (MultiPoly = Poly[])
      const polys = polyLayersRef.current.filter((p) => map.hasLayer(p));
      let existingCoords: number[][][][] = polys.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p) => (p.toGeoJSON() as any).geometry.coordinates as number[][][]
      );

      // ── Fallback defensivo: si los layers no están en el ref, usar la
      // última geometría conocida para no perder el área existente
      if (existingCoords.length === 0 && currentGeomRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gFallback: any = JSON.parse(currentGeomRef.current);
          if (gFallback.type === "Polygon")
            existingCoords = [gFallback.coordinates];
          else if (gFallback.type === "MultiPolygon")
            existingCoords = gFallback.coordinates;
        } catch { /* ignorar */ }
      }

      // Estilo base para capas editables
      const layerStyleBase = {
        color: recorrido.color,
        fillColor: recorrido.color,
        fillOpacity: 0.28,
        weight: 2.5,
      };

      // Helper: registrar una nueva capa editable en el ref y notificar al padre
      function registrarCapa(capa: L.Polygon) {
        polyLayersRef.current.push(capa);
        capa.pm.enable({ allowSelfIntersection: false });
        capa.on("pm:edit", () => {
          const ps = polyLayersRef.current.filter((p) => map.hasLayer(p));
          if (ps.length === 0) { emitGeom(null); return; }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cs = ps.map((p) => (p.toGeoJSON() as any).geometry.coordinates as number[][][]);
          emitGeom(JSON.stringify({ type: "MultiPolygon", coordinates: cs }));
        });
      }

      function notificarGeometria() {
        const allPolys = polyLayersRef.current.filter((p) => map.hasLayer(p));
        if (allPolys.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cs = allPolys.map((p) => (p.toGeoJSON() as any).geometry.coordinates as number[][][]);
          emitGeom(JSON.stringify({ type: "MultiPolygon", coordinates: cs }));
        } else {
          emitGeom(null);
        }
      }

      let resultCoords: number[][][][] | null = null;
      let polyclipFalló = false;

      try {
        if (herramientaActiva === "lapiz") {
          if (existingCoords.length === 0) {
            resultCoords = [drawnCoords];
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            resultCoords = (polyclip as any).union(existingCoords, [drawnCoords]) as number[][][][];
          }
        } else {
          // tijera
          if (existingCoords.length === 0) {
            toast.error("No hay área para recortar.");
            onHerramientaFin?.();
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resultCoords = (polyclip as any).difference(existingCoords, [drawnCoords]) as number[][][][];
        }
      } catch {
        polyclipFalló = true;
      }

      // Si polyclip falló o devolvió vacío para tijera → manejar error
      if (polyclipFalló || !resultCoords) {
        if (herramientaActiva === "lapiz") {
          // Fallback: agregar el polígono dibujado como pieza separada (sin unión)
          toast.warning("La unión automática falló con esta geometría compleja. Se agregó como pieza separada. Probá Simplificar el área primero.", { duration: 6000 });
          drawnLayer.setStyle(layerStyleBase);
          drawnLayer.addTo(map);
          registrarCapa(drawnLayer);
          notificarGeometria();
        } else {
          toast.error("No se pudo recortar. El área puede ser demasiado compleja. Probá Simplificar primero.");
        }
        onHerramientaFin?.();
        return;
      }

      if (resultCoords.length === 0) {
        if (herramientaActiva === "tijera") {
          toast.error("La zona recortada cubre todo el área — no quedaría nada.");
        }
        onHerramientaFin?.();
        return;
      }

      // Limpiar todas las capas editables existentes
      polyLayersRef.current.forEach((layer) => {
        layer.pm.disable();
        layer.off("pm:edit");
        if (map.hasLayer(layer)) layer.remove();
      });
      polyLayersRef.current = [];
      if (editLayerRef.current) {
        if (map.hasLayer(editLayerRef.current)) editLayerRef.current.remove();
        editLayerRef.current = null;
      }

      // Construir geometría resultado y agregar como capas editables
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultGeom: any =
        resultCoords.length === 1
          ? { type: "Polygon", coordinates: resultCoords[0] }
          : { type: "MultiPolygon", coordinates: resultCoords };

      const newLayer = L.geoJSON(resultGeom, { style: layerStyleBase }).addTo(map);
      newLayer.eachLayer((sublayer) => {
        if (sublayer instanceof L.Polygon) registrarCapa(sublayer);
      });

      notificarGeometria();

      // Restaurar opciones de dibujo al color del recorrido
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map.pm as any).setGlobalOptions({
        pathOptions: {
          color: recorrido.color,
          fillColor: recorrido.color,
          fillOpacity: 0.28,
          weight: 2.5,
        },
      });

      onHerramientaFin?.();
    }

    map.once("pm:create", onDibujo);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off("pm:create", onDibujo as any);
      map.pm.disableDraw("Polygon");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map.pm as any).setGlobalOptions({
        pathOptions: {
          color: recorrido.color,
          fillColor: recorrido.color,
          fillOpacity: 0.28,
          weight: 2.5,
        },
      });
    };
  }, [herramientaActiva]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function collect(): string | null {
      const polys = polyLayersRef.current.filter((p) => map.hasLayer(p));
      if (polys.length === 0) return null;
      const multiCoords = polys.map((p) => {
        const geom = (
          p.toGeoJSON() as { geometry: { coordinates: number[][][] } }
        ).geometry;
        return geom.coordinates;
      });
      return JSON.stringify({ type: "MultiPolygon", coordinates: multiCoords });
    }

    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircle: false,
      drawPolyline: false,
      drawCircleMarker: false,
      drawText: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      cutPolygon: true,
      removalMode: true,
      rotateMode: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.pm as any).setGlobalOptions({
      pathOptions: {
        color: recorrido.color,
        fillColor: recorrido.color,
        fillOpacity: 0.28,
        weight: 2.5,
      },
      snappable: true,
      snapDistance: 15,
    });

    if (recorrido.area_geojson) {
      try {
        const parsed = JSON.parse(recorrido.area_geojson);
        const editLayer = L.geoJSON(parsed, {
          style: {
            color: recorrido.color,
            fillColor: recorrido.color,
            fillOpacity: 0.28,
            weight: 2.5,
          },
        }).addTo(map);

        editLayer.eachLayer((layer) => {
          if (layer instanceof L.Polygon) {
            polyLayersRef.current.push(layer);
            layer.pm.enable({ allowSelfIntersection: false });
            layer.on("pm:edit", () => onChangeRef.current(collect()));
          }
        });

        editLayerRef.current = editLayer;
        emitGeom(collect());
      } catch {
        // GeoJSON inválido — empezar en blanco
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("pm:create", (e: any) => {
      // Si la herramienta lápiz/tijera está activa, su propio efecto maneja el evento
      if (herramientaRef.current) return;
      const layer = e.layer as L.Layer;
      if (layer instanceof L.Polygon) {
        layer.setStyle({
          color: recorrido.color,
          fillColor: recorrido.color,
          fillOpacity: 0.28,
          weight: 2.5,
        });
        polyLayersRef.current.push(layer);
        layer.on("pm:edit", () => emitGeom(collect()));
        emitGeom(collect());
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("pm:cut", (e: any) => {
      // Geoman reemplaza el polígono original con uno recortado — actualizar refs
      const origLayer = e.originalLayer as L.Polygon;
      const newLayer = e.layer as L.Polygon;
      polyLayersRef.current = polyLayersRef.current.filter((p) => p !== origLayer);
      if (newLayer instanceof L.Polygon) {
        newLayer.setStyle({
          color: recorrido.color,
          fillColor: recorrido.color,
          fillOpacity: 0.28,
          weight: 2.5,
        });
        polyLayersRef.current.push(newLayer);
        newLayer.pm.enable({ allowSelfIntersection: false });
        newLayer.on("pm:edit", () => emitGeom(collect()));
      }
      emitGeom(collect());
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("pm:remove", (e: any) => {
      const layer = e.layer as L.Layer;
      polyLayersRef.current = polyLayersRef.current.filter((p) => p !== layer);
      emitGeom(collect());
    });

    return () => {
      map.pm.removeControls();
      map.off("pm:create");
      map.off("pm:cut");
      map.off("pm:remove");

      if (editLayerRef.current) {
        editLayerRef.current.eachLayer((layer) => {
          if (layer instanceof L.Polygon) {
            layer.pm.disable();
            layer.off("pm:edit");
          }
        });
        editLayerRef.current.remove();
        editLayerRef.current = null;
      }

      polyLayersRef.current.forEach((layer) => {
        layer.pm.disable();
        layer.off("pm:edit");
        if (map.hasLayer(layer)) layer.remove();
      });
      polyLayersRef.current = [];
    };
  }, [map, recorrido.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ─── Editor de TRAZA (polilíneas) ────────────────────────────────────────────
function GeomanTrazaEditor({
  recorrido,
  onGeometriaChange,
  polygonReemplazar: trazaReemplazar,
  onPolygonReemplazado: onTrazaReemplazada,
}: GeomanEditorProps) {
  const map = useMap();
  const onChangeRef = useRef(onGeometriaChange);
  const lineLayersRef = useRef<L.Polyline[]>([]);
  const editLayerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    onChangeRef.current = onGeometriaChange;
  });

  // Reemplazar la geometría de la traza (por ejemplo, al simplificar)
  useEffect(() => {
    if (!trazaReemplazar) return;
    try {
      // 1. Limpiar capas existentes
      lineLayersRef.current.forEach((layer) => {
        layer.pm.disable();
        layer.off("pm:edit");
        if (map.hasLayer(layer)) layer.remove();
      });
      lineLayersRef.current = [];
      if (editLayerRef.current) {
        if (map.hasLayer(editLayerRef.current)) editLayerRef.current.remove();
        editLayerRef.current = null;
      }

      // 2. Agregar nueva geometría
      const geom = JSON.parse(trazaReemplazar);
      const style = { color: recorrido.color, weight: 2.5, opacity: 0.9, dashArray: "6 4" };
      const newLayer = L.geoJSON(geom, { style }).addTo(map);
      newLayer.eachLayer((sublayer) => {
        if (sublayer instanceof L.Polyline && !(sublayer instanceof L.Polygon)) {
          lineLayersRef.current.push(sublayer as L.Polyline);
          sublayer.pm.enable();
          sublayer.on("pm:edit", () => {
            const lines = lineLayersRef.current.filter((l) => map.hasLayer(l));
            if (lines.length === 0) { onChangeRef.current(null); return; }
            const allCoords: number[][][] = [];
            lines.forEach((l) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const g = (l.toGeoJSON() as any).geometry;
              if (g.type === "LineString") allCoords.push(g.coordinates);
              else if (g.type === "MultiLineString") allCoords.push(...g.coordinates);
            });
            if (allCoords.length > 0)
              onChangeRef.current(JSON.stringify({ type: "MultiLineString", coordinates: allCoords }));
          });
        }
      });

      // 3. Notificar nueva geometría al padre
      const lines = lineLayersRef.current.filter((l) => map.hasLayer(l));
      if (lines.length > 0) {
        const allCoords: number[][][] = [];
        lines.forEach((l) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const g = (l.toGeoJSON() as any).geometry;
          if (g.type === "LineString") allCoords.push(g.coordinates);
          else if (g.type === "MultiLineString") allCoords.push(...g.coordinates);
        });
        if (allCoords.length > 0)
          onChangeRef.current(JSON.stringify({ type: "MultiLineString", coordinates: allCoords }));
      }

      const bounds = newLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });

      onTrazaReemplazada?.();
    } catch {
      // GeoJSON inválido — ignorar
    }
  }, [trazaReemplazar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function collect(): string | null {
      const lines = lineLayersRef.current.filter((l) => map.hasLayer(l));
      if (lines.length === 0) return null;

      const allCoords: number[][][] = [];
      lines.forEach((l) => {
        const geom = (
          l.toGeoJSON() as { geometry: { type: string; coordinates: unknown } }
        ).geometry;
        if (geom.type === "LineString") {
          allCoords.push(geom.coordinates as number[][]);
        } else if (geom.type === "MultiLineString") {
          allCoords.push(...(geom.coordinates as number[][][]));
        }
      });

      if (allCoords.length === 0) return null;
      return JSON.stringify({ type: "MultiLineString", coordinates: allCoords });
    }

    // Solo herramientas de polilínea
    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircle: false,
      drawPolyline: true,
      drawCircleMarker: false,
      drawText: false,
      drawRectangle: false,
      drawPolygon: false,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.pm as any).setGlobalOptions({
      pathOptions: {
        color: recorrido.color,
        weight: 2.5,
        opacity: 0.9,
        dashArray: "6 4",
      },
      snappable: true,
      snapDistance: 15,
    });

    // Cargar traza existente como capa editable
    if (recorrido.traza_geojson) {
      try {
        const parsed = JSON.parse(recorrido.traza_geojson);
        const editLayer = L.geoJSON(parsed, {
          style: {
            color: recorrido.color,
            weight: 2.5,
            opacity: 0.9,
            dashArray: "6 4",
          },
        }).addTo(map);

        editLayer.eachLayer((layer) => {
          if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
            lineLayersRef.current.push(layer);
            layer.pm.enable();
            layer.on("pm:edit", () => onChangeRef.current(collect()));
          }
        });

        editLayerRef.current = editLayer;
        onChangeRef.current(collect());
      } catch {
        // GeoJSON inválido — empezar en blanco
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("pm:create", (e: any) => {
      const layer = e.layer as L.Layer;
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        layer.setStyle({
          color: recorrido.color,
          weight: 2.5,
          opacity: 0.9,
          dashArray: "6 4",
        });
        lineLayersRef.current.push(layer);
        layer.on("pm:edit", () => onChangeRef.current(collect()));
        onChangeRef.current(collect());
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("pm:remove", (e: any) => {
      const layer = e.layer as L.Layer;
      lineLayersRef.current = lineLayersRef.current.filter((l) => l !== layer);
      onChangeRef.current(collect());
    });

    return () => {
      map.pm.removeControls();
      map.off("pm:create");
      map.off("pm:remove");

      if (editLayerRef.current) {
        editLayerRef.current.eachLayer((layer) => {
          if (layer instanceof L.Polyline) {
            layer.pm.disable();
            layer.off("pm:edit");
          }
        });
        editLayerRef.current.remove();
        editLayerRef.current = null;
      }

      lineLayersRef.current.forEach((layer) => {
        layer.pm.disable();
        layer.off("pm:edit");
        if (map.hasLayer(layer)) layer.remove();
      });
      lineLayersRef.current = [];
    };
  }, [map, recorrido.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface MapaLeafletProps {
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
  // Nuevas props
  capaSatelite?: boolean;
  zoomarAZona?: Zona | null;
  solapamientos?: string[];
  onClickMapa?: () => void;
  trazaReemplazar?: string | null;
  onTrazaReemplazada?: () => void;
}

export function MapaLeaflet({
  recorridos,
  recorridoActivo,
  onSelectRecorrido,
  modoEdicion,
  recorridoEditando,
  onGeometriaChange,
  polygonAgregar,
  onPolygonAgregado,
  polygonReemplazar,
  onPolygonReemplazado,
  herramientaActiva,
  onHerramientaFin,
  capaSatelite,
  zoomarAZona,
  solapamientos,
  onClickMapa,
  trazaReemplazar,
  onTrazaReemplazada,
}: MapaLeafletProps) {
  const editando = modoEdicion !== null;

  // Excluir el recorrido en edición del render estático
  const recorridosVisibles =
    editando && recorridoEditando
      ? recorridos.filter((r) => r.id !== recorridoEditando.id)
      : recorridos;

  return (
    <MapContainer
      center={[-34.65, -58.62]}
      zoom={11}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
    >
      {/* crossOrigin="anonymous" necesario para capturar el mapa con html-to-image */}
      {capaSatelite ? (
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com">Esri</a> World Imagery'
          maxZoom={19}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ crossOrigin: "anonymous" } as any)}
        />
      ) : (
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ crossOrigin: "anonymous" } as any)}
        />
      )}

      <AjustarVista recorrido={editando ? recorridoEditando : recorridoActivo} />
      <ZoomAZona zona={zoomarAZona ?? null} recorridos={recorridos} />
      {onClickMapa && <ClickFuera onClickMapa={onClickMapa} />}

      {/* Editor de área (polígonos) */}
      {modoEdicion === "area" && recorridoEditando && (
        <GeomanAreaEditor
          recorrido={recorridoEditando}
          onGeometriaChange={onGeometriaChange}
          polygonAgregar={polygonAgregar}
          onPolygonAgregado={onPolygonAgregado}
          polygonReemplazar={polygonReemplazar}
          onPolygonReemplazado={onPolygonReemplazado}
          herramientaActiva={herramientaActiva}
          onHerramientaFin={onHerramientaFin}
        />
      )}

      {/* Editor de traza (polilíneas) */}
      {modoEdicion === "traza" && recorridoEditando && (
        <GeomanTrazaEditor
          recorrido={recorridoEditando}
          onGeometriaChange={onGeometriaChange}
          polygonReemplazar={trazaReemplazar}
          onPolygonReemplazado={onTrazaReemplazada}
        />
      )}

      {/* Polígonos de área */}
      {recorridosVisibles.map((r) => {
        if (!r.area_geojson) return null;
        const seleccionado = r.id === recorridoActivo?.id;
        const inactivo = !r.activo;
        let geom: object;
        try {
          geom = JSON.parse(r.area_geojson);
        } catch {
          return null;
        }
        return (
          <GeoJSON
            key={`area-${r.id}-${r.actualizado_en}-${seleccionado}`}
            data={geom as GeoJSON.GeoJsonObject}
            style={{
              color: r.color,
              weight: seleccionado ? 3 : 1.5,
              opacity: editando ? 0.2 : inactivo ? 0.35 : seleccionado ? 1 : 0.75,
              fillColor: r.color,
              fillOpacity: editando ? 0.04 : inactivo ? 0.04 : seleccionado ? 0.28 : 0.12,
              dashArray: inactivo ? "4 4" : undefined,
            }}
            eventHandlers={
              editando || inactivo
                ? {}
                : {
                    click: () => onSelectRecorrido(r.id),
                    mouseover: (e) => {
                      e.target.setStyle({ weight: 3, fillOpacity: 0.25 });
                    },
                    mouseout: (e) => {
                      if (r.id !== recorridoActivo?.id) {
                        e.target.setStyle({ weight: 1.5, fillOpacity: 0.12 });
                      }
                    },
                  }
            }
          >
            {!editando && !inactivo && (
              <Tooltip
                permanent={seleccionado}
                sticky={!seleccionado}
                direction="center"
              >
                <span className="font-semibold text-xs">{r.codigo}</span>
                {seleccionado && (
                  <span className="text-xs text-muted-foreground"> — {r.nombre}</span>
                )}
              </Tooltip>
            )}
          </GeoJSON>
        );
      })}

      {/* Zonas de solapamiento */}
      {(solapamientos ?? []).map((geojsonStr, i) => {
        let geom: object;
        try { geom = JSON.parse(geojsonStr); } catch { return null; }
        return (
          <GeoJSON
            key={`solap-${i}`}
            data={geom as GeoJSON.GeoJsonObject}
            style={{
              color: "#ef4444",
              weight: 1.5,
              opacity: 0.9,
              fillColor: "#ef4444",
              fillOpacity: 0.35,
              dashArray: "3 3",
            }}
          />
        );
      })}

      {/* Trazas internas (LineString punteado) */}
      {recorridosVisibles.map((r) => {
        if (!r.traza_geojson) return null;
        let geom: object;
        try {
          geom = JSON.parse(r.traza_geojson);
        } catch {
          return null;
        }
        return (
          <GeoJSON
            key={`traza-${r.id}-${r.actualizado_en}`}
            data={geom as GeoJSON.GeoJsonObject}
            style={{
              color: r.color,
              weight: 2.5,
              opacity: editando ? 0.2 : 0.85,
              dashArray: "6 4",
              fill: false,
            }}
          />
        );
      })}
    </MapContainer>
  );
}
