"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MapPin, User, Search, RefreshCw, TrendingUp, TrendingDown, Minus, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMapStore } from "@/stores/mapStore";
import { useVolumenesStore } from "@/stores/volumenesStore";
import { cn } from "@/lib/utils";
import type { Perfil, Zona } from "@/types/database.types";

interface HeaderProps {
  perfil: Perfil | null;
  esInvitado?: boolean;
}

const ZONAS: { valor: Zona | "todas"; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas las zonas" },
  { valor: "CABA", etiqueta: "CABA" },
  { valor: "Norte", etiqueta: "GBA Norte" },
  { valor: "Sur", etiqueta: "GBA Sur" },
  { valor: "Oeste", etiqueta: "GBA Oeste" },
];

// Título de sección según la ruta actual
const TITULOS: { match: (p: string) => boolean; titulo: string }[] = [
  { match: p => p === "/", titulo: "Mapa de Recorridos" },
  { match: p => p.startsWith("/carga"), titulo: "Carga del Día" },
  { match: p => p.startsWith("/volumenes"), titulo: "Volúmenes" },
  { match: p => p.startsWith("/analisis-diario"), titulo: "Resultados" },
  { match: p => p.startsWith("/pendientes"), titulo: "Pendientes" },
  { match: p => p.startsWith("/usuarios"), titulo: "Usuarios" },
  { match: p => p.startsWith("/descargar"), titulo: "Instalar app" },
];

export function Header({ perfil, esInvitado = false }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { filtros, setFiltroZona } = useMapStore();
  const kpis = useVolumenesStore((s) => s.kpis);
  const onRefrescar = useVolumenesStore((s) => s.onRefrescar);

  const esMapa = pathname === "/";
  const titulo = TITULOS.find(t => t.match(pathname))?.titulo ?? "RutaMap";

  function handleZonaChange(valor: string) {
    setFiltroZona(valor === "todas" ? null : (valor as Zona));
  }

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
      {/* Título de sección */}
      <h1 className="text-base font-bold tracking-tight shrink-0">{titulo}</h1>

      {/* Selector de zona — solo en el mapa */}
      {esMapa && (
        <>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0" />
            <Select value={filtros.zona ?? "todas"} onValueChange={handleZonaChange}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONAS.map((z) => (
                  <SelectItem key={z.valor} value={z.valor}>{z.etiqueta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* KPIs de Volúmenes (solo en /volumenes) */}
      {pathname === "/volumenes" && kpis && (
        <div className="hidden md:flex items-center gap-3.5 ml-1 overflow-x-auto no-scrollbar">
          <KpiItem label="Hoy" valor={kpis.hoyTotal ? kpis.hoyTotal.toLocaleString("es-AR") : "—"}
            sub={kpis.choferesHoy > 0 ? `${kpis.choferesHoy} chof.` : "sin datos"} color="text-blue-600 dark:text-blue-300" />
          <Sep />
          <KpiItem label="Semana" valor={kpis.semanaTotal ? kpis.semanaTotal.toLocaleString("es-AR") : "—"}
            sub={`${kpis.semanaDias} días`} color="text-foreground" />
          <Sep />
          <KpiItem label="vs ant." color={kpis.vsAnteriorPct > 2 ? "text-emerald-600 dark:text-emerald-400" : kpis.vsAnteriorPct < -2 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}
            valor={
              <span className="flex items-center gap-0.5">
                <DeltaIcon pct={kpis.vsAnteriorPct} />
                {kpis.vsAnteriorPct !== 0 ? `${kpis.vsAnteriorPct > 0 ? "+" : ""}${kpis.vsAnteriorPct}%` : "—"}
              </span>
            }
            sub={kpis.anteriorTotal ? kpis.anteriorTotal.toLocaleString("es-AR") : "—"} />
          {kpis.proyectadoTotal != null && (
            <>
              <Sep />
              <KpiItem label="Proy. mañana" valor={kpis.proyectadoTotal.toLocaleString("es-AR")}
                sub={`confianza ${kpis.confianza ?? "—"}`} color="text-emerald-600 dark:text-emerald-400" />
            </>
          )}
          {kpis.precisionPct != null && (
            <>
              <Sep />
              <KpiItem label="Precisión" valor={`${kpis.precisionPct}%`} sub="real vs esperado"
                color={kpis.precisionPct >= 85 ? "text-emerald-600 dark:text-emerald-400" : kpis.precisionPct >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"} />
            </>
          )}
          {onRefrescar && (
            <button onClick={() => onRefrescar()} disabled={kpis.cargando}
              className="ml-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Actualizar">
              <RefreshCw className={cn("h-3.5 w-3.5", kpis.cargando && "animate-spin")} />
            </button>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Buscador / paleta de comandos (⌘K) */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("rm-open-command-palette"))}
        className="hidden md:inline-flex items-center gap-2 h-8 pl-2.5 pr-1.5 rounded-lg bg-muted/60 border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs"
        title="Buscar (⌘K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar…</span>
        <kbd className="inline-flex items-center gap-0.5 rounded bg-background border px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      {/* Chip de zona activa (mapa) */}
      {esMapa && filtros.zona && (
        <span className="hidden sm:inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-3 py-1 text-xs text-blue-700 dark:text-blue-300 font-medium">
          Zona: {filtros.zona}
        </span>
      )}

      {/* Invitado → botón de login (el perfil del usuario vive en el sidebar) */}
      {esInvitado && (
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Modo invitado
          </span>
          <Button size="sm" className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5 h-8"
            onClick={() => router.push("/login")}>
            <LogIn className="h-3.5 w-3.5" /> Iniciar sesión
          </Button>
        </div>
      )}
    </header>
  );
}

function Sep() {
  return <div className="h-7 w-px bg-border shrink-0" />;
}

function DeltaIcon({ pct }: { pct: number }) {
  const Icon = pct > 2 ? TrendingUp : pct < -2 ? TrendingDown : Minus;
  return <Icon className="h-3.5 w-3.5" />;
}

function KpiItem({ label, valor, sub, color }: { label: string; valor: ReactNode; sub: string; color: string }) {
  return (
    <div className="text-center shrink-0">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums leading-tight", color)}>{valor}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
    </div>
  );
}
