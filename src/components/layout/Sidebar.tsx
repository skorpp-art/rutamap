"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  PackageCheck, Users, Lock, MonitorSmartphone, LogOut, LogIn, ChevronsUpDown,
  PanelLeftClose, PanelLeftOpen, Route as RouteIcon, ChevronDown, ChevronRight,
  Search, MessageCircle, Boxes, ClipboardList, Map as MapIcon, Warehouse, History, FolderOpen, Trash2, Truck,
  CalendarClock, BarChart3, ShieldCheck, Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tieneSolapa } from "@/lib/permisos";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { PerfilActual } from "@/lib/perfil";

interface SidebarProps {
  perfil: PerfilActual | null;
}

interface ItemNav {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
  bloqueado?: boolean;
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "U";
}

const LS_KEY = "rm-sidebar-colapsado";
const LS_GROUPS = "rm-sidebar-grupos-colapsados";

interface GrupoNav {
  key: string;
  label: string;
  desc: string;
  items: ItemNav[];
}

export function Sidebar({ perfil }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Colapsado manual (persiste). Solo aplica en md+; en pantallas chicas
  // siempre queda en modo íconos por el ancho base.
  const [colapsado, setColapsado] = useState(false);
  useEffect(() => { setColapsado(localStorage.getItem(LS_KEY) === "1"); }, []);
  function toggleColapsar() {
    setColapsado(c => { const n = !c; localStorage.setItem(LS_KEY, n ? "1" : "0"); return n; });
  }

  // Grupos colapsables (persisten). Solo aplica en la barra expandida (md+).
  const [gruposCol, setGruposCol] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setGruposCol(JSON.parse(localStorage.getItem(LS_GROUPS) ?? "{}")); } catch { /* ignorar */ }
  }, []);
  function toggleGrupo(k: string) {
    setGruposCol(prev => {
      const n = { ...prev, [k]: !prev[k] };
      localStorage.setItem(LS_GROUPS, JSON.stringify(n));
      return n;
    });
  }

  // Reorganizado en 4 grupos por quién lo usa y para qué, no por orden de
  // aparición histórico: "Operación diaria" es lo que se toca a cada rato
  // (control y el chofer en la calle), "Planificación" es armar y revisar
  // la operación (más de escritorio, menos frecuente), "Depósito" queda
  // igual porque ya es su propio mundo, y "Cuenta" agrupa todo lo que no es
  // trabajo operativo sino configuración.
  const grupos: GrupoNav[] = [
    { key: "operacion", label: "Operación diaria", desc: "Lo que se toca a cada rato", items: [
      { href: "/pendientes", label: "Pendientes", icon: PackageCheck, visible: tieneSolapa(perfil, "pendientes") },
      { href: "/alternativas", label: "Alternativas", icon: MessageCircle, visible: tieneSolapa(perfil, "alternativas") },
      { href: "/casos", label: "Casos", icon: ClipboardList, visible: tieneSolapa(perfil, "casos") },
      { href: "/ruta", label: "Mi ruta", icon: RouteIcon, visible: tieneSolapa(perfil, "ruta") },
    ] },
    { key: "planificacion", label: "Planificación", desc: "Armar y revisar la operación", items: [
      { href: "/mapa", label: "Mapa", icon: MapIcon, visible: tieneSolapa(perfil, "mapa") },
      { href: "/carga", label: "Carga del Día", icon: Truck, visible: tieneSolapa(perfil, "carga") },
      { href: "/volumenes", label: "Planificación", icon: CalendarClock, visible: tieneSolapa(perfil, "volumenes") },
      { href: "/analisis-diario", label: "Resultados", icon: BarChart3, visible: tieneSolapa(perfil, "analisis") },
    ] },
    { key: "deposito", label: "Depósito", desc: "Guarda de bultos por cliente", items: [
      { href: "/deposito", label: "Control general", icon: Warehouse, visible: tieneSolapa(perfil, "deposito") },
      { href: "/deposito/clientes", label: "Clientes", icon: Users, visible: tieneSolapa(perfil, "deposito") },
      { href: "/deposito/directorio", label: "Directorio", icon: FolderOpen, visible: tieneSolapa(perfil, "deposito") },
      { href: "/deposito/control", label: "Control operativo", icon: Boxes, visible: tieneSolapa(perfil, "deposito") },
      { href: "/deposito/historial", label: "Remitos", icon: History, visible: tieneSolapa(perfil, "deposito") },
      { href: "/deposito/papelera", label: "Papelera", icon: Trash2, visible: tieneSolapa(perfil, "deposito") },
    ] },
    { key: "cuenta", label: "Cuenta", desc: "Usuarios y configuración", items: [
      { href: "/usuarios", label: "Usuarios", icon: Users, visible: perfil?.rol === "maestro" },
      { href: "/admin", label: "Administración", icon: ShieldCheck, visible: !!perfil?.es_superadmin },
      { href: "/descargar", label: "Instalar app", icon: MonitorSmartphone, visible: true },
    ] },
  ];

  // Lista plana (para el modo íconos, sin encabezados de grupo)
  const itemsPlanos = grupos.flatMap(g => g.items).filter(i => i.visible);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Etiqueta visible solo cuando está expandido (y en md+)
  const lblCls = colapsado ? "hidden" : "hidden md:block";

  // Botón de navegación reutilizado por la vista agrupada y la de íconos.
  function renderItem(item: ItemNav) {
    const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <button
        key={item.href}
        onClick={() => router.push(item.href)}
        title={item.bloqueado ? `${item.label} (requiere iniciar sesión)` : item.label}
        className={cn(
          "group relative z-10 flex items-center gap-3 h-10 rounded-lg px-2.5 md:px-3 transition-colors duration-150",
          activo ? "bg-brand-blue text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", colapsado ? "mx-auto" : "mx-auto md:mx-0")} />
        <span className={cn("text-sm font-medium truncate", lblCls)}>{item.label}</span>
        {item.bloqueado && (
          <Lock className={cn("h-2.5 w-2.5 text-white/40", colapsado ? "absolute bottom-1 left-7" : "absolute bottom-1 left-7 md:static md:ml-auto")} />
        )}
        {/* Tooltip cuando está colapsado */}
        <span className={cn("pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-black/90 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg",
          colapsado ? "block" : "md:hidden")}>
          {item.label}
        </span>
      </button>
    );
  }

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
            className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
              perfil?.empresa?.logo_url ? "bg-white ring-1 ring-white/10" : "bg-gradient-to-br from-brand-blue to-blue-900 ring-1 ring-white/10",
              colapsado ? "mx-auto" : "mx-auto md:mx-0")}
            title={perfil?.empresa?.nombre ?? "RutaMap"}
          >
            {perfil?.empresa?.logo_url ? (
              // Logo propio de cada empresa: puede venir de cualquier dominio.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.empresa.logo_url} alt={perfil.empresa.nombre} className="h-full w-full object-contain p-1" />
            ) : (
              <Truck className="h-4 w-4 text-white" />
            )}
          </button>
          {perfil?.empresa?.logo_url ? (
            <span className={cn("font-bold text-white text-lg tracking-tight leading-tight truncate", lblCls)}>
              {perfil.empresa.nombre}
            </span>
          ) : (
            <span className={cn("font-bold text-white text-2xl tracking-tight leading-none", lblCls)}>
              Ruta<span className="text-blue-300">Map</span>
            </span>
          )}
          <button onClick={toggleColapsar} title="Colapsar barra"
            className={cn("ml-auto h-8 w-8 rounded-md text-white/40 hover:text-white hover:bg-white/10 items-center justify-center transition-colors hidden md:inline-flex",
              colapsado && "md:hidden")}>
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        {/* Botón expandir cuando está colapsado (solo md+) */}
        <button onClick={toggleColapsar} title="Expandir barra"
          className={cn("mt-2 mx-auto h-8 w-8 rounded-md text-white/40 hover:text-white hover:bg-white/10 items-center justify-center transition-colors hidden",
            colapsado && "md:flex")}>
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>

      {/* Buscador global (⌘K) — vive acá para que las pantallas no necesiten
          una barra superior propia solo para alojarlo. */}
      <div className="px-2 mb-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("rm-open-command-palette"))}
          title="Buscar (⌘K)"
          className="w-full flex items-center gap-2.5 h-9 rounded-lg px-2.5 md:px-3 bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Search className={cn("h-[18px] w-[18px] shrink-0", colapsado ? "mx-auto" : "mx-auto md:mx-0")} />
          <span className={cn("text-sm truncate", lblCls)}>Buscar…</span>
          <kbd className={cn("ml-auto text-xs font-medium text-white/40", lblCls)}>⌘K</kbd>
        </button>
      </div>

      {/* Navegación */}
      <nav className="relative flex-1 px-2 overflow-y-auto scrollbar-thin">
        {/* Vista agrupada con secciones colapsables (barra expandida, md+) */}
        <div className={cn("flex-col", colapsado ? "hidden" : "hidden md:flex")}>
          {grupos.map(g => {
            const vis = g.items.filter(i => i.visible);
            if (!vis.length) return null;
            const cerrado = !!gruposCol[g.key];
            return (
              <div key={g.key} className="mb-0.5">
                <button onClick={() => toggleGrupo(g.key)} title={g.desc}
                  className="w-full flex items-center gap-1 px-2 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
                  {cerrado ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{g.label}</span>
                </button>
                {!cerrado && (
                  <>
                    {/* Excepción al piso de 12px: en una columna de 224px el
                        subtítulo se partía en dos líneas. Es texto secundario,
                        no interactivo, así que va un punto más chico. */}
                    <p className="px-2 pl-6 pb-1.5 text-[11px] leading-tight text-white/25">{g.desc}</p>
                    <div className="flex flex-col gap-0.5">{vis.map(renderItem)}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Vista de íconos (barra colapsada o pantallas chicas): lista plana */}
        <div className={cn("flex flex-col gap-0.5", colapsado ? "flex" : "md:hidden")}>
          {itemsPlanos.map(renderItem)}
        </div>
      </nav>

      {/* Pie: tema + perfil */}
      <div className="px-2 pt-2 mt-1 border-t border-white/5 space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className={cn("text-xs uppercase tracking-widest text-white/30 pl-1", lblCls)}>Modo</span>
          <ThemeToggle className="mx-auto md:mx-0" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 h-11 rounded-lg px-1.5 md:px-2 text-white/80 hover:bg-white/10 transition-colors">
                <span className={cn("h-8 w-8 rounded-full bg-brand-blue flex items-center justify-center shrink-0 text-xs font-bold text-white", colapsado ? "mx-auto" : "mx-auto md:mx-0")}>
                  {iniciales(perfil?.nombre ?? "U")}
                </span>
                <span className={cn("flex-col items-start min-w-0 flex-1", colapsado ? "hidden" : "hidden md:flex")}>
                  <span className="text-sm font-medium leading-tight truncate max-w-[120px]">{perfil?.nombre ?? "Usuario"}</span>
                  <span className="text-xs text-white/40 leading-tight truncate max-w-[120px]">
                    {perfil?.empresa?.nombre ?? perfil?.rol ?? "—"}
                  </span>
                </span>
                <ChevronsUpDown className={cn("h-3.5 w-3.5 text-white/40 shrink-0", colapsado ? "hidden" : "hidden md:block")} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-0.5">
                  <span className="font-medium">{perfil?.nombre ?? "Usuario"}</span>
                  <span className="text-xs text-muted-foreground capitalize font-normal">{perfil?.rol ?? "—"}</span>
                  {perfil?.empresa && (
                    <span className="text-xs text-muted-foreground font-normal">{perfil.empresa.nombre}</span>
                  )}
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
      </div>
    </aside>
  );
}
