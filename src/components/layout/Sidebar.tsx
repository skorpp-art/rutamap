"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Map, Package, BarChart3, PackageCheck, Users, Lock, Truck, ClipboardList,
  MonitorSmartphone, LogOut, LogIn, ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tieneSolapa } from "@/lib/permisos";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/types/database.types";

interface SidebarProps {
  perfil: Perfil | null;
  esInvitado?: boolean;
}

interface ItemNav {
  href: string;
  label: string;
  icon: typeof Map;
  visible: boolean;
  bloqueado?: boolean;
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function Sidebar({ perfil, esInvitado = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const items: ItemNav[] = [
    { href: "/carga", label: "Carga del Día", icon: ClipboardList, visible: !esInvitado && tieneSolapa(perfil, "carga") },
    { href: "/", label: "Mapa", icon: Map, visible: tieneSolapa(perfil, "mapa") || esInvitado },
    { href: "/volumenes", label: "Volúmenes", icon: Package, visible: esInvitado || tieneSolapa(perfil, "volumenes"), bloqueado: esInvitado },
    { href: "/analisis-diario", label: "Análisis del Día", icon: BarChart3, visible: esInvitado || tieneSolapa(perfil, "analisis"), bloqueado: esInvitado },
    { href: "/pendientes", label: "Pendientes", icon: PackageCheck, visible: !esInvitado && tieneSolapa(perfil, "pendientes") },
    { href: "/usuarios", label: "Usuarios", icon: Users, visible: perfil?.rol === "maestro" },
    { href: "/descargar", label: "Instalar app", icon: MonitorSmartphone, visible: !esInvitado },
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibles = items.filter(i => i.visible);
  const activeIndex = visibles.findIndex(i => i.href === "/" ? pathname === "/" : pathname.startsWith(i.href));

  return (
    <aside className="w-16 md:w-56 shrink-0 bg-brand-black border-r border-white/5 flex flex-col py-3">
      {/* Logo */}
      <button
        onClick={() => router.push("/")}
        className="mx-2 md:mx-3 mb-4 flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-white/5 transition-colors shrink-0"
        title="RutaMap"
      >
        <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-blue to-blue-900 shadow-md ring-1 ring-white/10 flex items-center justify-center shrink-0 mx-auto md:mx-0">
          <Truck className="h-4 w-4 text-white" />
        </span>
        <span className="hidden md:block font-bold text-white text-lg tracking-tight leading-none">
          Ruta<span className="text-blue-300">Map</span>
        </span>
      </button>

      {/* Navegación */}
      <nav className="relative flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto scrollbar-thin">
        {/* Indicador azul que se desliza entre secciones (los ítems miden h-10=40px + gap 2px = 42px) */}
        {activeIndex >= 0 && (
          <span aria-hidden
            className="absolute top-0 left-2 right-2 h-10 rounded-lg bg-brand-blue shadow-sm z-0 transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${activeIndex * 42}px)` }} />
        )}
        {visibles.map(item => {
          const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={item.bloqueado ? `${item.label} (requiere iniciar sesión)` : item.label}
              className={cn(
                "group relative z-10 flex items-center gap-3 h-10 rounded-lg px-2.5 md:px-3 transition-colors duration-150",
                activo
                  ? "text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0 mx-auto md:mx-0" />
              <span className="hidden md:block text-sm font-medium truncate">{item.label}</span>
              {item.bloqueado && (
                <Lock className="h-2.5 w-2.5 absolute bottom-1 left-7 md:static md:ml-auto text-white/40 bg-brand-black md:bg-transparent rounded-full p-0.5 md:p-0" />
              )}
              {/* Tooltip solo cuando está colapsado (móvil/tablet chica) */}
              <span className="md:hidden pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-black/90 text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Pie: tema + perfil */}
      <div className="px-2 pt-2 mt-1 border-t border-white/5 space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="hidden md:block text-[10px] uppercase tracking-widest text-white/30 pl-1">Modo</span>
          <ThemeToggle className="mx-auto md:mx-0" />
        </div>

        {esInvitado ? (
          <button
            onClick={() => router.push("/login")}
            className="w-full flex items-center gap-2.5 h-10 rounded-lg px-2.5 md:px-3 bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors"
          >
            <LogIn className="h-[18px] w-[18px] shrink-0 mx-auto md:mx-0" />
            <span className="hidden md:block text-sm font-medium">Iniciar sesión</span>
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 h-11 rounded-lg px-1.5 md:px-2 text-white/80 hover:bg-white/10 transition-colors">
                <span className="h-8 w-8 rounded-full bg-brand-blue flex items-center justify-center shrink-0 text-xs font-bold text-white mx-auto md:mx-0">
                  {iniciales(perfil?.nombre ?? "U")}
                </span>
                <span className="hidden md:flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-medium leading-tight truncate max-w-[120px]">{perfil?.nombre ?? "Usuario"}</span>
                  <span className="text-[11px] text-white/40 capitalize leading-tight">{perfil?.rol ?? "—"}</span>
                </span>
                <ChevronsUpDown className="hidden md:block h-3.5 w-3.5 text-white/40 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-0.5">
                  <span className="font-medium">{perfil?.nombre ?? "Usuario"}</span>
                  <span className="text-xs text-muted-foreground capitalize font-normal">{perfil?.rol ?? "—"}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {perfil?.rol === "maestro" && (
                <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/usuarios")}>
                  <Users className="h-4 w-4" /> Usuarios
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
