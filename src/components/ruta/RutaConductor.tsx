"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import * as turf from "@turf/turf";
import { cn } from "@/lib/utils";
import {
  MapPin, Search, Loader2, Trash2, Navigation, Route as RouteIcon,
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Users, RefreshCw,
  Check, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { hoyAR } from "@/lib/fechas";
import {
  getRuta, agregarParada, eliminarParada, limpiarRuta, reordenarRuta,
  getCadetesHoy, getPendientesParaRuta, guardarGeocodificacion, marcarParadaEstado,
  type Parada, type CadeteHoy,
} from "@/app/actions/ruta";
import { MiniMapaRuta } from "./MiniMapaRuta";
import type { RecorridoGeo } from "@/types/database.types";

interface ResultadoGeo { display_name: string; lat: string; lon: string; place_id: number; }

/** Nominatim pide como máximo 1 pedido por segundo. */
const PAUSA_GEOCODING_MS = 1100;

async function geocodificar(direccion: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const params = new URLSearchParams({
      q: `${direccion}, Buenos Aires, Argentina`,
      format: "jsonv2", limit: "1", countrycodes: "ar", "accept-language": "es",
    });
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as ResultadoGeo[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

export function RutaConductor({ recorridos }: { recorridos: RecorridoGeo[] }) {
  const [fecha] = useState(() => hoyAR());
  const [recorridoSel, setRecorridoSel] = useState<string>("");
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [cargando, setCargando] = useState(true);

  // Armar la ruta sola desde Pendientes
  const [cadetes, setCadetes] = useState<CadeteHoy[]>([]);
  const [cadeteSel, setCadeteSel] = useState("");
  const [cargandoCadetes, setCargandoCadetes] = useState(true);
  const [armando, setArmando] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);

  // Agregar una dirección suelta a mano
  const [mostrarManual, setMostrarManual] = useState(false);
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoGeo[]>([]);
  const [guardando, setGuardando] = useState(false);

  const recorridosActivos = recorridos.filter(r => r.activo && r.area_geojson);
  const recorridoElegido = recorridosActivos.find(r => r.codigo === recorridoSel) ?? null;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getRuta(fecha);
      if (res.ok) setParadas(res.data ?? []);
    } finally { setCargando(false); }
  }, [fecha]);

  const cargarCadetes = useCallback(async () => {
    setCargandoCadetes(true);
    const res = await getCadetesHoy(fecha);
    if (res.ok) {
      setCadetes(res.data);
      if (!cadeteSel && res.data.length > 0) setCadeteSel(res.data[0].cadete);
    }
    setCargandoCadetes(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarCadetes(); }, [cargarCadetes]);

  // Calcula si un punto cae dentro del recorrido elegido (sólo para el
  // aviso visual; nada de esto bloquea nada).
  function analizarPunto(lat: number, lon: number): { dentro: boolean | null; codigo: string | null } {
    const pt = turf.point([lon, lat]);
    let codigo: string | null = null;
    for (const r of recorridosActivos) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geom: any = JSON.parse(r.area_geojson!);
        const feat = geom.type === "Feature" ? geom : turf.feature(geom);
        if (turf.booleanPointInPolygon(pt, feat)) { codigo = r.codigo; break; }
      } catch { /* ignorar */ }
    }
    const dentro = recorridoSel ? codigo === recorridoSel : null;
    return { dentro, codigo };
  }

  /**
   * El corazón de la pantalla: en vez de tipear direcciones, se trae todo lo
   * que ese cadete tiene listo para repartir hoy. Lo que ya está geocodificado
   * (de una carga anterior) se agrega directo; lo nuevo se geocodifica una
   * sola vez y queda cacheado en el pendiente para la próxima.
   */
  async function armarRutaDesdeCadete() {
    if (!cadeteSel) return toast.error("Elegí quién reparte");
    setArmando(true);
    setProgreso(null);
    try {
      const res = await getPendientesParaRuta(fecha, cadeteSel);
      if (!res.ok) { toast.error(res.error); return; }
      const pendientes = res.data;
      if (pendientes.length === 0) {
        toast.info("No hay paquetes listos para salir a nombre de esa persona hoy");
        return;
      }

      setProgreso({ hecho: 0, total: pendientes.length });
      let agregadas = 0, sinDireccion = 0;

      for (let i = 0; i < pendientes.length; i++) {
        const p = pendientes[i];
        let lat = p.lat, lon = p.lon;

        if (lat == null || lon == null) {
          if (!p.direccion?.trim()) { sinDireccion++; setProgreso({ hecho: i + 1, total: pendientes.length }); continue; }
          const geo = await geocodificar(p.direccion);
          if (!geo) { sinDireccion++; setProgreso({ hecho: i + 1, total: pendientes.length }); continue; }
          lat = geo.lat; lon = geo.lon;
          await guardarGeocodificacion(p.id, lat, lon);
          // Respeta el límite de Nominatim sólo cuando de verdad se le pidió algo.
          await new Promise(r => setTimeout(r, PAUSA_GEOCODING_MS));
        }

        const { dentro, codigo } = analizarPunto(lat, lon);
        const r = await agregarParada(
          fecha, p.direccion, lat, lon, recorridoSel ? codigo : null, dentro, p.id,
        );
        if (r.ok && r.data) agregadas++;
        setProgreso({ hecho: i + 1, total: pendientes.length });
      }

      await cargar();
      if (sinDireccion > 0) {
        toast.warning(`${agregadas} paradas agregadas — ${sinDireccion} no se pudieron ubicar (dirección incompleta o no encontrada)`);
      } else {
        toast.success(`${agregadas} paradas agregadas`);
      }
    } finally {
      setArmando(false);
      setProgreso(null);
    }
  }

  // ── Búsqueda manual de dirección ──
  async function buscar() {
    const q = query.trim();
    if (q.length < 3) { toast.error("Escribí una dirección más completa"); return; }
    setBuscando(true);
    setResultados([]);
    try {
      const params = new URLSearchParams({
        q: `${q}, Buenos Aires, Argentina`,
        format: "jsonv2", addressdetails: "1", limit: "6",
        countrycodes: "ar", "accept-language": "es",
      });
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as ResultadoGeo[];
      if (!data.length) { toast.error("No se encontró esa dirección. Probá agregando la localidad."); return; }
      setResultados(data);
    } catch (e) {
      toast.error("Error al buscar la dirección", { description: String(e) });
    } finally { setBuscando(false); }
  }

  async function elegir(r: ResultadoGeo) {
    setGuardando(true);
    try {
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      const { dentro, codigo } = analizarPunto(lat, lon);
      const direccion = r.display_name.split(",").slice(0, 3).join(",").trim();
      const res = await agregarParada(fecha, direccion, lat, lon, codigo, dentro);
      if (!res.ok) { toast.error("No se pudo agregar", { description: res.error }); return; }
      setQuery(""); setResultados([]);
      if (recorridoSel && dentro === false) {
        toast.warning(`Ojo: esa dirección cae ${codigo ? `en ${codigo}` : "fuera de todo recorrido"}, no en ${recorridoSel}`);
      } else {
        toast.success("Parada agregada");
      }
      await cargar();
    } finally { setGuardando(false); }
  }

  async function quitar(id: string) {
    const res = await eliminarParada(id);
    if (!res.ok) { toast.error("No se pudo quitar", { description: res.error }); return; }
    setParadas(prev => prev.filter(p => p.id !== id));
  }

  async function toggleEntregado(p: Parada) {
    const nuevaEntregada = p.estado !== "entregado";
    // Optimista: se ve al toque, sin esperar la vuelta del servidor.
    setParadas(prev => prev.map(x => x.id === p.id ? { ...x, estado: nuevaEntregada ? "entregado" : "pendiente" } : x));
    const res = await marcarParadaEstado(p.id, nuevaEntregada);
    if (!res.ok) {
      toast.error("No se pudo actualizar", { description: res.error });
      setParadas(prev => prev.map(x => x.id === p.id ? { ...x, estado: p.estado } : x));
    }
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= paradas.length) return;
    const copia = [...paradas];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setParadas(copia);
    await reordenarRuta(copia.map(p => p.id));
  }

  async function limpiar() {
    if (!confirm("¿Vaciar toda la ruta de hoy?")) return;
    const res = await limpiarRuta(fecha);
    if (!res.ok) { toast.error("No se pudo limpiar", { description: res.error }); return; }
    setParadas([]);
    toast.success("Ruta vaciada");
  }

  function abrirGoogleMaps() {
    const activas = paradas.filter(p => p.estado !== "entregado");
    if (activas.length === 0) { toast.error("No quedan paradas sin entregar"); return; }
    const pts = activas.map(p => `${p.lat},${p.lon}`);
    const destino = pts[pts.length - 1];
    const waypoints = pts.slice(0, -1).join("|");
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("travelmode", "driving");
    url.searchParams.set("destination", destino);
    if (waypoints) url.searchParams.set("waypoints", waypoints);
    window.open(url.toString(), "_blank");
  }

  function abrirWaze(p: Parada) {
    window.open(`https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`, "_blank");
  }

  const entregadas = paradas.filter(p => p.estado === "entregado").length;
  const dentroCount = paradas.filter(p => p.dentro === true).length;
  const fueraCount = paradas.filter(p => p.dentro === false).length;
  const paradasConCoords = useMemo(() => paradas.filter(p => p.lat != null && p.lon != null), [paradas]);

  return (
    <div className="max-w-3xl mx-auto p-5 space-y-4">
      <PageHeader titulo="Mi ruta" desc="Se arma sola con lo que ya está listo para repartir hoy." />

      {/* ── Armar la ruta desde Pendientes ─────────────────────────────── */}
      <div className="border rounded-lg p-3 bg-card space-y-2">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-300" /> ¿Quién reparte?
        </p>
        {cargandoCadetes ? (
          <p className="text-sm text-muted-foreground">Buscando quién tiene paquetes listos hoy…</p>
        ) : cadetes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay paquetes en estado &quot;recibido&quot; para hoy. Agregá una dirección suelta más abajo si hace falta.
          </p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <select value={cadeteSel} onChange={e => setCadeteSel(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 bg-background flex-1 min-w-[180px]">
              {cadetes.map(c => (
                <option key={c.cadete} value={c.cadete}>{c.cadete} · {c.total} paquetes</option>
              ))}
            </select>
            <Button onClick={armarRutaDesdeCadete} disabled={armando} className="h-9">
              {armando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {progreso ? `${progreso.hecho}/${progreso.total}` : "Armando…"}</>
                : "Cargar mi ruta"}
            </Button>
            <button onClick={cargarCadetes} title="Actualizar lista"
              className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}
        {armando && (
          <p className="text-xs text-muted-foreground">
            Ubicando direcciones nuevas (una por segundo, para no saturar el buscador de mapas)…
          </p>
        )}
      </div>

      {/* Recorrido propio (opcional, sólo para chequear dentro/fuera y ver el área en el mapa) */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-muted-foreground">Chequear contra el recorrido:</label>
        <select value={recorridoSel} onChange={e => setRecorridoSel(e.target.value)}
          className="text-sm border rounded-lg px-2 py-1.5 bg-background max-w-xs">
          <option value="">— sin chequear —</option>
          {recorridosActivos.map(r => (
            <option key={r.id} value={r.codigo}>{r.codigo} · {r.nombre}</option>
          ))}
        </select>
      </div>

      {/* ── Mapa ────────────────────────────────────────────────────────── */}
      {paradasConCoords.length > 0 && (
        <MiniMapaRuta paradas={paradasConCoords} recorrido={recorridoElegido} />
      )}

      {/* ── Agregar dirección suelta (colapsado por default) ───────────── */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <button onClick={() => setMostrarManual(v => !v)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {mostrarManual ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Agregar una dirección suelta a mano
        </button>
        {mostrarManual && (
          <div className="p-3 pt-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") buscar(); }}
                  placeholder="Ej: Av. Rivadavia 5000, Morón"
                  className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background" />
              </div>
              <Button onClick={buscar} disabled={buscando} className="h-9">
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
            {resultados.length > 0 && (
              <ul className="border rounded-lg divide-y overflow-hidden">
                {resultados.map(r => (
                  <li key={r.place_id}>
                    <button onClick={() => elegir(r)} disabled={guardando}
                      className="w-full text-left px-3 py-2 hover:bg-accent/40 transition-colors flex items-start gap-2 text-sm disabled:opacity-50">
                      <MapPin className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <span className="flex-1">{r.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Lista de paradas ────────────────────────────────────────────── */}
      {cargando ? (
        <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>
      ) : paradas.length === 0 ? (
        <EmptyState icon={RouteIcon} title="Sin paradas todavía"
          description="Elegí quién reparte arriba y tocá &quot;Cargar mi ruta&quot;, o agregá una dirección suelta." />
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground">{entregadas}/{paradas.length} entregadas</span>
            {recorridoSel && (
              <>
                <span className="text-emerald-600 dark:text-emerald-300">{dentroCount} dentro</span>
                <span className="text-red-600 dark:text-red-300">{fueraCount} fuera</span>
              </>
            )}
            <button onClick={limpiar} className="ml-auto text-red-600 hover:underline">Vaciar ruta</button>
          </div>

          <ol className="space-y-2">
            {paradas.map((p, i) => {
              const entregada = p.estado === "entregado";
              return (
                <li key={p.id} className={cn(
                  "border rounded-lg p-3 bg-card flex items-start gap-3 transition-opacity",
                  entregada && "opacity-50",
                )}>
                  <button onClick={() => toggleEntregado(p)}
                    title={entregada ? "Marcar como pendiente" : "Marcar como entregada"}
                    className={cn(
                      "h-6 w-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      entregada ? "bg-emerald-600 hover:bg-slate-400" : "bg-blue-600 hover:bg-emerald-600",
                    )}>
                    {entregada ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", entregada && "line-through")}>{p.direccion}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap">
                      {p.dentro === true && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> dentro de {p.recorrido_codigo}
                        </span>
                      )}
                      {p.dentro === false && (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                          <AlertTriangle className="h-3 w-3" /> {p.recorrido_codigo ? `cae en ${p.recorrido_codigo}` : "fuera de todo recorrido"}
                        </span>
                      )}
                      {p.dentro === null && p.recorrido_codigo && (
                        <span className="text-muted-foreground">recorrido: {p.recorrido_codigo}</span>
                      )}
                      {p.pendiente_id && (
                        <span className="text-muted-foreground/70">· desde Pendientes</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center shrink-0 -my-1">
                    <button onClick={() => mover(i, -1)} disabled={i === 0} title="Subir"
                      className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => mover(i, 1)} disabled={i === paradas.length - 1} title="Bajar"
                      className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button onClick={() => abrirWaze(p)} title="Ir a esta parada en Waze"
                    className="text-muted-foreground/50 hover:text-blue-600 transition-colors shrink-0">
                    <Navigation className="h-4 w-4" />
                  </button>
                  <button onClick={() => quitar(p.id)} title="Quitar"
                    className="text-muted-foreground/40 hover:text-red-600 transition-colors shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>

          <Button onClick={abrirGoogleMaps}
            className="w-full h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <Navigation className="h-4 w-4" />
            Abrir ruta en Google Maps ({paradas.length - entregadas} paradas)
          </Button>
          <p className="text-xs text-muted-foreground text-center -mt-2 flex items-center justify-center gap-1">
            <Undo2 className="h-3 w-3" />
            Las ya entregadas no se incluyen. El ícono de navegación de cada fila abre esa parada en Waze.
          </p>
        </>
      )}
    </div>
  );
}
