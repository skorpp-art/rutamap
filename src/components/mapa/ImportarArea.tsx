"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface ImportarAreaProps {
  onGeometriaImportada: (geojsonStr: string, nombre: string) => void;
}

// Elimina coordenada Z de cualquier geometría GeoJSON
function forzar2D(geom: { type: string; coordinates: unknown }): object {
  function strip(c: unknown): unknown {
    if (!Array.isArray(c)) return c;
    if (typeof c[0] === "number") return [c[0], c[1]];
    return c.map(strip);
  }
  return { ...geom, coordinates: strip(geom.coordinates) };
}

// Extrae la primera geometría Polygon/MultiPolygon encontrada en un GeoJSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraerGeometria(obj: any): { type: string; coordinates: unknown } | null {
  if (!obj) return null;
  const t = obj.type;
  if (t === "Polygon" || t === "MultiPolygon") return obj;
  if (t === "Feature") return extraerGeometria(obj.geometry);
  if (t === "FeatureCollection") {
    for (const f of obj.features ?? []) {
      const g = extraerGeometria(f);
      if (g) return g;
    }
  }
  if (t === "GeometryCollection") {
    for (const g of obj.geometries ?? []) {
      const found = extraerGeometria(g);
      if (found) return found;
    }
  }
  return null;
}

// Parseo básico de KML: extrae coordenadas del primer Polygon
function kmlAGeojson(kmlText: string): { type: string; coordinates: unknown } | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, "text/xml");
    const polys = doc.getElementsByTagName("Polygon");
    if (polys.length === 0) return null;

    const rings: number[][][] = [];
    const coordsEls = polys[0].getElementsByTagName("coordinates");
    for (let i = 0; i < coordsEls.length; i++) {
      const raw = coordsEls[i].textContent?.trim() ?? "";
      const ring = raw
        .split(/\s+/)
        .filter(Boolean)
        .map((pt) => {
          const [lon, lat] = pt.split(",").map(Number);
          return [lon, lat];
        })
        .filter(([lon, lat]) => !isNaN(lon) && !isNaN(lat));
      if (ring.length >= 3) rings.push(ring);
    }
    if (rings.length === 0) return null;
    return { type: "Polygon", coordinates: rings };
  } catch {
    return null;
  }
}

export function ImportarArea({ onGeometriaImportada }: ImportarAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      let geom: { type: string; coordinates: unknown } | null = null;
      const nombre = file.name.replace(/\.[^.]+$/, "");

      try {
        if (file.name.toLowerCase().endsWith(".kml")) {
          geom = kmlAGeojson(text);
        } else {
          // GeoJSON / JSON
          const parsed = JSON.parse(text);
          geom = extraerGeometria(parsed);
        }
      } catch {
        toast.error("No se pudo leer el archivo. Verificá que sea GeoJSON válido.");
        return;
      } finally {
        // Reset input so same file can be re-selected
        if (inputRef.current) inputRef.current.value = "";
      }

      if (!geom) {
        toast.error("No se encontró ningún polígono en el archivo.");
        return;
      }

      const geom2D = forzar2D(geom as { type: string; coordinates: unknown });
      onGeometriaImportada(JSON.stringify(geom2D), nombre);
      toast.success(`Área importada desde "${file.name}"`);
    };
    reader.readAsText(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json,.kml"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-md bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors border border-slate-200 dark:border-slate-700"
        title="Importar área desde archivo GeoJSON o KML"
      >
        <Upload className="h-3 w-3" />
        Importar archivo
      </button>
    </>
  );
}
