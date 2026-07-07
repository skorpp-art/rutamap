"use client";

import { useRouter, usePathname } from "next/navigation";
import { Map, Package, BarChart3, PackageCheck, Users, Lock, Truck, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { tieneSolapa } from "@/lib/permisos";
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

export function Sidebar({ perfil, esInvitado = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const items: ItemNav[] = [
    { href: "/", label: "Mapa", icon: Map, visible: tieneSolapa(perfil, "mapa") || esInvitado },
    { href: "/volumenes", label: "Volúmenes", icon: Package, visible: esInvitado || tieneSolapa(perfil, "volumenes"), bloqueado: esInvitado },
    { href: "/analisis-diario", label: "Análisis del Día", icon: BarChart3, visible: esInvitado || tieneSolapa(perfil, "analisis"), bloqueado: esInvitado },
    { href: "/carga", label: "Carga del Día", icon: ClipboardList, visible: !esInvitado && tieneSolapa(perfil, "carga") },
    { href: "/pendientes", label: "Pendientes", icon: PackageCheck, visible: !esInvitado && tieneSolapa(perfil, "pendientes") },
    { href: "/usuarios", label: "Usuarios", icon: Users, visible: perfil?.rol === "maestro" },
  ];

  return (
    <aside className="w-14 shrink-0 bg-brand-black border-r border-white/5 flex flex-col items-center py-3 gap-1">
      {/* Logo */}
      <button
        onClick={() => router.push("/")}
        className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-blue to-blue-900 shadow-md ring-1 ring-white/10 flex items-center justify-center mb-2 shrink-0"
        title="RutaMap"
      >
        <Truck className="h-4 w-4 text-white" />
      </button>

      <nav className="flex flex-col items-center gap-1 flex-1">
        {items.filter(i => i.visible).map(item => {
          const activo = pathname === item.href;
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={item.bloqueado ? `${item.label} (requiere iniciar sesión)` : item.label}
              className={cn(
                "relative h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-150 group",
                activo
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.bloqueado && (
                <Lock className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-white/50 bg-brand-black rounded-full p-0.5" />
              )}
              {/* Tooltip al hover */}
              <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-black/90 text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
