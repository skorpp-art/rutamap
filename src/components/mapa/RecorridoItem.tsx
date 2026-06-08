"use client";

import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RecorridoGeo } from "@/types/database.types";

interface RecorridoItemProps {
  recorrido: RecorridoGeo;
  seleccionado: boolean;
  visible: boolean;
  onClick: () => void;
  onToggleVisible: (e: React.MouseEvent) => void;
}

const TIPO_LABELS: Record<string, string> = {
  fijo: "Fijo",
  suplencia: "Suplencia",
  corte: "Corte",
  pre_turno: "Pre-turno",
};

export function RecorridoItem({ recorrido, seleccionado, visible, onClick, onToggleVisible }: RecorridoItemProps) {
  const sinArea = !recorrido.area_geojson;
  const sinTraza = !recorrido.traza_geojson;
  const incompleto = sinArea || sinTraza;

  return (
    <div
      className={cn(
        "relative w-full text-left px-2 py-2 rounded-lg transition-colors",
        "flex items-start gap-2 group",
        seleccionado ? "bg-accent ring-1 ring-primary/25" : "hover:bg-accent/40",
        !recorrido.activo && "opacity-50"
      )}
    >
      {/* Acento de color del recorrido cuando está seleccionado */}
      {seleccionado && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full"
          style={{ backgroundColor: recorrido.color }}
        />
      )}
      {/* Toggle visibilidad en mapa */}
      <button
        onClick={onToggleVisible}
        className={cn(
          "mt-0.5 shrink-0 p-0.5 rounded transition-colors",
          visible
            ? "text-brand-blue hover:text-brand-blue/70"
            : "text-muted-foreground/40 hover:text-muted-foreground"
        )}
        title={visible ? "Ocultar en mapa" : "Mostrar en mapa"}
      >
        {visible
          ? <Eye className="h-3.5 w-3.5" />
          : <EyeOff className="h-3.5 w-3.5" />
        }
      </button>

      {/* Contenido principal — click para seleccionar */}
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left flex items-start gap-2"
      >
        {/* Swatch de color */}
        <div
          className="mt-0.5 h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-black/10"
          style={{ backgroundColor: recorrido.color }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-foreground truncate">
              {recorrido.codigo}
            </span>
            {incompleto && (
              <span title={[sinArea && "sin área", sinTraza && "sin traza"].filter(Boolean).join(", ")}>
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
          <div className="flex gap-1 mt-1 flex-wrap">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {recorrido.zona}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-4",
                recorrido.tipo === "suplencia" && "border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-300",
                recorrido.tipo === "corte" && "border-red-300 dark:border-red-800 text-red-600 dark:text-red-300",
                recorrido.tipo === "pre_turno" && "border-violet-300 dark:border-violet-800 text-violet-600 dark:text-violet-300",
              )}
            >
              {TIPO_LABELS[recorrido.tipo] ?? recorrido.tipo}
            </Badge>
          </div>
        </div>
      </button>
    </div>
  );
}
