"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RecorridoGeo } from "@/types/database.types";

interface RecorridoItemProps {
  recorrido: RecorridoGeo;
  seleccionado: boolean;
  onClick: () => void;
}

export function RecorridoItem({ recorrido, seleccionado, onClick }: RecorridoItemProps) {
  const sinArea = !recorrido.area_geojson;
  const sinTraza = !recorrido.traza_geojson;
  const incompleto = sinArea || sinTraza;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
        "hover:bg-accent flex items-start gap-3 group",
        seleccionado && "bg-accent ring-1 ring-brand-blue/30",
        !recorrido.activo && "opacity-50"
      )}
    >
      {/* Swatch de color */}
      <div
        className="mt-0.5 h-4 w-4 rounded-full shrink-0 ring-1 ring-black/10"
        style={{ backgroundColor: recorrido.color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-foreground truncate">
            {recorrido.codigo}
          </span>
          {incompleto && (
            <span
              title={[sinArea && "sin área", sinTraza && "sin traza"]
                .filter(Boolean)
                .join(", ")}
            >
              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
            </span>
          )}
          {!recorrido.activo && (
            <span className="text-[10px] text-muted-foreground shrink-0">inactivo</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
          {recorrido.nombre}
        </p>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {recorrido.zona}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-4",
              recorrido.tipo === "suplencia" && "border-orange-300 text-orange-600"
            )}
          >
            {recorrido.tipo}
          </Badge>
        </div>
      </div>
    </button>
  );
}
