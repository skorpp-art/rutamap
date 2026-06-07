"use client";

import { useState, useRef } from "react";
import { Search, X, Loader2, MapPin, Plus, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureNominatim {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: {
    place_id: number;
    display_name: string;
    type: string;
    class: string;
  };
}

interface BuscadorLocalidadProps {
  onPolygonEncontrado: (geojsonStr: string, nombre: string) => void;
  onPolygonEliminar?: (geojsonStr: string, nombre: string) => void;
}

const TIPO_LABELS: Record<string, string> = {
  administrative: "Partido / Municipio",
  city: "Ciudad",
  town: "Localidad",
  suburb: "Localidad / Barrio",
  village: "Pueblo",
  hamlet: "Paraje",
  quarter: "Barrio",
  neighbourhood: "Barrio",
  borough: "Sección",
};

// Elimina coordenada Z de cualquier geometría GeoJSON
function forzar2D(geom: { type: string; coordinates: unknown }): object {
  function strip(c: unknown): unknown {
    if (!Array.isArray(c)) return c;
    if (typeof c[0] === "number") return [c[0], c[1]]; // [lon, lat, Z?] → [lon, lat]
    return c.map(strip);
  }
  return { ...geom, coordinates: strip(geom.coordinates) };
}

export function BuscadorLocalidad({
  onPolygonEncontrado,
  onPolygonEliminar,
}: BuscadorLocalidadProps) {
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<FeatureNominatim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function buscar(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResultados([]); setError(null); return; }

    setBuscando(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: `${trimmed}, Argentina`,
        format: "geojson",
        polygon_geojson: "1",
        limit: "10",
        countrycodes: "ar",
        "accept-language": "es",
        dedupe: "1",
      });

      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { "User-Agent": "RutaMap/1.0 (rutamap.vercel.app)" } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = (await resp.json()) as { features: FeatureNominatim[] };
      const conPoligono = (data.features ?? []).filter(
        (f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
      );

      if (conPoligono.length === 0) {
        setError(
          (data.features ?? []).length > 0
            ? 'Resultados encontrados pero sin límite de área. Probá con "Partido de ..."'
            : "No se encontraron resultados. Revisá el nombre."
        );
        setResultados([]);
      } else {
        setResultados(conPoligono);
        setError(null);
      }
    } catch (e) {
      setError(`Error al buscar: ${String(e)}`);
    } finally {
      setBuscando(false);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setAbierto(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(val), 600);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { if (debounceRef.current) clearTimeout(debounceRef.current); buscar(query); }
    if (e.key === "Escape") { setAbierto(false); inputRef.current?.blur(); }
  }

  function geojsonLimpio(f: FeatureNominatim): string {
    return JSON.stringify(forzar2D(f.geometry as { type: string; coordinates: unknown }));
  }

  function nombreCorto(f: FeatureNominatim): string {
    return f.properties.display_name.split(",").slice(0, 2).join(",").trim();
  }

  function agregar(f: FeatureNominatim) {
    onPolygonEncontrado(geojsonLimpio(f), nombreCorto(f));
    cerrar();
  }

  function eliminar(f: FeatureNominatim) {
    onPolygonEliminar?.(geojsonLimpio(f), nombreCorto(f));
    cerrar();
  }

  function cerrar() {
    setQuery(""); setResultados([]); setError(null); setAbierto(false);
  }

  const tipoLabel = (f: FeatureNominatim) =>
    TIPO_LABELS[f.properties.type] ?? TIPO_LABELS[f.properties.class] ?? f.properties.type;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] w-96">
      {/* Input */}
      <div className="flex items-center gap-2 bg-background/96 backdrop-blur-sm border rounded-xl shadow-lg px-3 py-2">
        {buscando
          ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
          : <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setAbierto(true)}
          placeholder="Buscar localidad… ej: Morón, Castelar"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={cerrar} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Resultados */}
      {abierto && (resultados.length > 0 || error) && (
        <div className="mt-1 bg-background border rounded-xl shadow-lg overflow-hidden">
          {error ? (
            <p className="text-xs text-muted-foreground px-3 py-3 text-center leading-relaxed">{error}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y">
              {resultados.map((f) => {
                const partes = f.properties.display_name.split(",");
                const nombre = partes.slice(0, 2).join(",").trim();
                const contexto = partes.slice(2, 4).join(",").trim();
                return (
                  <li key={f.properties.place_id} className="px-3 py-2.5 hover:bg-accent/40 transition-colors">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{nombre}</p>
                        {contexto && (
                          <p className="text-[11px] text-muted-foreground truncate">{contexto}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {tipoLabel(f)} · {f.geometry.type === "MultiPolygon" ? "área múltiple" : "polígono"}
                        </p>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => agregar(f)}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1 px-2 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-900"
                      >
                        <Plus className="h-3 w-3" />
                        Agregar al área
                      </button>
                      {onPolygonEliminar && (
                        <button
                          onClick={() => eliminar(f)}
                          className="flex items-center justify-center gap-1 text-[11px] font-medium py-1 px-2 rounded-md bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors border border-slate-200 dark:border-slate-700 hover:border-red-200"
                          title="Resta geométrica: quita la parte de esta zona que se superpone al área del recorrido. Usá Ctrl+Z para deshacer."
                        >
                          <Scissors className="h-3 w-3" />
                          Restar zona
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!query && (
        <p className="text-center text-[10px] text-white/75 mt-1.5 drop-shadow-sm select-none">
          Cargá o quitá el límite de una localidad automáticamente
        </p>
      )}
    </div>
  );
}
