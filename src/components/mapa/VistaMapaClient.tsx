"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as turf from "@turf/turf";
import { PanelLateral } from "./PanelLateral";
import { PanelDetalle } from "./PanelDetalle";
import { MapaWrapper } from "./MapaWrapper";
import { ExportarMapa } from "./ExportarMapa";
import { BuscadorLocalidad } from "./BuscadorLocalidad";
import { DashboardCobertura } from "./DashboardCobertura";
import { Button } from "@/components/ui/button";
import {
  Pencil, Scissors, Undo2, Satellite, Map as MapIcon,
  Layers, BarChart2, ZoomIn, Wand2, Trash2, PenTool, Flame, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { actualizarAreaRecorrido, actualizarTrazaRecorrido } from "@/app/actions/recorridos";
import { getCalorRecorridos, type CalorRecorrido } from "@/app/actions/volumenes";
import { PALETA } from "@/lib/estados";
import type { ModoEdicion } from "./MapaLeaflet";
import type { RecorridoGeo, Zona } from "@/types/database.types";
import { ZONAS } from "@/types/database.types";
import { hoyAR } from "@/lib/fechas";

// ── Calor de volumen: color por promedio de paquetes del recorrido ──────────
// Bandas alineadas con la operación (objetivo ~30 pkg/chofer)
const CALOR_BANDAS = [
  { max: 0,        color: PALETA.gris,  label: "Sin datos" },
  { max: 24.999,   color: PALETA.azul,  label: "Bajo (<25)" },
  { max: 35,       color: PALETA.verde, label: "Óptimo (25–35)" },
  { max: 40,       color: PALETA.ambar, label: "Alto (35–40)" },
  { max: Infinity, color: PALETA.rojo,  label: "Sobrecarga (>40)" },
];
function colorCalor(prom: number | undefined): string {
  if (!prom || prom <= 0) return PALETA.gris;
  for (const b of CALOR_BANDAS) if (prom <= b.max) return b.color;
  return PALETA.rojo;
}

interface VistaMapaClientProps {
  recorridos: RecorridoGeo[];
  puedeEditar?: boolean;
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

// ─── Turf helpers ─────────────────────────────────────────────────────────────

/** Simplifica una geometría GeoJSON con turf.simplify. Devuelve el string de la geometría. */
function simplificarConTurf(geojsonStr: string, tolerance = 0.001): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geom: any = JSON.parse(geojsonStr);
    const feature = geom.type === "Feature" ? geom : turf.feature(geom);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simplified = turf.simplify(feature as any, {
      tolerance,
      highQuality: true,
    });
    return JSON.stringify(simplified.geometry);
  } catch {
    return geojsonStr;
  }
}

/** Unifica dos geometrías GeoJSON con turf.union. Devuelve null si falla. */
function unionConTurf(strA: string, strB: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geomA: any = JSON.parse(strA);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geomB: any = JSON.parse(strB);
    const featA = geomA.type === "Feature" ? geomA : turf.feature(geomA);
    const featB = geomB.type === "Feature" ? geomB : turf.feature(geomB);
    const result = turf.union(turf.featureCollection([featA, featB]));
    if (!result) return null;
    return JSON.stringify(result.geometry);
  } catch {
    return null;
  }
}

/** Resta strB de strA con turf.difference. Devuelve null si falla o queda vacío. */
function diferenciaTurf(strA: string, strB: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geomA: any = JSON.parse(strA);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geomB: any = JSON.parse(strB);
    const featA = geomA.type === "Feature" ? geomA : turf.feature(geomA);
    const featB = geomB.type === "Feature" ? geomB : turf.feature(geomB);
    const result = turf.difference(turf.featureCollection([featA, featB]));
    if (!result) return null;
    return JSON.stringify(result.geometry);
  } catch {
    return null;
  }
}

// ─── Simplificación para display (no modifica datos guardados) ───────────────
const CACHE_DISPLAY = new Map<string, string>();
function simplParaDisplay(geojsonStr: string): string {
  if (!geojsonStr) return geojsonStr;
  const nodos = contarNodos(geojsonStr);
  if (nodos <= 80) return geojsonStr;
  const cached = CACHE_DISPLAY.get(geojsonStr);
  if (cached) return cached;
  const tolerance = nodos > 500 ? 0.003 : nodos > 200 ? 0.001 : 0.0003;
  const result = simplificarConTurf(geojsonStr, tolerance);
  CACHE_DISPLAY.set(geojsonStr, result);
  return result;
}

function computarSolapamientos(recorridos: RecorridoGeo[]): string[] {
  const conArea = recorridos.filter((r) => r.activo && r.area_geojson);
  const resultados: string[] = [];
  for (let i = 0; i < conArea.length; i++) {
    for (let j = i + 1; j < conArea.length; j++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geomA: any = JSON.parse(conArea[i].area_geojson!);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geomB: any = JSON.parse(conArea[j].area_geojson!);
        const featA = geomA.type === "Feature" ? geomA : turf.feature(geomA);
        const featB = geomB.type === "Feature" ? geomB : turf.feature(geomB);
        const interseccion = turf.intersect(turf.featureCollection([featA, featB]));
        if (interseccion) {
          resultados.push(JSON.stringify(interseccion.geometry));
        }
      } catch { /* ignorar pares problemáticos */ }
    }
  }
  return resultados;
}

export function VistaMapaClient({ recorridos, puedeEditar = true }: VistaMapaClientProps) {
  const router = useRouter();
  const [recorridoActivoId, setRecorridoActivoId] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState<ModoEdicion>(null);
  const [visibles, setVisibles] = useState<Set<string>>(new Set());
  const [modoPluma, setModoPluma] = useState<"agregar" | "quitar" | null>(null);
  const [modoEditarNodos, setModoEditarNodos] = useState(false);
  const [geometriaTemporal, setGeometriaTemporal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [polygonBuscado, setPolygonBuscado] = useState<string | null>(null);
  const [polygonReemplazar, setPolygonReemplazar] = useState<string | null>(null);
  const [herramientaActiva, setHerramientaActiva] = useState<"lapiz" | "tijera" | null>(null);
  const [trazaReemplazar, setTrazaReemplazar] = useState<string | null>(null);
  const [mostrarNiveles, setMostrarNiveles] = useState(false);
  // Trigger para "Vaciar" — incrementar fuerza al editor a limpiar todo
  const [vaciarTrigger, setVaciarTrigger] = useState(0);

  // Nuevos estados — mejoras
  const [capaSatelite, setCapaSatelite] = useState(false);
  const [zoomarAZona, setZoomarAZona] = useState<Zona | null>(null);
  const [mostrarZonas, setMostrarZonas] = useState(false);
  const [mostrarSolapamientos, setMostrarSolapamientos] = useState(false);
  const [solapamientos, setSolapamientos] = useState<string[]>([]);
  const [calculandoSolap, setCalculandoSolap] = useState(false);
  const [mostrarDashboard, setMostrarDashboard] = useState(false);

  // Calor de volumen (solo logueados — dato operativo privado)
  const [mostrarCalor, setMostrarCalor] = useState(false);
  const [calorMap, setCalorMap] = useState<Record<string, CalorRecorrido>>({});
  const [cargandoCalor, setCargandoCalor] = useState(false);

  // Undo: historial de geometrías temporales
  const historialGeometria = useRef<string[]>([]);
  const undoEnCurso = useRef(false);
  // Ref de seguridad: última geometría válida conocida (backup ante race conditions)
  const ultimaGeometriaRef = useRef<string | null>(null);
  // Espejo síncrono de geometriaTemporal — para apilar historial sin depender
  // del updater de React (que puede ejecutarse 2 veces o batchear).
  const geometriaTemporalRef = useRef<string | null>(null);

  const recorridoActivo = recorridos.find((r) => r.id === recorridoActivoId) ?? null;
  const editando = modoEdicion !== null;

  // Recorridos con geometrías simplificadas para display (memoizado — evita
  // re-simplificar TODO el array en cada render)
  const recorridosDisplay = useMemo(
    () => recorridos.map((r) => ({
      ...r,
      area_geojson: r.area_geojson ? simplParaDisplay(r.area_geojson) : r.area_geojson,
      traza_geojson: r.traza_geojson ? simplParaDisplay(r.traza_geojson) : r.traza_geojson,
    })),
    [recorridos]
  );

  // Recorridos a mostrar en el mapa: siempre el activo + los marcados como visibles.
  // En modo calor: TODOS los que tienen área, recoloreados por volumen.
  const recorridosParaMapa = useMemo(() => {
    if (mostrarCalor) {
      return recorridosDisplay
        .filter((r) => r.area_geojson)
        .map((r) => {
          const prom = calorMap[r.id]?.prom_paquetes;
          return {
            ...r,
            color: colorCalor(prom),
            // El tooltip muestra el código; le sumo el promedio de paquetes
            codigo: prom && prom > 0 ? `${r.codigo} · ${prom}` : `${r.codigo} · s/d`,
          };
        });
    }
    return recorridosDisplay.filter((r) => r.id === recorridoActivoId || visibles.has(r.id));
  }, [recorridosDisplay, recorridoActivoId, visibles, mostrarCalor, calorMap]);

  // ── Cargar datos de calor al activar ────────────────────────────────────────
  useEffect(() => {
    if (!mostrarCalor) return;
    let cancel = false;
    setCargandoCalor(true);
    getCalorRecorridos(30)
      .then((res) => {
        if (cancel) return;
        if (!res.ok) { toast.error("No se pudo cargar el calor de volumen", { description: res.error }); return; }
        const m: Record<string, CalorRecorrido> = {};
        (res.data ?? []).forEach((c) => { m[c.recorrido_id] = c; });
        setCalorMap(m);
        if ((res.data ?? []).length === 0) {
          toast.info("Todavía no hay datos de operación cargados para mostrar el calor");
        }
      })
      .finally(() => { if (!cancel) setCargandoCalor(false); });
    return () => { cancel = true; };
  }, [mostrarCalor]);

  // ── Wrapper de onGeometriaChange con historial robusto ──────────────────────
  const handleGeometriaChange = useCallback((geojson: string | null) => {
    // Guardar la última geometría válida en ref (backup ante lag de estado)
    if (geojson !== null) ultimaGeometriaRef.current = geojson;

    if (undoEnCurso.current) {
      // Esta emisión proviene de un "deshacer": no apilar en el historial
      undoEnCurso.current = false;
    } else {
      const prev = geometriaTemporalRef.current;
      // Apilar el estado anterior SOLO si realmente cambió (dedup: evita
      // entradas dobles cuando Geoman + handle custom emiten lo mismo)
      if (prev !== null && prev !== geojson) {
        historialGeometria.current = [...historialGeometria.current, prev].slice(-30);
      }
    }
    geometriaTemporalRef.current = geojson;
    setGeometriaTemporal(geojson);
  }, []);

  // ── Atajos de teclado: Ctrl+Z deshacer · Esc cerrar ─────────────────────────
  useEffect(() => {
    if (!editando) return;
    function onKeyDown(e: KeyboardEvent) {
      // Ignorar si el foco está en un input (buscador de localidades)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        deshacerEdicion();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelarEdicion();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  function handleVaciar() {
    historialGeometria.current = [];
    geometriaTemporalRef.current = null;
    ultimaGeometriaRef.current = null;
    setGeometriaTemporal(null);
    setVaciarTrigger((v) => v + 1);
    toast.info("Área vaciada. Dibujá o buscá localidades para empezar de nuevo.");
  }

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
    // Show selected route on map automatically
    setVisibles((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function iniciarEdicion(modo: NonNullable<ModoEdicion>) {
    if (!recorridoActivoId) return;
    historialGeometria.current = [];
    // CRÍTICO: resetear refs para no contaminar con la geometría del recorrido anterior
    ultimaGeometriaRef.current = null;
    geometriaTemporalRef.current = null;
    undoEnCurso.current = false;
    setModoEdicion(modo);
    setGeometriaTemporal(null);
    // Limpiar estados residuales de sesiones previas
    setPolygonReemplazar(null);
    setTrazaReemplazar(null);

    // Informar si hay muchos nodos (la simplificación la hace el editor directamente)
    const geoStr = modo === "traza"
      ? recorridoActivo?.traza_geojson
      : recorridoActivo?.area_geojson;
    const nodos = contarNodos(geoStr);
    if (nodos > 100) {
      toast.info(
        `Geometría simplificada para edición (${nodos} nodos originales). Guardá para aplicarlo permanentemente.`,
        { duration: 5000 }
      );
    }
  }

  function cancelarEdicion() {
    setModoEdicion(null);
    setGeometriaTemporal(null);
    setHerramientaActiva(null);
    setModoPluma(null);
    setModoEditarNodos(false);
    setPolygonReemplazar(null);
    setTrazaReemplazar(null);
    historialGeometria.current = [];
    ultimaGeometriaRef.current = null;
    geometriaTemporalRef.current = null;
    undoEnCurso.current = false;
  }

  function deshacerEdicion() {
    const hist = historialGeometria.current;
    if (hist.length === 0) {
      toast.info("No hay más pasos para deshacer");
      return;
    }
    const prev = hist[hist.length - 1];
    historialGeometria.current = hist.slice(0, -1);
    undoEnCurso.current = true;
    // Sincronizar el espejo para que el próximo cambio apile bien
    geometriaTemporalRef.current = prev;
    // NO desactivamos modoEditarNodos: el efecto de reemplazo refresca
    // los handles de nodos automáticamente, manteniendo el modo de edición activo.
    // El estado de reemplazo correcto depende de qué se está editando: el editor
    // de trazas solo reacciona a trazaReemplazar (y viceversa).
    if (modoEdicion === "traza") {
      setTrazaReemplazar(prev);
    } else {
      setPolygonReemplazar(prev);
    }
    setGeometriaTemporal(prev);
    toast.success(`Deshecho · quedan ${hist.length - 1} paso${hist.length - 1 === 1 ? "" : "s"}`, { duration: 1500 });
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
    if (!recorridoActivoId || !modoEdicion) return;
    // Preferir el ref síncrono (siempre actual) sobre el state (puede tener lag),
    // y caer al backup solo si ninguno está disponible.
    const geoAGuardar = geometriaTemporalRef.current ?? geometriaTemporal ?? ultimaGeometriaRef.current;
    if (!geoAGuardar) {
      toast.error("No hay área para guardar. Dibujá o agregá una zona primero.");
      return;
    }
    setGuardando(true);
    try {
      const fn =
        modoEdicion === "area" ? actualizarAreaRecorrido : actualizarTrazaRecorrido;
      const result = await fn(recorridoActivoId, geoAGuardar);

      if (!result.ok) {
        toast.error(`Error al guardar ${LABELS_MODO[modoEdicion]}`, {
          description: result.error,
        });
      } else {
        toast.success(`${LABELS_MODO[modoEdicion].charAt(0).toUpperCase() + LABELS_MODO[modoEdicion].slice(1)} guardada correctamente`);
        setModoEdicion(null);
        setGeometriaTemporal(null);
        setModoPluma(null);
        setModoEditarNodos(false);
        setPolygonReemplazar(null);
        setTrazaReemplazar(null);
        historialGeometria.current = [];
        ultimaGeometriaRef.current = null;
        geometriaTemporalRef.current = null;
        undoEnCurso.current = false;
        router.refresh();
      }
    } finally {
      setGuardando(false);
    }
  }

  function handleEliminarZona(geojsonStrRestar: string) {
    const currentGeoStr = geometriaTemporal ?? ultimaGeometriaRef.current ?? recorridoActivo?.area_geojson;
    if (!currentGeoStr) {
      toast.error("No hay área cargada para restarle una zona");
      return;
    }
    const simplificado = simplificarConTurf(geojsonStrRestar, 0.001);
    const result = diferenciaTurf(currentGeoStr, simplificado);
    if (!result) {
      toast.error("La zona seleccionada cubre toda el área. Si la agregaste recién, usá Ctrl+Z o el botón Deshacer para recuperarla.");
      return;
    }
    setPolygonReemplazar(result);
    toast.info("Zona restada. Si fue sin querer → Ctrl+Z o botón Deshacer ↩", { duration: 6000 });
  }

  async function handleImprimirRecorrido() {
    if (!recorridoActivo) return;
    try {
      const el = document.getElementById("mapa-contenedor");
      if (!el) throw new Error("No se encontró el mapa");
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
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
      pdf.save(`rutamap-${recorridoActivo.codigo}-${hoyAR()}.pdf`);
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

  const toggleVisible = useCallback((id: string) => {
    setVisibles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const mostrarZonaEnMapa = useCallback((zona: Zona) => {
    const ids = recorridos.filter((r) => r.zona === zona).map((r) => r.id);
    setVisibles((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [recorridos]);

  const mostrarTodo = useCallback((ids?: string[]) => {
    // Si llegan IDs (los filtrados del panel), mostrar solo esos. Si no, todos.
    setVisibles(new Set(ids ?? recorridos.map((r) => r.id)));
  }, [recorridos]);

  const ocultarTodo = useCallback(() => {
    setVisibles(new Set());
  }, []);

  function handleAgregarLocalidad(geojsonStr: string) {
    // 1. Simplificar agresivamente la localidad entrante (GBA ~100 m)
    const simplificado = simplificarConTurf(geojsonStr, 0.001);
    const nodosBefore = contarNodos(geojsonStr);
    const nodosAfter = contarNodos(simplificado);
    console.log(`[RutaMap] Localidad: ${nodosBefore} → ${nodosAfter} nodos`);

    // 2. Si ya hay geometría, unir con turf.union para eliminar la línea del medio
    // IMPORTANTE: usar ultimaGeometriaRef como fallback intermedio para no perder
    // cambios recientes que aún no se reflejaron en geometriaTemporal (state lag).
    const existingStr = geometriaTemporal ?? ultimaGeometriaRef.current ?? recorridoActivo?.area_geojson;
    if (existingStr) {
      const unido = unionConTurf(existingStr, simplificado);
      if (unido) {
        // 3. Simplificar el resultado de la unión para eliminar nodos extra
        //    que turf genera en los bordes donde se tocan los polígonos
        const unidoSimpl = simplificarConTurf(unido, 0.0003);
        const nodosFinales = contarNodos(unidoSimpl);
        console.log(`[RutaMap] Unión resultado: ${nodosFinales} nodos`);
        toast.success(`Localidad fusionada (${nodosFinales} nodos)`);
        setPolygonReemplazar(unidoSimpl);
        return;
      }
      toast.warning("No se pudo fusionar — se agregó como pieza separada.");
    } else {
      toast.success(`Localidad cargada (${nodosAfter} nodos)`);
    }
    setPolygonBuscado(simplificado);
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <PanelLateral
        recorridos={recorridos}
        recorridoActivoId={recorridoActivoId}
        onSelectRecorrido={seleccionarRecorrido}
        visibles={visibles}
        onToggleVisible={toggleVisible}
        onMostrarZona={mostrarZonaEnMapa}
        onOcultarTodo={ocultarTodo}
        onMostrarTodo={mostrarTodo}
        puedeEditar={puedeEditar}
      />

      <div id="mapa-contenedor" className="flex-1 relative">
        <MapaWrapper
          recorridos={recorridosParaMapa}
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
          modoPluma={modoPluma}
          modoEditarNodos={modoEditarNodos}
          vaciarTrigger={vaciarTrigger}
        />

        {/* Buscador de localidades — solo visible al editar área */}
        {modoEdicion === "area" && (
          <BuscadorLocalidad
            onPolygonEncontrado={handleAgregarLocalidad}
            onPolygonEliminar={handleEliminarZona}
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

            {/* Calor de volumen — solo usuarios logueados (dato operativo privado) */}
            {puedeEditar && (
              <Button
                size="sm"
                variant="secondary"
                className={cn(
                  "shadow-md gap-1.5 h-8 text-xs",
                  mostrarCalor && "bg-orange-600 text-white hover:bg-orange-700"
                )}
                onClick={() => setMostrarCalor((v) => !v)}
                disabled={cargandoCalor}
                title="Colorear los recorridos según el volumen de paquetes (últimos 30 días)"
              >
                <Flame className="h-3.5 w-3.5" />
                {cargandoCalor ? "Cargando…" : mostrarCalor ? "Ocultar calor" : "Calor volumen"}
              </Button>
            )}
          </div>
        )}

        {/* ══════ Leyenda del calor de volumen ══════ */}
        {mostrarCalor && !editando && (
          <div
            data-no-export
            className="absolute bottom-6 left-3 z-[900] bg-background/97 backdrop-blur-sm border rounded-xl shadow-lg p-3 w-56"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="h-3.5 w-3.5 text-orange-600 dark:text-orange-300" />
              <p className="text-xs font-bold">Calor de volumen</p>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
              Promedio de paquetes por recorrido — últimos 30 días de operación.
            </p>
            <div className="space-y-1">
              {CALOR_BANDAS.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-[10px]">
                  <span className="inline-block w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="text-muted-foreground">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground border-t pt-1.5 mt-2 tabular-nums">
              {Object.keys(calorMap).length} recorridos con datos
            </p>
          </div>
        )}

        {/* Dashboard de cobertura */}
        {mostrarDashboard && (
          <DashboardCobertura
            recorridos={recorridos}
            onCerrar={() => setMostrarDashboard(false)}
          />
        )}

        {/* ══════ Barra flotante de edición — estética ámbar ══════ */}
        {editando && recorridoActivo && (() => {
          const geoActual = geometriaTemporalRef.current ?? geometriaTemporal ?? (modoEdicion === "traza" ? recorridoActivo.traza_geojson : recorridoActivo.area_geojson);
          const nodos = contarNodos(geoActual);

          // Instrucción contextual según el modo activo
          let instruccion: string;
          if (herramientaActiva === "lapiz") instruccion = "Hacé clic en el mapa para marcar cada punto · doble clic para cerrar · se unirá con el área existente";
          else if (herramientaActiva === "tijera") instruccion = "Dibujá una zona sobre el área para recortarla";
          else if (modoPluma === "agregar") instruccion = "Clic sobre la LÍNEA del polígono (entre dos puntos) para insertar un nodo";
          else if (modoPluma === "quitar") instruccion = "Clic sobre un punto para eliminarlo";
          else if (modoEditarNodos) instruccion = "Arrastrá los puntos para moverlos · el resultado queda donde lo dejes";
          else instruccion = "Arrastrá vértices = mover · clic derecho vértice = borrar · clic derecho línea = insertar · Ctrl+Z deshacer · Esc cerrar";

          return (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[900] w-[min(94vw,640px)] rounded-2xl bg-amber-50/97 dark:bg-amber-950/40 backdrop-blur-sm border-2 border-amber-300 dark:border-amber-800 shadow-xl overflow-hidden">

            {/* ── Cabecera ── */}
            <div className="px-4 pt-2.5 pb-1.5 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" />
              <span className="text-sm font-bold text-amber-900 truncate">
                {modoEdicion === "traza" ? "Editando traza" : "Editando"} {recorridoActivo.codigo}
                <span className="text-amber-700/70 dark:text-amber-300 font-normal"> — {recorridoActivo.nombre}</span>
              </span>
              {nodos > 0 && (
                <span className="ml-auto text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-200/60 px-2 py-0.5 rounded-full tabular-nums shrink-0">
                  {nodos} puntos
                </span>
              )}
            </div>

            {/* ── Instrucción contextual ── */}
            <p className="px-4 pb-2 text-[11px] text-amber-700/80 dark:text-amber-300 leading-snug">
              {instruccion}
            </p>

            {/* ── Fila de acciones ── */}
            <div className="px-3 py-2 bg-white/60 border-t border-amber-200/70 dark:border-amber-900 flex items-center gap-1 flex-wrap">

              {modoEdicion === "area" && (
                <>
                  {/* Dibujar zona (punto por punto) */}
                  <Button
                    variant={herramientaActiva === "lapiz" ? "default" : "outline"}
                    size="sm"
                    disabled={guardando || herramientaActiva === "tijera" || modoPluma !== null}
                    onClick={() => { setModoEditarNodos(false); setHerramientaActiva(herramientaActiva === "lapiz" ? null : "lapiz"); }}
                    className={cn("h-7 px-2.5 text-xs gap-1 font-semibold",
                      herramientaActiva === "lapiz" ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100")}
                    title="Dibujar zona punto por punto">
                    <Pencil className="h-3.5 w-3.5" />
                    {herramientaActiva === "lapiz" ? "Dibujando…" : "Dibujar"}
                  </Button>

                  {/* Editar nodos */}
                  <Button
                    variant={modoEditarNodos ? "default" : "outline"}
                    size="sm"
                    disabled={guardando || herramientaActiva !== null || modoPluma !== null}
                    onClick={() => { setModoPluma(null); setModoEditarNodos(v => !v); }}
                    className={cn("h-7 px-2.5 text-xs gap-1 font-semibold",
                      modoEditarNodos ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" : "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100")}
                    title="Mover los puntos libremente">
                    ✎ Editar puntos
                  </Button>

                  {/* Pluma — agregar / quitar nodos */}
                  <div className="flex items-center rounded-md border border-amber-300 dark:border-amber-800 overflow-hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={guardando || herramientaActiva !== null || modoEditarNodos}
                      onClick={() => { setModoEditarNodos(false); setModoPluma(modoPluma === "agregar" ? null : "agregar"); }}
                      className={cn("h-7 px-2 text-xs gap-1 rounded-none font-semibold",
                        modoPluma === "agregar" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-amber-700 dark:text-amber-300 hover:bg-amber-100")}
                      title="Pluma: clic sobre la línea (entre dos puntos) para agregar un nodo">
                      <PenTool className="h-3.5 w-3.5" />+
                    </Button>
                    <div className="w-px h-5 bg-amber-300" />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={guardando || herramientaActiva !== null || modoEditarNodos}
                      onClick={() => { setModoEditarNodos(false); setModoPluma(modoPluma === "quitar" ? null : "quitar"); }}
                      className={cn("h-7 px-2 text-xs gap-1 rounded-none font-semibold",
                        modoPluma === "quitar" ? "bg-red-600 hover:bg-red-700 text-white" : "text-amber-700 dark:text-amber-300 hover:bg-amber-100")}
                      title="Pluma: clic sobre un punto para eliminarlo">
                      <PenTool className="h-3.5 w-3.5" />−
                    </Button>
                  </div>

                  {/* Recortar (tijera) */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={guardando || herramientaActiva === "lapiz" || modoPluma !== null}
                    onClick={() => { setModoEditarNodos(false); setHerramientaActiva(herramientaActiva === "tijera" ? null : "tijera"); }}
                    className={cn("h-7 w-7 p-0",
                      herramientaActiva === "tijera" ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100")}
                    title="Recortar zona del área">
                    <Scissors className="h-3.5 w-3.5" />
                  </Button>

                  {/* Simplificar */}
                  <div className="relative">
                    <Button variant="outline" size="sm" onClick={() => setMostrarNiveles((v) => !v)} disabled={guardando}
                      className={cn("h-7 px-2 text-xs gap-1 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50", mostrarNiveles && "bg-blue-50 dark:bg-blue-950/40")}
                      title="Reducir cantidad de puntos">
                      <Wand2 className="h-3 w-3" />Simplif.
                    </Button>
                    {mostrarNiveles && (
                      <div className="absolute bottom-9 left-0 z-50 bg-background border rounded-lg shadow-lg py-1 min-w-[190px]">
                        <p className="px-3 pt-1 pb-1.5 text-[10px] text-muted-foreground border-b">Intensidad:</p>
                        {NIVELES_SIMPLIF.map((n) => (
                          <button key={n.label} onClick={() => handleSimplificar(n.eps)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex gap-2">
                            <span className="font-semibold text-blue-700 dark:text-blue-300 w-12">{n.label}</span>
                            <span className="text-muted-foreground">{n.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-5 bg-amber-200 mx-0.5" />
                </>
              )}

              {/* Deshacer */}
              <Button variant="outline" size="sm" onClick={deshacerEdicion}
                disabled={guardando || historialGeometria.current.length === 0}
                className="h-7 px-2 text-xs gap-1 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                title="Deshacer último cambio (Ctrl+Z)">
                <Undo2 className="h-3.5 w-3.5" /> Deshacer
              </Button>

              {/* Vaciar */}
              {modoEdicion === "area" && (
                <Button variant="outline" size="sm" onClick={handleVaciar} disabled={guardando}
                  className="h-7 px-2 text-xs gap-1 border-amber-300 dark:border-amber-800 text-red-600 dark:text-red-300 hover:bg-red-50"
                  title="Borrar todo y empezar de cero">
                  <Trash2 className="h-3.5 w-3.5" /> Vaciar
                </Button>
              )}

              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={cancelarEdicion} disabled={guardando}
                  className="h-7 px-3 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100">
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardarEdicion}
                  disabled={guardando || (!geometriaTemporalRef.current && !geometriaTemporal && !ultimaGeometriaRef.current)}
                  className="h-7 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                  {guardando ? "Guardando…" : <><Check className="h-3.5 w-3.5" /> Guardar</>}
                </Button>
              </div>
            </div>
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
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  );
}
