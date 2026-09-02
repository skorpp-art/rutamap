"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  PackageCheck, Warehouse, Users, Boxes, History, Route as RouteIcon,
  Search, CornerDownLeft, Truck, Sun, Moon, MessageCircle,
  ClipboardList,
  Map as MapIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Comando = {
  id: string;
  titulo: string;
  grupo: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  accion: () => void;
};

/**
 * Paleta de comandos global (⌘K / Ctrl+K).
 * Navegación instantánea entre vistas y pestañas de la app.
 */
export function CommandPalette({ esInvitado = false }: { esInvitado?: boolean }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [activo, setActivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Atajo global ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto(v => !v);
      }
    }
    function onOpen() { setAbierto(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("rm-open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rm-open-command-palette", onOpen);
    };
  }, []);

  const cerrarYNavegar = useCallback((path: string) => {
    setAbierto(false);
    router.push(path);
  }, [router]);

  const comandos = useMemo<Comando[]>(() => {
    const base: Comando[] = [];
    if (!esInvitado) {
      base.push(
        { id: "pendientes", titulo: "Ir a Pendientes", grupo: "Navegación", keywords: "pendientes recepcion bultos recibido retenido", icon: PackageCheck, accion: () => cerrarYNavegar("/pendientes") },
        { id: "mapa", titulo: "Ir al Mapa", grupo: "Navegación", keywords: "mapa recorridos zonas geojson cobertura", icon: MapIcon, accion: () => cerrarYNavegar("/mapa") },
        { id: "alternativas", titulo: "Ir a Alternativas", grupo: "Navegación", keywords: "alternativas demoras whatsapp etiquetas redespacho no entregado direccion", icon: MessageCircle, accion: () => cerrarYNavegar("/alternativas") },
        { id: "casos", titulo: "Ir a Casos", grupo: "Navegación", keywords: "casos incidencias reclamos asesoria coordinacion excel seguimiento", icon: ClipboardList, accion: () => cerrarYNavegar("/casos") },
        { id: "deposito", titulo: "Ir al Depósito", grupo: "Navegación", keywords: "deposito guarda bultos stock galpon", icon: Warehouse, accion: () => cerrarYNavegar("/deposito") },
        { id: "dep-clientes", titulo: "Clientes del depósito", grupo: "Depósito", keywords: "clientes cuentas fichas bultos", icon: Users, accion: () => cerrarYNavegar("/deposito/clientes") },
        { id: "dep-control", titulo: "Control operativo", grupo: "Depósito", keywords: "control operativo metricas salidas stock antiguo", icon: Boxes, accion: () => cerrarYNavegar("/deposito/control") },
        { id: "dep-remitos", titulo: "Remitos emitidos", grupo: "Depósito", keywords: "remitos historial salidas documentos reimprimir", icon: History, accion: () => cerrarYNavegar("/deposito/historial") },
        { id: "ruta", titulo: "Mi ruta", grupo: "Navegación", keywords: "ruta chofer paradas campo", icon: RouteIcon, accion: () => cerrarYNavegar("/ruta") },
      );
    }
    const esOscuro = resolvedTheme === "dark";
    base.push({
      id: "tema",
      titulo: esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
      grupo: "Acciones",
      keywords: "tema theme oscuro claro dark light modo",
      icon: esOscuro ? Sun : Moon,
      accion: () => { setTheme(esOscuro ? "light" : "dark"); setAbierto(false); },
    });
    return base;
  }, [esInvitado, cerrarYNavegar, resolvedTheme, setTheme]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return comandos;
    return comandos.filter(c =>
      (c.titulo + " " + c.keywords + " " + c.grupo).toLowerCase().includes(q)
    );
  }, [query, comandos]);

  // Reset selección al cambiar query / abrir
  useEffect(() => { setActivo(0); }, [query]);
  useEffect(() => {
    if (abierto) { setQuery(""); setActivo(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [abierto]);

  // Scroll al item activo
  useEffect(() => {
    const cont = listaRef.current;
    const el = cont?.querySelector<HTMLElement>(`[data-idx="${activo}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activo]);

  function onKeyNav(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo(i => Math.min(filtrados.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); filtrados[activo]?.accion(); }
  }

  // Agrupar para render
  const grupos = useMemo(() => {
    const map = new Map<string, { cmd: Comando; idx: number }[]>();
    filtrados.forEach((cmd, idx) => {
      const arr = map.get(cmd.grupo) ?? [];
      arr.push({ cmd, idx });
      map.set(cmd.grupo, arr);
    });
    return Array.from(map.entries());
  }, [filtrados]);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent hideClose className="max-w-xl p-0 gap-0 overflow-hidden top-[20%] translate-y-0">
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>

        {/* Buscador */}
        <div className="flex items-center gap-3 px-4 border-b border-border/70">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyNav}
            placeholder="Buscar vista o acción…"
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">ESC</kbd>
        </div>

        {/* Resultados */}
        <div ref={listaRef} className="max-h-[340px] overflow-y-auto p-2">
          {filtrados.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin resultados para “{query}”
            </div>
          ) : (
            grupos.map(([grupo, items]) => (
              <div key={grupo} className="mb-1">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">{grupo}</p>
                {items.map(({ cmd, idx }) => {
                  const Icono = cmd.icon;
                  const sel = idx === activo;
                  return (
                    <button
                      key={cmd.id}
                      data-idx={idx}
                      onMouseEnter={() => setActivo(idx)}
                      onClick={() => cmd.accion()}
                      className={cn(
                        "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors",
                        sel ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                      )}
                    >
                      <Icono className={cn("h-4 w-4 shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1 text-sm font-medium">{cmd.titulo}</span>
                      {sel && <CornerDownLeft className="h-3.5 w-3.5 text-primary/70" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/70 text-xs text-muted-foreground bg-muted/30">
          <Truck className="h-3 w-3 text-primary" />
          <span className="font-semibold">RutaMap</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-background px-1 py-0.5">↑↓</kbd> navegar</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-background px-1 py-0.5">↵</kbd> abrir</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
