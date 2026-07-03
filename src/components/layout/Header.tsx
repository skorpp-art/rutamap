"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MapPin, LogOut, User, Users, ChevronDown, Truck, Map, Package, Lock, LogIn, Search, RefreshCw, TrendingUp, TrendingDown, Minus, BarChart3, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useMapStore } from "@/stores/mapStore";
import { useVolumenesStore } from "@/stores/volumenesStore";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
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

export function Header({ perfil, esInvitado = false }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { filtros, setFiltroZona } = useMapStore();
  const kpis = useVolumenesStore((s) => s.kpis);
  const onRefrescar = useVolumenesStore((s) => s.onRefrescar);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleZonaChange(valor: string) {
    setFiltroZona(valor === "todas" ? null : (valor as Zona));
  }

  return (
    <>
    <header className="h-14 bg-brand-black border-b border-white/5 flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 select-none">
        <div className="bg-gradient-to-br from-brand-blue to-blue-900 rounded-lg p-1.5 shadow-md ring-1 ring-white/10">
          <Truck className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-white text-lg tracking-tight">
          Ruta<span className="text-blue-300">Map</span>
        </span>
      </div>

      {/* Separador */}
      <div className="h-6 w-px bg-white/10" />

      {/* Selector de zona */}
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-blue-300 shrink-0" />
        <Select
          value={filtros.zona ?? "todas"}
          onValueChange={handleZonaChange}
        >
          <SelectTrigger className="w-44 h-8 bg-white/5 border-white/10 text-white text-sm hover:bg-white/10 focus:ring-blue-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZONAS.map((z) => (
              <SelectItem key={z.valor} value={z.valor}>
                {z.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs de Volúmenes (solo en /volumenes) */}
      {pathname === "/volumenes" && kpis && (
        <div className="hidden md:flex items-center gap-3.5 ml-2 overflow-x-auto no-scrollbar">
          <KpiItem label="Hoy" valor={kpis.hoyTotal ? kpis.hoyTotal.toLocaleString("es-AR") : "—"}
            sub={kpis.choferesHoy > 0 ? `${kpis.choferesHoy} chof.` : "sin datos"} color="text-blue-300" />
          <Sep />
          <KpiItem label="Semana" valor={kpis.semanaTotal ? kpis.semanaTotal.toLocaleString("es-AR") : "—"}
            sub={`${kpis.semanaDias} días`} color="text-white" />
          <Sep />
          <KpiItem label="vs ant." color={kpis.vsAnteriorPct > 2 ? "text-emerald-400" : kpis.vsAnteriorPct < -2 ? "text-red-400" : "text-white/70"}
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
                sub={`confianza ${kpis.confianza ?? "—"}`} color="text-emerald-400" />
            </>
          )}
          {kpis.precisionPct != null && (
            <>
              <Sep />
              <KpiItem label="Precisión" valor={`${kpis.precisionPct}%`} sub="real vs esperado"
                color={kpis.precisionPct >= 85 ? "text-emerald-400" : kpis.precisionPct >= 70 ? "text-amber-400" : "text-red-400"} />
            </>
          )}
          {onRefrescar && (
            <button onClick={() => onRefrescar()} disabled={kpis.cargando}
              className="ml-1 p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              title="Actualizar">
              <RefreshCw className={cn("h-3.5 w-3.5", kpis.cargando && "animate-spin")} />
            </button>
          )}
        </div>
      )}

      {/* Espacio flexible */}
      <div className="flex-1" />

      {/* Buscador / paleta de comandos (⌘K) */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("rm-open-command-palette"))}
        className="hidden md:inline-flex items-center gap-2 h-8 pl-2.5 pr-1.5 rounded-md bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors text-xs"
        title="Buscar (⌘K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar…</span>
        <kbd className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">⌘K</kbd>
      </button>

      {/* Toggle claro/oscuro */}
      <ThemeToggle />

      {/* Indicador de zona activa */}
      {filtros.zona && (
        <span className="hidden sm:inline-flex items-center rounded-full bg-brand-blue/20 border border-brand-blue/40 px-3 py-1 text-xs text-blue-300 font-medium">
          Zona: {filtros.zona}
        </span>
      )}

      {/* Invitado → botón Iniciar sesión · Usuario → menú */}
      {esInvitado ? (
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-white/60">
            <User className="h-3.5 w-3.5" /> Modo invitado
          </span>
          <Button
            size="sm"
            className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5 h-8"
            onClick={() => router.push("/login")}
          >
            <LogIn className="h-3.5 w-3.5" />
            Iniciar sesión
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white gap-2"
            >
              <div className="h-7 w-7 rounded-full bg-brand-blue flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="hidden sm:inline text-sm">
                {perfil?.nombre ?? "Usuario"}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-0.5">
                <span className="font-medium">{perfil?.nombre ?? "Usuario"}</span>
                <span className="text-xs text-muted-foreground capitalize font-normal">
                  {perfil?.rol ?? "—"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {perfil?.rol === "maestro" && (
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/usuarios")}>
                <Users className="h-4 w-4" />
                Usuarios
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>

    {/* Navegación flotante (esquina inferior derecha) */}
    <div className="fixed bottom-5 right-5 z-[1000] flex items-center gap-1 p-1 rounded-full bg-brand-black/90 backdrop-blur-md border border-white/10 shadow-xl shadow-black/30">
      <button
        onClick={() => router.push("/")}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150",
          pathname === "/" ? "bg-brand-blue text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
        )}
      >
        <Map className="h-4 w-4" />
        Mapa
      </button>
      <button
        onClick={() => router.push("/volumenes")}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150",
          pathname === "/volumenes" ? "bg-brand-blue text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
        )}
        title={esInvitado ? "Requiere iniciar sesión" : "Gestión de volúmenes"}
      >
        <Package className="h-4 w-4" />
        Volúmenes
        {esInvitado && <Lock className="h-3 w-3 opacity-60" />}
      </button>
      <button
        onClick={() => router.push("/analisis-diario")}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150",
          pathname === "/analisis-diario" ? "bg-brand-blue text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
        )}
        title={esInvitado ? "Requiere iniciar sesión" : "Análisis del día"}
      >
        <BarChart3 className="h-4 w-4" />
        Análisis del Día
        {esInvitado && <Lock className="h-3 w-3 opacity-60" />}
      </button>
      {!esInvitado && (
        <button
          onClick={() => router.push("/pendientes")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150",
            pathname === "/pendientes" ? "bg-brand-blue text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
          )}
          title="Control de pendientes del día"
        >
          <PackageCheck className="h-4 w-4" />
          Pendientes
        </button>
      )}
    </div>
    </>
  );
}

function Sep() {
  return <div className="h-7 w-px bg-white/10 shrink-0" />;
}

function DeltaIcon({ pct }: { pct: number }) {
  const Icon = pct > 2 ? TrendingUp : pct < -2 ? TrendingDown : Minus;
  return <Icon className="h-3.5 w-3.5" />;
}

function KpiItem({
  label, valor, sub, color,
}: {
  label: string;
  valor: ReactNode;
  sub: string;
  color: string;
}) {
  return (
    <div className="text-center shrink-0">
      <p className="text-[10px] uppercase tracking-widest text-white/40 leading-tight">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums leading-tight", color)}>{valor}</p>
      <p className="text-[10px] text-white/40 leading-tight">{sub}</p>
    </div>
  );
}
