"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Map, Package, BarChart3, PackageCheck, Users, Lock, Truck, ClipboardList,
  MonitorSmartphone, LogOut, LogIn, ChevronsUpDown, PanelLeftClose, PanelLeftOpen,
  Route as RouteIcon,
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

const LS_KEY = "rm-sidebar-colapsado";

export function Sidebar({ perfil, esInvitado = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Colapsado manual (persiste). Solo aplica en md+; en pantallas chicas
  // siempre queda en modo íconos por el ancho base.
  const [colapsado, setColapsado] = useState(false);
  useEffect(() => { setColapsado(localStorage.getItem(LS_KEY) === "1"); }, []);
  function toggleColapsar() {
    setColapsado(c => { const n = !c; localStorage.setItem(LS_KEY, n ? "1" : "0"); return n; });
  }

  const items: ItemNav[] = [
    { href: "/carga", label: "Carga del Día", icon: ClipboardList, visible: !esInvitado && tieneSolapa(perfil, "carga") },
    { href: "/", label: "Mapa", icon: Map, visible: tieneSolapa(perfil, "mapa") || esInvitado },
    { href: "/volumenes", label: "Volúmenes", icon: Package, visible: esInvitado || tieneSolapa(perfil, "volumenes"), bloqueado: esInvitado },
    { href: "/analisis-diario", label: "Resultados", icon: BarChart3, visible: esInvitado || tieneSolapa(perfil, "analisis"), bloqueado: esInvitado },
    { href: "/pendientes", label: "Pendientes", icon: PackageCheck, visible: !esInvitado && tieneSolapa(perfil, "pendientes") },
    { href: "/ruta", label: "Mi ruta", icon: RouteIcon, visible: !esInvitado },
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

  // Etiqueta visible solo cuando está expandido (y en md+)
  const lblCls = colapsado ? "hidden" : "hidden md:block";

  return (
    <aside className={cn(
      "w-16 shrink-0 bg-brand-black border-r border-white/5 flex flex-col py-3 transition-[width] duration-200",
      !colapsado && "md:w-56"
    )}>
      {/* Logo + colapsar */}
      <div className="mb-3 px-2 md:px-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push("/")}
            className={cn("h-9 w-9 rounded-lg bg-gradient-to-br from-brand-blue to-blue-900 shadow-md ring-1 ring-white/10 flex items-center justify-center shrink-0",
              colapsado ? "mx-auto" : "mx-auto md:mx-0")}
            title="RutaMap"
          >
            <Truck className="h-4 w-4 text-white" />
          </button>
          <span className={cn("font-bold text-white text-lg tracking-tight leading-none", lblCls)}>
            Ruta<span className="text-blue-300">Map</span>
          </span>
          <button onClick={toggleColapsar} title="Colapsar barra"
            className={cn("ml-auto h-7 w-7 rounded-md text-white/40 hover:text-white hover:bg-white/10 items-center justify-center transition-colors hidden md:inline-flex",
              colapsado && "md:hidden")}>
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        {/* Botón expandir cuando está colapsado (solo md+) */}
        <button onClick={toggleColapsar} title="Expandir barra"
          className={cn("mt-2 mx-auto h-7 w-7 rounded-md text-white/40 hover:text-white hover:bg-white/10 items-center justify-center transition-colors hidden",
            colapsado && "md:flex")}>
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="relative flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto scrollbar-thin">
        {/* Indicador azul que se desliza entre secciones (h-10=40px + gap 2px = 42px) */}
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
                activo ? "text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", colapsado ? "mx-auto" : "mx-auto md:mx-0")} />
              <span className={cn("text-sm font-medium truncate", lblCls)}>{item.label}</span>
              {item.bloqueado && (
                <Lock className={cn("h-2.5 w-2.5 text-white/40", colapsado ? "absolute bottom-1 left-7" : "absolute bottom-1 left-7 md:static md:ml-auto")} />
              )}
              {/* Tooltip cuando está colapsado */}
              <span className={cn("pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-black/90 text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg",
                colapsado ? "block" : "md:hidden")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Pie: tema + perfil */}
      <div className="px-2 pt-2 mt-1 border-t border-white/5 space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className={cn("text-[10px] uppercase tracking-widest text-white/30 pl-1", lblCls)}>Modo</span>
          <ThemeToggle className="mx-auto md:mx-0" />
        </div>

        {esInvitado ? (
          <button
            onClick={() => router.push("/login")}
            className="w-full flex items-center gap-2.5 h-10 rounded-lg px-2.5 md:px-3 bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors"
          >
            <LogIn className={cn("h-[18px] w-[18px] shrink-0", colapsado ? "mx-auto" : "mx-auto md:mx-0")} />
            <span className={cn("text-sm font-medium", lblCls)}>Iniciar sesión</span>
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 h-11 rounded-lg px-1.5 md:px-2 text-white/80 hover:bg-white/10 transition-colors">
                <span className={cn("h-8 w-8 rounded-full bg-brand-blue flex items-center justify-center shrink-0 text-xs font-bold text-white", colapsado ? "mx-auto" : "mx-auto md:mx-0")}>
                  {iniciales(perfil?.nombre ?? "U")}
                </span>
                <span className={cn("flex-col items-start min-w-0 flex-1", colapsado ? "hidden" : "hidden md:flex")}>
                  <span className="text-sm font-medium leading-tight truncate max-w-[120px]">{perfil?.nombre ?? "Usuario"}</span>
                  <span className="text-[11px] text-white/40 capitalize leading-tight">{perfil?.rol ?? "—"}</span>
                </span>
                <ChevronsUpDown className={cn("h-3.5 w-3.5 text-white/40 shrink-0", colapsado ? "hidden" : "hidden md:block")} />
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
