"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as polyclip from "polyclip-ts";
import { PanelLateral } from "./PanelLateral";
import { PanelDetalle } from "./PanelDetalle";
import { MapaWrapper } from "./MapaWrapper";
import { ExportarMapa } from "./ExportarMapa";
import { BuscadorLocalidad } from "./BuscadorLocalidad";
import { ImportarArea } from "./ImportarArea";
import { DashboardCobertura } from "./DashboardCobertura";
import { Button } from "@/components/ui/button";
import {
  Pencil, Scissors, Undo2, Satellite, Map as MapIcon,
  Layers, BarChart2, ZoomIn, Wand2,
} from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import { actualizarAreaRecorrido, actualizarTrazaRecorrido } from "@/app/actions/recorridos";
import type { ModoEdicion } from "./MapaLeaflet";
import type { RecorridoGeo, Zona } from "@/types/database.types";
import { ZONAS } from "@/types/database.types";

interface VistaMapaClientProps {
  recorridos: RecorridoGeo[];
}

const LABELS_MODO: Record<NonNullable<ModoEdicion>, string> = {
  area: "área",
  traza: "traza",
};

// ─── Simplificación RDP (Ramer-Douglas-Peucker) ──────────────────────────────
function _distPerp(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < 1e-12) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / mag;
}
function _rdp(pts: number[][], eps: number): number[][] {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = _distPerp(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    return [..._rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ..._rdp(pts.slice(idx), eps)];
  }
  return [pts[0], pts[pts.length - 1]];
}
function _simplRing(ring: number[][], eps: number): number[][] {
  if (ring.length <= 4) return ring;
  // Strip closing duplicate if present
  const isClosed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = isClosed ? ring.slice(0, -1) : ring;
  const s = _rdp(open, eps);
  if (s.length < 3) return ring;
  return [...s, s[0]]; // Re-close
}
function simplificarGeometria(geojsonStr: string, eps = 0.0003): { result: string; antes: number; despues: number } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countV = (geom: any): number => {
    if (geom.type === "Polygon")
      return (geom.coordinates as number[][][]).reduce((a: number, r: number[][]) => a + r.length, 0);
    if (geom.type === "MultiPolygon")
      return (geom.coordinates as number[][][][]).reduce((a: number, p: number[][][]) => a + p.reduce((b: number, r: number[][]) => b + r.length, 0), 0);
    if (geom.type === "LineString")
      return (geom.coordinates as number[][]).length;
    if (geom.type === "MultiLineString")
      return (geom.coordinates as number[][][]).reduce((a: number, l: number[][]) => a + l.length, 0);
    return 0;
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geom: any = JSON.parse(geojsonStr);
    const antes = countV(geom);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let simplified: any;
    if (geom.type === "Polygon") {
      simplified = { ...geom, coordinates: geom.coordinates.map((r: number[][]) => _simplRing(r, eps)) };
    } else if (geom.type === "MultiPolygon") {
      simplified = { ...geom, coordinates: geom.coordinates.map((p: number[][][]) => p.map((r: number[][]) => _simplRing(r, eps))) };
    } else if (geom.type === "LineString") {
      const s = _rdp(geom.coordinates, eps);
      simplified = { ...geom, coordinates: s.length >= 2 ? s : geom.coordinates };
    } else if (geom.type === "MultiLineString") {
      simplified = {
        ...geom,
        coordinates: geom.coordinates.map((line: number[][]) => {
          const s = _rdp(line, eps);
          return s.length >= 2 ? s : line;
        }),
      };
    } else {
      return { result: geojsonStr, antes: 0, despues: 0 };
    }
    const despues = countV(simplified);
    return { result: JSON.stringify(simplified), antes, despues };
  } catch {
    return { result: geojsonStr, antes: 0, despues: 0 };
  }
}

const NIVELES_SIMPLIF = [
  { label: "Leve",   desc: "~5 m  · ajuste fino",       eps: 0.00005 },
  { label: "Media",  desc: "~33 m · recomendado",        eps: 0.0003  },
  { label: "Fuerte", desc: "~111 m · gran reducción",    eps: 0.001   },
  { label: "Máxima", desc: "~330 m · solo curvas clave", eps: 0.003   },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contarNodos(geoStr: string | null | undefined): number {
  if (!geoStr) return 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = JSON.parse(geoStr);
    if (g.type === "Polygon") return g.coordinates.reduce((a: number, r: number[][]) => a + r.length, 0);
    if (g.type === "MultiPolygon") return g.coordinates.reduce((a: number, p: number[][][]) => a + p.reduce((b: number, r: number[][]) => b + r.length, 0), 0);
    if (g.type === "LineString") return g.coordinates.length;
    if (g.type === "MultiLineString") return g.coordinates.reduce((a: number, l: number[][]) => a + l.length, 0);
  } catch { /* ignorar */ }
  return 0;
}

// ─── Simplificación para display (no modifica datos guardados) ───────────────
// Aplica RDP cuando el geometry tiene muchos nodos para que el mapa sea fluido.
// > 80 nodos → Fuerte (~111 m) para visualización rápida.
const CACHE_DISPLAY = new Map<string, string>();
function simplParaDisplay(geojsonStr: string): string {
  if (!geojsonStr) return geojsonStr;
  const nodos = contarNodos(geojsonStr);
  if (nodos <= 80) return geojsonStr;
  const cached = CACHE_DISPLAY.get(geojsonStr);
  if (cached) return cached;
  const eps = nodos > 500 ? 0.003 : nodos > 200 ? 0.001 : 0.0003; // Máxima / Fuerte / Media
  const { result } = simplificarGeometria(geojsonStr, eps);
  CACHE_DISPLAY.set(geojsonStr, result);
  return result;
}

// ─── Helpers polyclip ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMultiCoords(geom: any): number[][][][] {
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  throw new Error(`Tipo no soportado: ${geom.type}`);
}

function computarSolapamientos(recorridos: RecorridoGeo[]): string[] {
  const conArea = recorridos.filter((r) => r.activo && r.area_geojson);
  const resultados: string[] = [];
  for (let i = 0; i < conArea.length; i++) {
    for (let j = i + 1; j < conArea.length; j++) {
      try {
        const geomA = JSON.parse(conArea[i].area_geojson!);
        const geomB = JSON.parse(conArea[j].area_geojson!);
        const coordsA = toMultiCoords(geomA);
        const coordsB = toMultiCoords(geomB);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const interseccion = (polyclip as any).intersection(coordsA, coordsB) as number[][][][];
        if (interseccion && interseccion.length > 0) {
          const geom =
            interseccion.length === 1
              ? { type: "Polygon", coordinates: interseccion[0] }
              : { type: "MultiPolygon", coordinates: interseccion };
          resultados.push(JSON.stringify(geom));
        }
      } catch { /* ignorar pares problemáticos */ }
    }
  }
  return resultados;
}

export function VistaMapaClient({ recorridos }: VistaMapaClientProps) {
  const router = useRouter();
  const [recorridoActivoId, setRecorridoActivoId] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState<ModoEdicion>(null);
  const [geometriaTemporal, setGeometriaTemporal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [polygonBuscado, setPolygonBuscado] = useState<string | null>(null);
  const [polygonReemplazar, setPolygonReemplazar] = useState<string | null>(null);
  const [herramientaActiva, setHerramientaActiva] = useState<"lapiz" | "tijera" | null>(null);
  const [trazaReemplazar, setTrazaReemplazar] = useState<string | null>(null);
  const [mostrarNiveles, setMostrarNiveles] = useState(false);

  // Nuevos estados — mejoras
  const [capaSatelite, setCapaSatelite] = useState(false);
  const [zoomarAZona, setZoomarAZona] = useState<Zona | null>(null);
  const [mostrarZonas, setMostrarZonas] = useState(false);
  const [mostrarSolapamientos, setMostrarSolapamientos] = useState(false);
  const [solapamientos, setSolapamientos] = useState<string[]>([]);
  const [calculandoSolap, setCalculandoSolap] = useState(false);
  const [mostrarDashboard, setMostrarDashboard] = useState(false);

  // Undo: historial de geometrías temporales
  const historialGeometria = useRef<string[]>([]);
  const undoEnCurso = useRef(false);

  const recorridoActivo = recorridos.find((r) => r.id === recorridoActivoId) ?? null;
  const editando = modoEdicion !== null;

  // Recorridos con geometrías simplificadas para display (mejora fluidez)
  const recorridosDisplay = recorridos.map((r) => ({
    ...r,
    area_geojson: r.area_geojson ? simplParaDisplay(r.area_geojson) : r.area_geojson,
    traza_geojson: r.traza_geojson ? simplParaDisplay(r.traza_geojson) : r.traza_geojson,
  }));

  // ── Wrapper de onGeometriaChange con historial ──────────────────────────────
  const handleGeometriaChange = useCallback((geojson: string | null) => {
    if (!undoEnCurso.current) {
      setGeometriaTemporal((prev) => {
        if (prev !== null) {
          historialGeometria.current = [...historialGeometria.current, prev].slice(-25);
        }
        return geojson;
      });
    } else {
      undoEnCurso.current = false;
      setGeometriaTemporal(geojson);
    }
  }, []);

  // ── Ctrl+Z listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editando) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        deshacerEdicion();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  // ── Solapamientos: calcular cuando se activa ─────────────────────────────────
  useEffect(() => {
    if (!mostrarSolapamientos) {
      setSolapamientos([]);
      return;
    }
    setCalculandoSolap(true);
    // Diferir para no bloquear el render
    const t = setTimeout(() => {
      const result = computarSolapamientos(recorridos);
      setSolapamientos(result);
      setCalculandoSolap(false);
      if (result.length === 0) {
        toast.success("¡Sin solapamientos detectados entre rutas activas!");
      } else {
        toast.warning(`${result.length} zona${result.length > 1 ? "s" : ""} con solapamiento detectada${result.length > 1 ? "s" : ""}`);
      }
    }, 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarSolapamientos]);

  function seleccionarRecorrido(id: string) {
    if (editando) return;
    setRecorridoActivoId((prev) => (prev === id ? null : id));
  }

  function iniciarEdicion(modo: NonNullable<ModoEdicion>) {
    if (!recorridoActivoId) return;
    historialGeometria.current = [];
    setModoEdicion(modo);
    setGeometriaTemporal(null);
    // Limpiar estados residuales de sesiones previas
    setPolygonReemplazar(null);
    setTrazaReemplazar(null);

    // Auto-simplificar si la geometría tiene demasiados nodos para editar
    const geoStr = modo === "traza"
      ? recorridoActivo?.traza_geojson
      : recorridoActivo?.area_geojson;
    const nodos = contarNodos(geoStr);

    if (nodos > 200 && geoStr) {
      // Elegir nivel de simplificación según cantidad de nodos
      const eps = nodos > 600 ? 0.003   // Máxima — polígonos enormes de Nominatim
                : nodos > 300 ? 0.001   // Fuerte
                              : 0.0003; // Media
      const { result, despues } = simplificarGeometria(geoStr, eps);
      toast.info(
        `Geometría simplificada automáticamente: ${nodos} → ${despues} nodos. Guardá para aplicarlo.`,
        { duration: 6000 }
      );
      // Cargar versión simplificada en el editor
      if (modo === "traza") setTrazaReemplazar(result);
      else setPolygonReemplazar(result);
    }
  }

  function cancelarEdicion() {
    setModoEdicion(null);
    setGeometriaTemporal(null);
    setHerramientaActiva(null);
    setPolygonReemplazar(null);
    setTrazaReemplazar(null);
    historialGeometria.current = [];
  }

  function deshacerEdicion() {
    const hist = historialGeometria.current;
    if (hist.length === 0) return;
    const prev = hist[hist.length - 1];
    historialGeometria.current = hist.slice(0, -1);
    undoEnCurso.current = true;
    setPolygonReemplazar(prev);
    setGeometriaTemporal(prev);
  }

  function handleSimplificar(eps: number) {
    setMostrarNiveles(false);
    const esTraza = modoEdicion === "traza";
    const fallback = esTraza ? recorridoActivo?.traza_geojson : recorridoActivo?.area_geojson;
    const currentGeoStr = geometriaTemporal ?? fallback;
    if (!currentGeoStr) {
      toast.error(`No hay ${esTraza ? "traza" : "área"} para simplificar`);
      return;
    }
    const { result, antes, despues } = simplificarGeometria(currentGeoStr, eps);
    if (antes === 0 || antes === despues) {
      toast.info("No se redujo ningún vértice. Probá un nivel mayor.");
      return;
    }
    toast.success(`Simplificado: ${antes} → ${despues} nodos (−${antes - despues})`);
    if (esTraza) {
      setTrazaReemplazar(result);
    } else {
      setPolygonReemplazar(result);
    }
  }

  async function guardarEdicion() {
    if (!recorridoActivoId || !geometriaTemporal || !modoEdicion) return;
    setGuardando(true);
    try {
      const fn =
        modoEdicion === "area" ? actualizarAreaRecorrido : actualizarTrazaRecorrido;
      const result = await fn(recorridoActivoId, geometriaTemporal);

      if (!result.ok) {
        toast.error(`Error al guardar ${LABELS_MODO[modoEdicion]}`, {
          description: result.error,
        });
      } else {
        toast.success(`${LABELS_MODO[modoEdicion].charAt(0).toUpperCase() + LABELS_MODO[modoEdicion].slice(1)} guardada correctamente`);
        setModoEdicion(null);
        setGeometriaTemporal(null);
        setPolygonReemplazar(null);
        setTrazaReemplazar(null);
        historialGeometria.current = [];
        router.refresh();
      }
    } finally {
      setGuardando(false);
    }
  }

  function handleEliminarZona(geojsonStrRestar: string) {
    const currentGeoStr = geometriaTemporal ?? recorridoActivo?.area_geojson;
    if (!currentGeoStr) {
      toast.error("No hay área cargada para restarle una zona");
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentGeom = JSON.parse(currentGeoStr) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subtractGeom = JSON.parse(geojsonStrRestar) as any;

      const baseCoords = toMultiCoords(currentGeom);
      const subtractCoords = toMultiCoords(subtractGeom);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultCoords = (polyclip as any).difference(baseCoords, subtractCoords) as number[][][][];

      if (!resultCoords || resultCoords.length === 0) {
        toast.error("La zona seleccionada cubre toda el área — no quedaría nada.");
        return;
      }

      const resultGeom =
        resultCoords.length === 1
          ? { type: "Polygon", coordinates: resultCoords[0] }
          : { type: "MultiPolygon", coordinates: resultCoords };

      setPolygonReemplazar(JSON.stringify(resultGeom));
    } catch (e) {
      toast.error(`Error al calcular la diferencia: ${String(e)}`);
    }
  }

  async function handleImprimirRecorrido() {
    if (!recorridoActivo) return;
    try {
      const el = document.getElementById("mapa-contenedor");
      if (!el) throw new Error("No se encontró el mapa");
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        filter: (node) =>
          !(node instanceof HTMLElement && node.hasAttribute("data-no-export")),
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const PW = pdf.internal.pageSize.getWidth();
      const PH = pdf.internal.pageSize.getHeight();
      const M = 8;
      // Cabecera
      pdf.setFillColor(recorridoActivo.color);
      pdf.roundedRect(M, M, 6, 6, 1.5, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(recorridoActivo.codigo, M + 9, M + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(80);
      pdf.text(recorridoActivo.nombre, M + 9, M + 10.5);
      pdf.setFontSize(7.5);
      pdf.text(`Zona: ${recorridoActivo.zona} · Tipo: ${recorridoActivo.tipo}`, M + 9, M + 15.5);
      if (recorridoActivo.descripcion) {
        pdf.text(recorridoActivo.descripcion.slice(0, 80), M + 9, M + 20);
      }
      pdf.setTextColor(0);
      // Mapa
      const MAP_Y = M + 26;
      const MAP_W = PW - M * 2;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const MAP_H = Math.min(MAP_W / imgRatio, PH - MAP_Y - M);
      pdf.addImage(dataUrl, "PNG", M, MAP_Y, MAP_W, MAP_H);
      pdf.setDrawColor(200);
      pdf.rect(M, MAP_Y, MAP_W, MAP_H);
      // Pie
      pdf.setFontSize(6);
      pdf.setTextColor(160);
      const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
      pdf.text(`RutaMap · Generado el ${fecha}`, M, PH - 3);
      pdf.save(`rutamap-${recorridoActivo.codigo}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF del recorrido exportado");
    } catch (e) {
      toast.error("Error al generar PDF", { description: String(e) });
    }
  }

  function handleZoomarAZona(zona: Zona) {
    setMostrarZonas(false);
    // Trigger zoom — si ya era la misma zona, setear null primero para re-triggerear
    setZoomarAZona(null);
    setTimeout(() => setZoomarAZona(zona), 10);
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <PanelLateral
        recorridos={recorridos}
        recorridoActivoId={recorridoActivoId}
        onSelectRecorrido={seleccionarRecorrido}
      />

      <div id="mapa-contenedor" className="flex-1 relative">
        <MapaWrapper
          recorridos={recorridosDisplay}
          recorridoActivo={recorridoActivo}
          onSelectRecorrido={seleccionarRecorrido}
          modoEdicion={modoEdicion}
          recorridoEditando={recorridoActivo}
          onGeometriaChange={handleGeometriaChange}
          polygonAgregar={polygonBuscado}
          onPolygonAgregado={() => setPolygonBuscado(null)}
          polygonReemplazar={polygonReemplazar}
          onPolygonReemplazado={() => setPolygonReemplazar(null)}
          trazaReemplazar={trazaReemplazar}
          onTrazaReemplazada={() => setTrazaReemplazar(null)}
          herramientaActiva={herramientaActiva}
          onHerramientaFin={() => setHerramientaActiva(null)}
          capaSatelite={capaSatelite}
          zoomarAZona={zoomarAZona}
          solapamientos={mostrarSolapamientos ? solapamientos : []}
          onClickMapa={() => { setMostrarZonas(false); setMostrarDashboard(false); }}
        />

        {/* Buscador de localidades — solo visible al editar área */}
        {modoEdicion === "area" && (
          <BuscadorLocalidad
            onPolygonEncontrado={(geojsonStr) => setPolygonBuscado(geojsonStr)}
            onPolygonEliminar={(geojsonStr) => handleEliminarZona(geojsonStr)}
          />
        )}

        {/* Botones de exportar — ocultos durante edición */}
        <ExportarMapa recorridos={recorridos} oculto={editando} />

        {/* Controles flotantes superiores derechos */}
        {!editando && (
          <div
            data-no-export
            className="absolute top-3 right-3 z-[900] flex flex-col gap-1.5 items-end"
          >
            {/* Toggle mapa/satélite */}
            <Button
              size="sm"
              variant="secondary"
              className={cn(
                "shadow-md gap-1.5 h-8 text-xs",
                capaSatelite && "bg-blue-600 text-white hover:bg-blue-700"
              )}
              onClick={() => setCapaSatelite((v) => !v)}
              title={capaSatelite ? "Volver a mapa de calles" : "Ver imagen satelital"}
            >
              {capaSatelite ? <MapIcon className="h-3.5 w-3.5" /> : <Satellite className="h-3.5 w-3.5" />}
              {capaSatelite ? "Mapa" : "Satélite"}
            </Button>

            {/* Zoom por zona */}
            <div className="relative">
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "shadow-md gap-1.5 h-8 text-xs",
                  mostrarZonas && "bg-slate-700 text-white hover:bg-slate-800"
                )}
                onClick={() => setMostrarZonas((v) => !v)}
                title="Ir a una zona"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                Zona
              </Button>
              {mostrarZonas && (
                <div className="absolute right-0 top-9 z-50 bg-background border rounded-lg shadow-md py-1 min-w-[100px]">
                  {ZONAS.map((zona) => (
                    <button
                      key={zona}
                      onClick={() => handleZoomarAZona(zona)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      {zona}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detectar solapamientos */}
            <Button
              size="sm"
              variant="secondary"
              className={cn(
                "shadow-md gap-1.5 h-8 text-xs",
                mostrarSolapamientos && "bg-red-500 text-white hover:bg-red-600"
              )}
              onClick={() => setMostrarSolapamientos((v) => !v)}
              disabled={calculandoSolap}
              title="Detectar zonas donde se solapan dos recorridos"
            >
              <Layers className="h-3.5 w-3.5" />
              {calculandoSolap ? "Calculando…" : mostrarSolapamientos ? "Ocultar solap." : "Solapamientos"}
            </Button>

            {/* Dashboard de cobertura */}
            <Button
              size="sm"
              variant="secondary"
              className={cn(
                "shadow-md gap-1.5 h-8 text-xs",
                mostrarDashboard && "bg-slate-700 text-white hover:bg-slate-800"
              )}
              onClick={() => setMostrarDashboard((v) => !v)}
              title="Ver estadísticas de cobertura"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Stats
            </Button>
          </div>
        )}

        {/* Dashboard de cobertura */}
        {mostrarDashboard && (
          <DashboardCobertura
            recorridos={recorridos}
            onCerrar={() => setMostrarDashboard(false)}
          />
        )}

        {/* Barra flotante de guardado — visible solo en modo edición */}
        {editando && recorridoActivo && (() => {
          const geoActual = geometriaTemporal ?? (modoEdicion === "traza" ? recorridoActivo.traza_geojson : recorridoActivo.area_geojson);
          const nodos = contarNodos(geoActual);
          return (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[900] flex items-center gap-2 rounded-xl bg-background/95 backdrop-blur-sm border shadow-lg px-4 py-2.5">
            {/* Indicador */}
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-foreground">
                Editando <span className="font-medium">{LABELS_MODO[modoEdicion!]}</span>:{" "}
                <span className="font-semibold">{recorridoActivo.codigo}</span>
              </span>
              {nodos > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full tabular-nums">
                  {nodos} nodos
                </span>
              )}
            </div>

            {/* Herramientas lápiz/tijera — solo en modo área */}
            {modoEdicion === "area" && (
              <>
                <div className="w-px h-5 bg-border mx-1" />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={guardando || herramientaActiva === "tijera"}
                  onClick={() => setHerramientaActiva(herramientaActiva === "lapiz" ? null : "lapiz")}
                  className={cn(
                    "h-8 gap-1.5 text-xs",
                    herramientaActiva === "lapiz" && "border-blue-400 bg-blue-50 text-blue-700"
                  )}
                  title="Dibujá una zona en el mapa para agregarla al área"
                >
                  <Pencil className="h-3 w-3" />
                  {herramientaActiva === "lapiz" ? "Dibujando…" : "Dibujar zona"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={guardando || herramientaActiva === "lapiz"}
                  onClick={() => setHerramientaActiva(herramientaActiva === "tijera" ? null : "tijera")}
                  className={cn(
                    "h-8 gap-1.5 text-xs",
                    herramientaActiva === "tijera" && "border-orange-400 bg-orange-50 text-orange-700"
                  )}
                  title="Dibujá una zona en el mapa para recortarla del área"
                >
                  <Scissors className="h-3 w-3" />
                  {herramientaActiva === "tijera" ? "Recortando…" : "Recortar zona"}
                </Button>

                {/* Importar desde archivo */}
                <div className="w-px h-5 bg-border mx-1" />
                <ImportarArea
                  onGeometriaImportada={(geojsonStr) => setPolygonBuscado(geojsonStr)}
                />
              </>
            )}

            {/* Simplificar geometría — área Y traza */}
            <div className="w-px h-5 bg-border mx-1" />
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrarNiveles((v) => !v)}
                disabled={guardando}
                className={cn(
                  "h-8 gap-1.5 text-xs border-violet-300 text-violet-700 hover:bg-violet-50",
                  mostrarNiveles && "bg-violet-50 border-violet-400"
                )}
                title="Reducir vértices. Clic para elegir intensidad. Clic derecho sobre un nodo para eliminarlo."
              >
                <Wand2 className="h-3 w-3" />
                Simplificar
              </Button>
              {mostrarNiveles && (
                <div className="absolute bottom-9 left-0 z-50 bg-background border rounded-lg shadow-lg py-1 min-w-[210px]">
                  <p className="px-3 pt-1 pb-1.5 text-[10px] text-muted-foreground border-b">
                    Elegí la intensidad de reducción:
                  </p>
                  {NIVELES_SIMPLIF.map((n) => (
                    <button
                      key={n.label}
                      onClick={() => handleSimplificar(n.eps)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <span className="font-semibold text-violet-700 w-12">{n.label}</span>
                      <span className="text-muted-foreground">{n.desc}</span>
                    </button>
                  ))}
                  <p className="px-3 pt-1.5 pb-1 text-[10px] text-muted-foreground border-t">
                    💡 Clic derecho en un nodo para eliminarlo
                  </p>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-border mx-1" />

            {/* Deshacer */}
            <Button
              variant="outline"
              size="sm"
              onClick={deshacerEdicion}
              disabled={guardando || historialGeometria.current.length === 0}
              className="h-8 gap-1.5 text-xs"
              title="Deshacer último cambio (Ctrl+Z)"
            >
              <Undo2 className="h-3 w-3" />
              Deshacer
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={cancelarEdicion}
              disabled={guardando}
              className="h-8"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={guardarEdicion}
              disabled={guardando || !geometriaTemporal}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
          );
        })()}
      </div>

      {recorridoActivo && (
        <PanelDetalle
          recorrido={recorridoActivo}
          onCerrar={() => {
            if (!editando) setRecorridoActivoId(null);
          }}
          onIniciarEdicionArea={() => iniciarEdicion("area")}
          onIniciarEdicionTraza={() => iniciarEdicion("traza")}
          modoEdicion={modoEdicion}
          onImprimirRecorrido={handleImprimirRecorrido}
        />
      )}
    </div>
  );
}
