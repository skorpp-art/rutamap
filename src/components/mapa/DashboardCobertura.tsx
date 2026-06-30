"use client";

import { X, BarChart2, MapPin, Route, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecorridoGeo, Zona } from "@/types/database.types";
import { ZONAS } from "@/types/database.types";

interface DashboardCoberturaProps {
  recorridos: RecorridoGeo[];
  onCerrar: () => void;
}

function Stat({ label, valor, sub, color }: {
  label: string;
  valor: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      <span className={cn("text-2xl font-bold tabular-nums", color ?? "text-foreground")}>{valor}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function BarraZona({ zona, recorridos }: { zona: Zona; recorridos: RecorridoGeo[] }) {
  const todos = recorridos.filter((r) => r.zona === zona);
  const activos = todos.filter((r) => r.activo);
  const conArea = activos.filter((r) => r.area_geojson);
  const conTraza = activos.filter((r) => r.traza_geojson);
  const sinArea = activos.filter((r) => !r.area_geojson);

  if (todos.length === 0) return null;

  const pctArea = activos.length > 0 ? Math.round((conArea.length / activos.length) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold w-12">{zona}</span>
        <span className="text-[10px] text-muted-foreground">
          {activos.length} activos
          {todos.length > activos.length && ` · ${todos.length - activos.length} inactivos`}
        </span>
        {sinArea.length > 0 && (
          <Badge variant="destructive" className="text-[10px] h-4 px-1.5 ml-auto">
            {sinArea.length} sin área
          </Badge>
        )}
      </div>
      {/* Barra de cobertura área */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pctArea}%` }}
        />
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>
          <span className="text-green-600 dark:text-green-300 font-medium">{conArea.length}</span>/{activos.length} con área
        </span>
        <span>
          <span className="text-blue-600 dark:text-blue-300 font-medium">{conTraza.length}</span>/{activos.length} con traza
        </span>
      </div>
    </div>
  );
}

export function DashboardCobertura({ recorridos, onCerrar }: DashboardCoberturaProps) {
  const activos = recorridos.filter((r) => r.activo);
  const inactivos = recorridos.filter((r) => !r.activo);
  const conArea = activos.filter((r) => r.area_geojson);
  const conTraza = activos.filter((r) => r.traza_geojson);
  const sinArea = activos.filter((r) => !r.area_geojson);
  const sinTraza = activos.filter((r) => !r.traza_geojson);
  const completos = activos.filter((r) => r.area_geojson && r.traza_geojson);

  const pctArea = activos.length > 0 ? Math.round((conArea.length / activos.length) * 100) : 0;
  const pctTraza = activos.length > 0 ? Math.round((conTraza.length / activos.length) * 100) : 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[900] w-[520px] max-w-[calc(100vw-2rem)] bg-background/97 backdrop-blur-sm border rounded-xl shadow-xl">
      {/* Cabecera */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Dashboard de cobertura</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-auto"
          onClick={onCerrar}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="p-4 space-y-5">
        {/* Stats globales */}
        <div className="grid grid-cols-4 gap-4">
          <Stat label="Total recorridos" valor={recorridos.length} />
          <Stat label="Activos" valor={activos.length} color="text-green-600 dark:text-green-300" />
          <Stat label="Inactivos" valor={inactivos.length} color="text-muted-foreground" />
          <Stat label="Completos" valor={completos.length} sub="con área y traza" color="text-blue-600 dark:text-blue-300" />
        </div>

        {/* Barras de cobertura global */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Cobertura de área</span>
            <span className="ml-auto text-xs font-semibold">{pctArea}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pctArea}%` }} />
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span className="text-green-600 dark:text-green-300 font-medium">{conArea.length} con área</span>
            {sinArea.length > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3 w-3" />
                {sinArea.length} sin área: {sinArea.map((r) => r.codigo).slice(0, 5).join(", ")}
                {sinArea.length > 5 && ` +${sinArea.length - 5} más`}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Route className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Cobertura de traza</span>
            <span className="ml-auto text-xs font-semibold">{pctTraza}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pctTraza}%` }} />
          </div>
          {sinTraza.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Sin traza: {sinTraza.map((r) => r.codigo).slice(0, 8).join(", ")}
              {sinTraza.length > 8 && ` +${sinTraza.length - 8} más`}
            </p>
          )}
        </div>

        {/* Por zona */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por zona</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {ZONAS.map((zona) => (
              <BarraZona key={zona} zona={zona} recorridos={recorridos} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
