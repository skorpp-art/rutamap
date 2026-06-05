"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { useEffect, useRef } from "react";
import * as turf from "@turf/turf";
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
  modoPluma?: "agregar" | "quitar" | null;
  modoEditarNodos?: boolean;
  vaciarTrigger?: number;
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
  modoPluma,
  modoEditarNodos,
  vaciarTrigger,
}: GeomanEditorProps) {
  const map = useMap();
  const onChangeRef = useRef(onGeometriaChange);
  const polyLayersRef = useRef<L.Polygon[]>([]);
  const editLayerRef = useRef<L.GeoJSON | null>(null);
  const herramientaRef = useRef<"lapiz" | "tijera" | null>(null);
  const currentGeomRef = useRef<string | null>(recorrido.area_geojson ?? null);
  // Handles custom para "Editar nodos" — L.Marker draggables, sin depender de Geoman
  const vertexHandlesRef = useRef<L.Marker[]>([]);
  const modoEditarNodosRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onGeometriaChange;
  });

  // Helper: recolectar geometría actual de todas las capas → MultiPolygon plano.
  // CRÍTICO: una capa de Leaflet puede ser Polygon (coords 3D) O MultiPolygon (coords 4D)
  // cuando se cargó desde una unión turf. Hay que APLANAR ambos casos a un MultiPolygon
  // de polígonos, sino la geometría se corrompe al guardar y se pierde lo anterior.
  // NO filtramos por map.hasLayer() — pm.enable() puede mover la capa internamente.
  function collect(): string | null {
    const polys = polyLayersRef.current;
    if (polys.length === 0) return null;
    const multiCoords: number[][][][] = []; // lista de polígonos (cada uno = anillos)
    for (const p of polys) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geom = (p.toGeoJSON() as any).geometry;
        if (!geom) continue;
        if (geom.type === "Polygon") {
          multiCoords.push(geom.coordinates as number[][][]);
        } else if (geom.type === "MultiPolygon") {
          for (const polyCoords of geom.coordinates as number[][][][]) {
            multiCoords.push(polyCoords);
          }
        }
      } catch { /* ignorar capa inválida */ }
    }
    if (multiCoords.length === 0) return null;
    return JSON.stringify({ type: "MultiPolygon", coordinates: multiCoords });
  }

  // Helper: notifica y trackea la geometría actual
  function emitGeom(geojson: string | null) {
    currentGeomRef.current = geojson;
    onChangeRef.current(geojson);
  }

  // ── Handles custom para mover nodos ─────────────────────────────────────────
  function crearVertexHandles() {
    try {
      // Limpiar handles viejos
      vertexHandlesRef.current.forEach((m) => { try { m.remove(); } catch { /* ignorar */ } });
      vertexHandlesRef.current = [];

      if (!modoEditarNodosRef.current) return;

      // NO filtrar por map.hasLayer — pm.enable() puede mover la capa internamente
      const polys = polyLayersRef.current;
      if (polys.length === 0) return;

      polys.forEach((polygon) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let rings: any = polygon.getLatLngs();
          if (!rings || rings.length === 0) return;

          // Normalizar: si rings[0] no es array, envolver en un array de rings
          if (!Array.isArray(rings[0])) rings = [rings];
          // Si es 3D (MultiPolygon interno de Leaflet), tomar el primer nivel
          if (Array.isArray(rings[0]) && Array.isArray(rings[0][0]) && !('lat' in rings[0][0])) {
            // rings = [[[LatLng,...]], ...]  → aplanar un nivel
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const flattened: any[] = [];
            (rings as [][][]).forEach((p) => p.forEach((r) => flattened.push(r)));
            rings = flattened;
          }

          (rings as L.LatLng[][]).forEach((ring: L.LatLng[], ringIdx: number) => {
            if (!ring || ring.length < 2) return;

            // Detectar si el anillo está cerrado (primer === último punto)
            const firstPt = ring[0];
            const lastPt = ring[ring.length - 1];
            if (!firstPt || typeof firstPt.lat === 'undefined') return;

            const isClosedRing =
              ring.length > 1 &&
              firstPt.lat === lastPt?.lat &&
              firstPt.lng === lastPt?.lng;
            const uniqueVerts = isClosedRing ? ring.slice(0, -1) : ring;

            uniqueVerts.forEach((latlng: L.LatLng, vertIdx: number) => {
              // Validar que el punto es un LatLng real
              if (!latlng || typeof latlng.lat !== 'number' || typeof latlng.lng !== 'number') return;

              try {
                const handle = L.marker(latlng, {
                  draggable: true,
                  icon: L.divIcon({
                    html: '<div style="width:22px;height:22px;border-radius:50%;background:white;border:3px solid #2563eb;box-shadow:0 2px 8px rgba(37,99,235,0.5);cursor:grab;"></div>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11],
                    className: "",
                  }),
                  zIndexOffset: 1000,
                }).addTo(map);

                handle.on("dragstart", () => { map.dragging.disable(); });

                handle.on("drag", () => {
                  try {
                    const newLatLng = handle.getLatLng();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let cur: any = polygon.getLatLngs();
                    const flat = !Array.isArray(cur[0]);
                    if (flat) {
                      const newRing = [...(cur as L.LatLng[])];
                      newRing[vertIdx] = newLatLng;
                      if (isClosedRing && newRing.length > 1) newRing[newRing.length - 1] = newRing[0];
                      polygon.setLatLngs(newRing);
                    } else {
                      cur = (cur as L.LatLng[][]).map((r: L.LatLng[], ri: number) => {
                        if (ri !== ringIdx) return r;
                        const newR = [...r];
                        newR[vertIdx] = newLatLng;
                        if (isClosedRing && newR.length > 1) newR[newR.length - 1] = newR[0];
                        return newR;
                      });
                      polygon.setLatLngs(cur);
                    }
                  } catch { /* ignorar errores de drag */ }
                });

                handle.on("dragend", () => {
                  map.dragging.enable();
                  emitGeom(collect());
                  if (modoEditarNodosRef.current) {
                    requestAnimationFrame(() => crearVertexHandles());
                  }
                });

                vertexHandlesRef.current.push(handle);
              } catch { /* ignorar error al crear handle individual */ }
            });
          });
        } catch { /* ignorar error al procesar un polígono */ }
      });
    } catch (err) {
      console.error("[RutaMap] Error en crearVertexHandles:", err);
    }
  }

  // Sincronizar ref del modo
  useEffect(() => {
    modoEditarNodosRef.current = modoEditarNodos ?? false;
  }, [modoEditarNodos]);

  // Activar/desactivar handles
  useEffect(() => {
    if (modoEditarNodos) {
      crearVertexHandles();
    } else {
      vertexHandlesRef.current.forEach((m) => { try { m.remove(); } catch { /* ignorar */ } });
      vertexHandlesRef.current = [];
      map.dragging.enable();
    }
    return () => {
      vertexHandlesRef.current.forEach((m) => { try { m.remove(); } catch { /* ignorar */ } });
      vertexHandlesRef.current = [];
      map.dragging.enable();
    };
  }, [modoEditarNodos]); // eslint-disable-line react-hooks/exhaustive-deps

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
          sublayer.on("pm:edit", () => emitGeom(collect()));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sublayer as any).on("pm:dragend", () => emitGeom(collect()));
        }
      });
      const bounds = newLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      emitGeom(collect());
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
          sublayer.on("pm:edit", () => emitGeom(collect()));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sublayer as any).on("pm:dragend", () => emitGeom(collect()));
        }
      });

      // 4. Actualizar geometría temporal con el resultado (collect aplana Multi/Polygon)
      emitGeom(collect());

      // 5. Encuadrar vista
      const bounds = newLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } catch {
      // GeoJSON inválido — ignorar
    }
    // Siempre notificar aunque falle, para que el padre limpie el estado
    onPolygonReemplazado?.();
    // Si "Editar nodos" estaba activo, refrescar los handles con la nueva geometría
    if (modoEditarNodosRef.current) {
      requestAnimationFrame(() => crearVertexHandles());
    }
  }, [polygonReemplazar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar herramientaRef con la prop para que el manejador principal lo vea
  useEffect(() => {
    herramientaRef.current = herramientaActiva ?? null;
  }, [herramientaActiva]);

  // ── Vaciar: borrar todas las capas y empezar de cero ────────────────────────
  const vaciarInicialRef = useRef(true);
  useEffect(() => {
    if (vaciarInicialRef.current) { vaciarInicialRef.current = false; return; }
    // Limpiar handles de nodos custom
    vertexHandlesRef.current.forEach((m) => { try { m.remove(); } catch { /* ignorar */ } });
    vertexHandlesRef.current = [];
    // Limpiar todos los polígonos
    polyLayersRef.current.forEach((layer) => {
      layer.pm.disable();
      layer.off("pm:edit");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer as any).off("pm:dragend");
      if (map.hasLayer(layer)) layer.remove();
    });
    polyLayersRef.current = [];
    if (editLayerRef.current) {
      if (map.hasLayer(editLayerRef.current)) editLayerRef.current.remove();
      editLayerRef.current = null;
    }
    currentGeomRef.current = null;
    emitGeom(null);
  }, [vaciarTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pluma: cambiar cómo se quitan vértices según el modo.
  // setOptions no toma efecto en tiempo real — hay que disable + enable.
  useEffect(() => {
    const removeOn = modoPluma === "quitar" ? "click" : "contextmenu";
    // NO filtrar por map.hasLayer — pm.enable() puede mover la capa internamente
    polyLayersRef.current
      .forEach((layer) => {
        layer.pm.disable();
        layer.pm.enable({
          allowSelfIntersection: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          removeVertexOn: removeOn as any,
        });
      });
  }, [modoPluma]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editar nodos: deshabilitar el pan del mapa para que el drag
  // siempre vaya al vértice y no al mapa.
  useEffect(() => {
    if (modoEditarNodos) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
    return () => { map.dragging.enable(); };
  }, [modoEditarNodos, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Herramienta Lápiz (unión) / Tijera (diferencia) ─────────────────────────
  useEffect(() => {
    if (!herramientaActiva) return;

    // Lápiz = ámbar (dibujar) · Tijera = naranja fuerte (recortar)
    const estilo = {
      color: herramientaActiva === "tijera" ? "#f97316" : "#f59e0b",
      fillColor: herramientaActiva === "tijera" ? "#f97316" : "#fbbf24",
      fillOpacity: 0.2,
      weight: 2.5,
      dashArray: herramientaActiva === "lapiz" ? "6 4" : undefined,
    };

    // Activar modo dibujo con estilo ámbar y líneas guía visibles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.pm as any).setGlobalOptions({
      pathOptions: estilo,
      templineStyle: { color: "#f59e0b", weight: 2, dashArray: "6 4" },
      hintlineStyle: { color: "#f59e0b", weight: 2, dashArray: "4 4", opacity: 0.6 },
    });
    map.pm.enableDraw("Polygon");

    function onDibujo(e: { layer: L.Layer }) {
      const drawnLayer = e.layer as L.Polygon;

      if (map.hasLayer(drawnLayer)) drawnLayer.remove();

      // Geometría dibujada
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drawnGeojson = drawnLayer.toGeoJSON() as any;

      // Geometría existente vía collect() (aplana correctamente Polygon y MultiPolygon)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let existingGeom: any = null;
      const collected = collect();
      if (collected) {
        try { existingGeom = JSON.parse(collected); } catch { /* ignorar */ }
      } else if (currentGeomRef.current) {
        try { existingGeom = JSON.parse(currentGeomRef.current); } catch { /* ignorar */ }
      }

      const layerStyleBase = {
        color: recorrido.color,
        fillColor: recorrido.color,
        fillOpacity: 0.28,
        weight: 2.5,
      };

      function registrarCapa(capa: L.Polygon) {
        polyLayersRef.current.push(capa);
        capa.pm.enable({
          allowSelfIntersection: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          removeVertexOn: "contextmenu" as any,
        });
        capa.on("pm:edit", () => emitGeom(collect()));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (capa as any).on("pm:dragend", () => emitGeom(collect()));
      }

      function notificarGeometria() {
        emitGeom(collect());
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resultGeom: any = null;
      let fallo = false;

      try {
        if (herramientaActiva === "lapiz") {
          if (!existingGeom) {
            resultGeom = drawnGeojson.geometry;
          } else {
            const existFeat = turf.feature(existingGeom);
            const union = turf.union(turf.featureCollection([existFeat, drawnGeojson]));
            if (union) {
              // Simplificar el resultado para eliminar nodos extra en los bordes
              const simplified = turf.simplify(union, { tolerance: 0.0003, highQuality: true });
              resultGeom = simplified?.geometry ?? union.geometry;
            }
          }
        } else {
          // tijera
          if (!existingGeom) {
            toast.error("No hay área para recortar.");
            onHerramientaFin?.();
            return;
          }
          const existFeat = turf.feature(existingGeom);
          const diff = turf.difference(turf.featureCollection([existFeat, drawnGeojson]));
          if (!diff) {
            toast.error("La zona recortada cubre todo el área — no quedaría nada.");
            onHerramientaFin?.();
            return;
          }
          // Simplificar el resultado de la diferencia también
          const diffSimpl = turf.simplify(diff, { tolerance: 0.0003, highQuality: true });
          resultGeom = diffSimpl?.geometry ?? diff.geometry;
        }
      } catch {
        fallo = true;
      }

      if (fallo || !resultGeom) {
        if (herramientaActiva === "lapiz") {
          toast.warning("La unión falló con esta geometría. Se agregó como pieza separada. Simplificá primero.", { duration: 6000 });
          drawnLayer.setStyle(layerStyleBase);
          drawnLayer.addTo(map);
          registrarCapa(drawnLayer);
          notificarGeometria();
        } else {
          toast.error("No se pudo recortar. Probá Simplificar primero.");
        }
        onHerramientaFin?.();
        return;
      }

      // Limpiar capas existentes
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

      // Agregar resultado como capas editables
      const newLayer = L.geoJSON(resultGeom, { style: layerStyleBase }).addTo(map);
      newLayer.eachLayer((sublayer) => {
        if (sublayer instanceof L.Polygon) registrarCapa(sublayer);
      });

      notificarGeometria();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map.pm as any).setGlobalOptions({
        pathOptions: { color: recorrido.color, fillColor: recorrido.color, fillOpacity: 0.28, weight: 2.5 },
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
    // collect() y emitGeom() definidos a nivel de componente (usan refs, no tienen closure stale)

    // Helper centralizado para habilitar edición Geoman en una capa
    function habilitarCapa(capa: L.Polygon) {
      capa.pm.enable({
        allowSelfIntersection: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        removeVertexOn: "contextmenu" as any,
      });
      capa.on("pm:edit", () => emitGeom(collect()));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (capa as any).on("pm:dragend", () => emitGeom(collect()));
    }

    // No agregamos el toolbar de Geoman — usamos nuestra propia barra inferior.
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
        // ── Auto-simplificar antes de cargar en el editor ──────────────────
        // Si el polígono tiene demasiados nodos, los handles de Geoman son
        // inutilizables. Simplificamos aquí para que el editor sea fluido.
        // El usuario guarda para persistirlo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let geojsonToLoad = recorrido.area_geojson;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const geomCheck: any = JSON.parse(geojsonToLoad);
          let nTotal = 0;
          if (geomCheck.type === "Polygon")
            nTotal = (geomCheck.coordinates as number[][][]).reduce((a, r) => a + r.length, 0);
          else if (geomCheck.type === "MultiPolygon")
            nTotal = (geomCheck.coordinates as number[][][][]).reduce(
              (a, p) => a + p.reduce((b, r) => b + r.length, 0), 0
            );
          if (nTotal > 100) {
            const eps = nTotal > 500 ? 0.003 : nTotal > 250 ? 0.001 : 0.0003;
            const simplified = turf.simplify(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              turf.feature(geomCheck as any),
              { tolerance: eps, highQuality: true }
            );
            geojsonToLoad = JSON.stringify(simplified.geometry);
          }
        } catch { /* si falla la simplificación, usar original */ }

        const parsed = JSON.parse(geojsonToLoad);
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
            habilitarCapa(layer);
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
        habilitarCapa(layer);
        emitGeom(collect());
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("pm:cut", (e: any) => {
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
        habilitarCapa(newLayer);
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
      // No llamamos removeControls() porque no agregamos controles
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (layer as any).off("pm:dragend");
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
  modoPluma?: "agregar" | "quitar" | null;
  onModoPluma?: (modo: "agregar" | "quitar" | null) => void;
  modoEditarNodos?: boolean;
  vaciarTrigger?: number;
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
  modoPluma,
  modoEditarNodos,
  vaciarTrigger,
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
          modoPluma={modoPluma}
          modoEditarNodos={modoEditarNodos}
          vaciarTrigger={vaciarTrigger}
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
