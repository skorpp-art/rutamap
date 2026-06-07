"use client";

import { useRouter, usePathname } from "next/navigation";
import { MapPin, LogOut, User, ChevronDown, Truck, Map, Package, Lock, LogIn } from "lucide-react";
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
import { useMapStore } from "@/stores/mapStore";
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
    <header className="h-14 bg-brand-black border-b border-white/5 flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 select-none">
        <div className="bg-gradient-to-br from-brand-blue to-brand-violet rounded-lg p-1.5 shadow-md ring-1 ring-white/10">
          <Truck className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-white text-lg tracking-tight">
          Ruta<span className="text-brand-sky">Map</span>
        </span>
      </div>

      {/* Separador */}
      <div className="h-6 w-px bg-white/10" />

      {/* Selector de zona */}
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-brand-sky shrink-0" />
        <Select
          value={filtros.zona ?? "todas"}
          onValueChange={handleZonaChange}
        >
          <SelectTrigger className="w-44 h-8 bg-white/5 border-white/10 text-white text-sm hover:bg-white/10 focus:ring-brand-sky">
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

      {/* Navegación entre vistas */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => router.push("/")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            pathname === "/" ? "bg-brand-blue text-white shadow-sm ring-1 ring-white/10" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Map className="h-3.5 w-3.5" />
          Mapa
        </button>
        <button
          onClick={() => router.push("/volumenes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            pathname === "/volumenes" ? "bg-brand-blue text-white shadow-sm ring-1 ring-white/10" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
          title={esInvitado ? "Requiere iniciar sesión" : "Gestión de volúmenes"}
        >
          <Package className="h-3.5 w-3.5" />
          Volúmenes
          {esInvitado && <Lock className="h-3 w-3 opacity-60" />}
        </button>
      </div>

      {/* Espacio flexible */}
      <div className="flex-1" />

      {/* Indicador de zona activa */}
      {filtros.zona && (
        <span className="hidden sm:inline-flex items-center rounded-full bg-brand-blue/20 border border-brand-blue/40 px-3 py-1 text-xs text-brand-sky font-medium">
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
  );
}
