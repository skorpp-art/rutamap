"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import * as turf from "@turf/turf";
import { cn } from "@/lib/utils";
import {
  MapPin, Search, Loader2, Trash2, Navigation, Route as RouteIcon,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hoyAR } from "@/lib/fechas";
import {
  getRuta, agregarParada, eliminarParada, limpiarRuta,
  type Parada,
} from "@/app/actions/ruta";
import type { RecorridoGeo } from "@/types/database.types";

interface ResultadoGeo { display_name: string; lat: string; lon: string; place_id: number; }

export function RutaConductor({ recorridos }: { recorridos: RecorridoGeo[] }) {
  const [fecha] = useState(() => hoyAR());
  // Recorrido "propio" contra el que se chequea si cada dirección cae dentro.
  const [recorridoSel, setRecorridoSel] = useState<string>("");
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [cargando, setCargando] = useState(true);

  // Búsqueda de dirección
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoGeo[]>([]);
  const [guardando, setGuardando] = useState(false);

  const recorridosActivos = recorridos.filter(r => r.activo && r.area_geojson);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getRuta(fecha);
      if (res.ok) setParadas(res.data ?? []);
    } finally { setCargando(false); }
  }, [fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Geocodificar dirección (Nominatim) ──
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

  // Calcula si un punto cae dentro del recorrido elegido, y en qué recorrido cae.
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

  async function limpiar() {
    if (!confirm("¿Vaciar toda la ruta de hoy?")) return;
    const res = await limpiarRuta(fecha);
    if (!res.ok) { toast.error("No se pudo limpiar", { description: res.error }); return; }
    setParadas([]);
    toast.success("Ruta vaciada");
  }

  // ── Abrir en Google Maps con todas las paradas en orden ──
  function abrirGoogleMaps() {
    if (paradas.length === 0) { toast.error("Agregá al menos una parada"); return; }
    const pts = paradas.map(p => `${p.lat},${p.lon}`);
    const destino = pts[pts.length - 1];
    const waypoints = pts.slice(0, -1).join("|");
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("travelmode", "driving");
    url.searchParams.set("destination", destino);
    if (waypoints) url.searchParams.set("waypoints", waypoints);
    window.open(url.toString(), "_blank");
  }

  // Waze: solo la próxima parada (Waze no soporta multi-parada por link)
  function abrirWaze(p: Parada) {
    window.open(`https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`, "_blank");
  }

  const dentroCount = paradas.filter(p => p.dentro === true).length;
  const fueraCount = paradas.filter(p => p.dentro === false).length;

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
          <RouteIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Mi ruta</h1>
          <p className="text-xs text-muted-foreground">Cargá tus direcciones y abrí la ruta en Google Maps.</p>
        </div>
      </div>

      {/* Recorrido propio (para chequear dentro/fuera) */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-muted-foreground">Mi recorrido:</label>
        <select value={recorridoSel} onChange={e => setRecorridoSel(e.target.value)}
          className="text-sm border rounded-lg px-2 py-1.5 bg-background max-w-xs">
          <option value="">— sin chequear —</option>
          {recorridosActivos.map(r => (
            <option key={r.id} value={r.codigo}>{r.codigo} · {r.nombre}</option>
          ))}
        </select>
        {recorridoSel && (
          <span className="text-[11px] text-muted-foreground">
            marca 🟢 dentro / 🔴 fuera de <b>{recorridoSel}</b>
          </span>
        )}
      </div>

      {/* Buscador de dirección */}
      <div className="border rounded-xl p-3 bg-card space-y-2">
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

      {/* Lista de paradas */}
      {cargando ? (
        <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>
      ) : paradas.length === 0 ? (
        <EmptyState icon={RouteIcon} title="Sin paradas todavía"
          description="Buscá una dirección arriba y agregala a tu ruta." />
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{paradas.length} paradas</span>
            {recorridoSel && (
              <>
                <span className="text-emerald-600 dark:text-emerald-300">{dentroCount} dentro</span>
                <span className="text-red-600 dark:text-red-300">{fueraCount} fuera</span>
              </>
            )}
            <button onClick={limpiar} className="ml-auto text-red-600 hover:underline">Vaciar ruta</button>
          </div>

          <ol className="space-y-2">
            {paradas.map((p, i) => (
              <li key={p.id} className="border rounded-xl p-3 bg-card flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.direccion}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px]">
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
                  </div>
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
            ))}
          </ol>

          <Button onClick={abrirGoogleMaps}
            className="w-full h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <Navigation className="h-4 w-4" />
            Abrir ruta en Google Maps ({paradas.length} paradas)
          </Button>
          <p className="text-[10px] text-muted-foreground text-center -mt-2">
            Se abre con las paradas en el orden de la lista. El ícono de navegación de cada fila abre esa parada en Waze.
          </p>
        </>
      )}
    </div>
  );
}
