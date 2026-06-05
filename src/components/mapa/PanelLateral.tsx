"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, Plus, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RecorridoItem } from "./RecorridoItem";
import { DialogRecorrido } from "./DialogRecorrido";
import type { RecorridoGeo, Zona, TipoRecorrido } from "@/types/database.types";
import { ZONAS } from "@/types/database.types";

interface PanelLateralProps {
  recorridos: RecorridoGeo[];
  recorridoActivoId: string | null;
  onSelectRecorrido: (id: string) => void;
  visibles: Set<string>;
  onToggleVisible: (id: string) => void;
  onMostrarZona: (zona: Zona) => void;
  onOcultarTodo: () => void;
  onMostrarTodo: (ids?: string[]) => void;
  puedeEditar?: boolean;
}

type Orden = "codigo" | "zona" | "fecha";

const TIPOS: TipoRecorrido[] = ["fijo", "suplencia", "corte", "pre_turno"];

const TIPO_LABELS: Record<string, string> = {
  fijo: "Fijo",
  suplencia: "Supl.",
  corte: "Corte",
  pre_turno: "Pre-T",
};

const ORDEN_LABELS: Record<Orden, string> = {
  codigo: "Código A→Z",
  zona: "Zona",
  fecha: "Reciente",
};

function ordenarRecorridos(lista: RecorridoGeo[], orden: Orden): RecorridoGeo[] {
  return [...lista].sort((a, b) => {
    if (orden === "codigo") return a.codigo.localeCompare(b.codigo);
    if (orden === "zona") {
      const cmp = a.zona.localeCompare(b.zona);
      return cmp !== 0 ? cmp : a.codigo.localeCompare(b.codigo);
    }
    // fecha: más reciente primero
    return new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime();
  });
}

export function PanelLateral({
  recorridos,
  recorridoActivoId,
  onSelectRecorrido,
  visibles,
  onToggleVisible,
  onMostrarZona,
  onOcultarTodo,
  onMostrarTodo,
  puedeEditar = true,
}: PanelLateralProps) {
  const [busqueda, setBusqueda] = useState("");
  const [zonasActivas, setZonasActivas] = useState<Set<Zona>>(new Set());
  const [tiposActivos, setTiposActivos] = useState<Set<TipoRecorrido>>(new Set());
  const [soloActivos, setSoloActivos] = useState(true);
  const [orden, setOrden] = useState<Orden>("codigo");
  const [mostrarOrden, setMostrarOrden] = useState(false);

  function toggleZona(zona: Zona) {
    setZonasActivas((prev) => {
      const next = new Set(prev);
      next.has(zona) ? next.delete(zona) : next.add(zona);
      return next;
    });
    onMostrarZona(zona);
  }

  function toggleTipo(tipo: TipoRecorrido) {
    setTiposActivos((prev) => {
      const next = new Set(prev);
      next.has(tipo) ? next.delete(tipo) : next.add(tipo);
      return next;
    });
  }

  const filtrados = ordenarRecorridos(
    recorridos.filter((r) => {
      if (soloActivos && !r.activo) return false;
      if (zonasActivas.size > 0 && !zonasActivas.has(r.zona)) return false;
      if (tiposActivos.size > 0 && !tiposActivos.has(r.tipo)) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        if (
          !r.codigo.toLowerCase().includes(q) &&
          !r.nombre.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    }),
    orden
  );

  const hayFiltros =
    zonasActivas.size > 0 ||
    tiposActivos.size > 0 ||
    busqueda.trim() ||
    !soloActivos;

  const totalActivos = recorridos.filter((r) => r.activo).length;
  const totalInactivos = recorridos.length - totalActivos;

  return (
    <aside className="flex flex-col h-full w-72 shrink-0 border-r bg-background">
      {/* Cabecera */}
      <div className="px-3 py-3 border-b space-y-2.5">
        {/* Título + acciones */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Recorridos</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {filtrados.length}/{recorridos.length}
          </span>

          {/* Ordenar */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Ordenar lista"
              onClick={() => setMostrarOrden((v) => !v)}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </Button>
            {mostrarOrden && (
              <div className="absolute right-0 top-7 z-50 bg-background border rounded-lg shadow-md py-1 min-w-[120px]">
                {(Object.keys(ORDEN_LABELS) as Orden[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => {
                      setOrden(o);
                      setMostrarOrden(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                      orden === o && "font-semibold text-foreground"
                    )}
                  >
                    {ORDEN_LABELS[o]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nuevo recorrido — solo usuarios con sesión */}
          {puedeEditar && (
            <DialogRecorrido>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Nuevo recorrido"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DialogRecorrido>
          )}
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar código o nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Filtro zonas */}
        <div className="flex flex-wrap gap-1">
          {ZONAS.map((zona) => (
            <button
              key={zona}
              onClick={() => toggleZona(zona)}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                zonasActivas.has(zona)
                  ? "bg-brand-blue text-white border-brand-blue"
                  : "bg-transparent text-muted-foreground border-border hover:border-brand-blue/50"
              )}
            >
              {zona}
            </button>
          ))}
        </div>

        {/* Controles rápidos de visibilidad */}
        <div className="flex gap-1 items-center">
          <span className="text-[10px] text-muted-foreground">Mapa:</span>
          <button
            onClick={() => onMostrarTodo(filtrados.map((r) => r.id))}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-brand-blue/50 transition-colors"
            title={hayFiltros ? "Mostrar en el mapa los recorridos filtrados" : "Mostrar todos en el mapa"}
          >
            {hayFiltros ? `Ver filtrados (${filtrados.length})` : "Ver todos"}
          </button>
          <button
            onClick={onOcultarTodo}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-brand-blue/50 transition-colors"
            title="Ocultar todos del mapa"
          >
            Ocultar
          </button>
        </div>

        {/* Filtro tipos + activo + limpiar */}
        <div className="flex gap-1 flex-wrap">
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              onClick={() => toggleTipo(tipo)}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                tiposActivos.has(tipo)
                  ? tipo === "suplencia"
                    ? "bg-orange-500 text-white border-orange-500"
                    : tipo === "corte"
                      ? "bg-red-500 text-white border-red-500"
                      : tipo === "pre_turno"
                        ? "bg-violet-500 text-white border-violet-500"
                        : "bg-brand-blue text-white border-brand-blue"
                  : "bg-transparent text-muted-foreground border-border hover:border-brand-blue/50"
              )}
            >
              {TIPO_LABELS[tipo] ?? tipo}
            </button>
          ))}

          {/* Toggle activos/todos */}
          <button
            onClick={() => setSoloActivos((v) => !v)}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
              !soloActivos
                ? "bg-slate-500 text-white border-slate-500"
                : "bg-transparent text-muted-foreground border-border hover:border-brand-blue/50"
            )}
            title={soloActivos ? "Mostrar inactivos también" : "Ocultar inactivos"}
          >
            {soloActivos ? "activos" : "todos"}
          </button>

          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-5 text-[10px] px-1.5 text-muted-foreground"
              onClick={() => {
                setBusqueda("");
                setZonasActivas(new Set());
                setTiposActivos(new Set());
                setSoloActivos(true);
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filtrados.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Sin resultados
          </p>
        ) : (
          <div className="space-y-0.5 py-1">
            {filtrados.map((r) => (
              <RecorridoItem
                key={r.id}
                recorrido={r}
                seleccionado={r.id === recorridoActivoId}
                visible={visibles.has(r.id)}
                onClick={() => onSelectRecorrido(r.id)}
                onToggleVisible={(e) => { e.stopPropagation(); onToggleVisible(r.id); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pie */}
      <div className="px-3 py-2 border-t flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">
          {totalActivos} activos
        </Badge>
        {totalInactivos > 0 && soloActivos && (
          <button
            onClick={() => setSoloActivos(false)}
            className="text-[10px] text-muted-foreground border border-dashed border-border rounded px-1.5 py-0.5 hover:bg-accent transition-colors"
            title="Ver recorridos inactivos para reactivarlos o eliminarlos"
          >
            {totalInactivos} inactivo{totalInactivos > 1 ? "s" : ""} — ver
          </button>
        )}
        {totalInactivos > 0 && !soloActivos && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {totalInactivos} inactivo{totalInactivos > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
    </aside>
  );
}
