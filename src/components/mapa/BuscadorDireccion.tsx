"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Loader2, MapPin } from "lucide-react";

interface ResultadoNominatim {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

interface Props {
  // Se llama al elegir una dirección: coordenadas + texto.
  onDireccionElegida: (lat: number, lon: number, label: string) => void;
  // Se llama al limpiar la búsqueda (para quitar el pin del mapa).
  onLimpiar: () => void;
}

export function BuscadorDireccion({ onDireccionElegida, onLimpiar }: Props) {
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoNominatim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vigenteRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  async function buscar(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) { setResultados([]); setError(null); return; }
    const idBusqueda = ++vigenteRef.current;
    setBuscando(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: `${trimmed}, Buenos Aires, Argentina`,
        format: "jsonv2",
        addressdetails: "1",
        limit: "8",
        countrycodes: "ar",
        "accept-language": "es",
      });
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept": "application/json" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as ResultadoNominatim[];
      if (idBusqueda !== vigenteRef.current) return; // respuesta vieja, descartar
      if (!data || data.length === 0) {
        setResultados([]);
        setError("No se encontró esa dirección. Probá agregando la localidad.");
      } else {
        setResultados(data);
        setError(null);
      }
    } catch (e) {
      if (idBusqueda === vigenteRef.current) setError(`Error al buscar: ${String(e)}`);
    } finally {
      if (idBusqueda === vigenteRef.current) setBuscando(false);
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

  function elegir(r: ResultadoNominatim) {
    onDireccionElegida(parseFloat(r.lat), parseFloat(r.lon), nombreCorto(r));
    setAbierto(false);
    setResultados([]);
  }

  function limpiar() {
    setQuery(""); setResultados([]); setError(null); setAbierto(false);
    onLimpiar();
  }

  function nombreCorto(r: ResultadoNominatim): string {
    return r.display_name.split(",").slice(0, 3).join(",").trim();
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] w-[22rem] max-w-[90vw]">
      <div className="flex items-center gap-2 bg-background/96 backdrop-blur-sm border rounded-xl shadow-lg px-3 py-2">
        {buscando
          ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
          : <Search className="h-4 w-4 text-muted-foreground shrink-0" />}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 3 && setAbierto(true)}
          placeholder="Buscar dirección… ej: Av. Rivadavia 5000, Morón"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={limpiar} className="text-muted-foreground hover:text-foreground transition-colors" title="Limpiar">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {abierto && (resultados.length > 0 || error) && (
        <div className="mt-1 bg-background border rounded-xl shadow-lg overflow-hidden">
          {error ? (
            <p className="text-xs text-muted-foreground px-3 py-3 text-center leading-relaxed">{error}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y">
              {resultados.map((r) => {
                const partes = r.display_name.split(",");
                const nombre = partes.slice(0, 2).join(",").trim();
                const contexto = partes.slice(2, 5).join(",").trim();
                return (
                  <li key={r.place_id}>
                    <button onClick={() => elegir(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{nombre}</p>
                        {contexto && <p className="text-[11px] text-muted-foreground truncate">{contexto}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
