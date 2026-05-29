"use client";

import { useRouter } from "next/navigation";
import { MapPin, LogOut, User, ChevronDown, Truck } from "lucide-react";
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
}

const ZONAS: { valor: Zona | "todas"; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas las zonas" },
  { valor: "CABA", etiqueta: "CABA" },
  { valor: "Norte", etiqueta: "GBA Norte" },
  { valor: "Sur", etiqueta: "GBA Sur" },
  { valor: "Oeste", etiqueta: "GBA Oeste" },
];

export function Header({ perfil }: HeaderProps) {
  const router = useRouter();
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
    <header className="h-14 bg-brand-black border-b border-brand-blue/30 flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 select-none">
        <div className="bg-brand-blue rounded-md p-1.5">
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

      {/* Espacio flexible */}
      <div className="flex-1" />

      {/* Indicador de zona activa */}
      {filtros.zona && (
        <span className="hidden sm:inline-flex items-center rounded-full bg-brand-blue/20 border border-brand-blue/40 px-3 py-1 text-xs text-brand-sky font-medium">
          Zona: {filtros.zona}
        </span>
      )}

      {/* Menú de usuario */}
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
    </header>
  );
}
