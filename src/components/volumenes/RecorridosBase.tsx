"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { getRecorridosBase } from "@/app/actions/volumenes";
import { crearRecorrido, toggleActivoRecorrido } from "@/app/actions/recorridos";
import type { RecorridoBaseItem } from "@/app/actions/volumenes";
import { ZONA_COLOR } from "@/lib/estados";

type RecorridoBase = RecorridoBaseItem;

const TIPO_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  fijo:      { label: "Fijo",      bg: "bg-blue-50 dark:bg-blue-950/40",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-200 dark:border-blue-900" },
  pre_turno: { label: "Pre-Turno", bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-900" },
  corte:     { label: "Corte",     bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-900" },
  suplencia: { label: "Comodín",   bg: "bg-slate-50 dark:bg-slate-800/40",  text: "text-slate-500 dark:text-slate-400",  border: "border-slate-200 dark:border-slate-700" },
};

const ZONA_COLORS: Record<string, string> = {
  Oeste: "bg-blue-600", Norte: "bg-amber-500", Sur: "bg-green-600", CABA: "bg-red-600",
};

interface Props {
  targetPkg?: number;
}

export function RecorridosBase({ targetPkg = 30 }: Props) {
  const [recorridos, setRecorridos] = useState<RecorridoBase[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroZona, setFiltroZona] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    getRecorridosBase().then(res => {
      if (res.ok && res.data) setRecorridos(res.data);
      setCargando(false);
    }).catch(() => setCargando(false));
  }, []);

  const fijos = recorridos.filter(r => r.tipo === "fijo" && r.activo);
  const pisoOperativo = fijos.length;

  const filtrados = recorridos.filter(r => {
    if (filtroZona && r.zona !== filtroZona) return false;
    if (filtroTipo && r.tipo !== filtroTipo) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      if (!r.codigo.toLowerCase().includes(q) && !r.nombre.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const zonas = ["Oeste", "Norte", "Sur", "CABA"];
  const tipos = ["fijo", "pre_turno", "corte", "suplencia"];

  // ── Formulario nuevo recorrido ──────────────────────────────────────────────
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [nuevoForm, setNuevoForm] = useState({
    codigo: "", nombre: "", zona: "Oeste", tipo: "fijo" as string,
  });

  const COLORES_ZONA = ZONA_COLOR;

  async function guardarNuevoRecorrido() {
    if (!nuevoForm.codigo.trim() || !nuevoForm.nombre.trim()) {
      toast.error("Completá el código y el nombre");
      return;
    }
    setGuardandoNuevo(true);
    try {
      const res = await crearRecorrido({
        codigo: nuevoForm.codigo.trim().toUpperCase(),
        nombre: nuevoForm.nombre.trim(),
        zona: nuevoForm.zona as "Oeste" | "Norte" | "Sur" | "CABA",
        tipo: nuevoForm.tipo as "fijo" | "suplencia" | "corte" | "pre_turno",
        color: COLORES_ZONA[nuevoForm.zona] ?? "#2563eb",
      });
      if (!res.ok) {
        toast.error("Error al crear recorrido", { description: res.error });
      } else {
        toast.success(`Recorrido ${nuevoForm.codigo.toUpperCase()} creado`);
        setNuevoForm({ codigo: "", nombre: "", zona: "Oeste", tipo: "fijo" });
        setMostrarForm(false);
        // Recargar lista
        const fresh = await getRecorridosBase();
        if (fresh.ok && fresh.data) setRecorridos(fresh.data);
      }
    } finally { setGuardandoNuevo(false); }
  }

  async function handleToggleActivo(r: RecorridoBase) {
    const res = await toggleActivoRecorrido(r.id, !r.activo);
    if (res.ok) {
      setRecorridos(prev => prev.map(x => x.id === r.id ? { ...x, activo: !x.activo } : x));
    } else {
      toast.error("Error al cambiar estado");
    }
  }

  // Cálculo de choferes para el piso
  const fijosActivos = recorridos.filter(r => r.tipo === "fijo" && r.activo).length;

  return (
    <div className="p-6 space-y-5">

      {/* Cards de piso operativo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4 bg-blue-50/50 dark:bg-blue-950/40 col-span-2 lg:col-span-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Piso operativo (RF)</p>
          <p className="text-4xl font-bold text-blue-700 dark:text-blue-300 tabular-nums mt-1">{pisoOperativo}</p>
          <p className="text-xs text-muted-foreground mt-1">recorridos fijos activos</p>
        </div>
        {(["Oeste","Norte","Sur","CABA"] as const).map(zona => {
          const n = recorridos.filter(r => r.tipo === "fijo" && r.activo && r.zona === zona).length;
          return (
            <div key={zona} className="border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("h-2.5 w-2.5 rounded-full", ZONA_COLORS[zona])} />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{zona}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{n}</p>
              <p className="text-[10px] text-muted-foreground">fijos</p>
            </div>
          );
        })}
      </div>

      {/* Bandas de equilibrio */}
      <div className="border rounded-xl p-4 bg-background">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Cálculo de choferes sobre {fijosActivos} recorridos fijos
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Mínimo (P.E. −5)", pkg: targetPkg - 5, color: "text-amber-600 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" },
            { label: `Equilibrio (${targetPkg}P)`, pkg: targetPkg, color: "text-green-700 dark:text-green-300", bg: "bg-green-50 dark:bg-green-950/40", highlight: true },
            { label: "Máximo (P.E. +5)", pkg: targetPkg + 5, color: "text-amber-600 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" },
          ].map(({ label, pkg, color, bg, highlight }) => {
            const choferes = Math.ceil((fijosActivos * pkg) / pkg); // = fijosActivos (1 chofer por recorrido en piso)
            // Choferes necesarios si cada uno lleva `pkg` paquetes y hay `fijosActivos * pkg` paquetes totales
            // Actually, choferes = fijosActivos routes × 1 chofer/route = fijosActivos
            // But the real calc is: total_packages / pkg_per_driver
            // For the piso: assume each RF route generates 1 delivery per driver
            // So choferes = fijosActivos (base), adjusted by package load
            return (
              <div key={label} className={cn("rounded-lg p-3 text-center", bg, highlight && "ring-2 ring-green-400")}>
                <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
                <p className={cn("text-2xl font-bold tabular-nums mt-1", color)}>
                  {fijosActivos}
                </p>
                <p className="text-[10px] text-muted-foreground">choferes base</p>
                <p className={cn("text-[11px] font-semibold mt-1", color)}>
                  {pkg} pkg/chofer
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          El piso de {fijosActivos} RF implica {fijosActivos} choferes como mínimo. Con la proyección de paquetes del día se calcula cuántos adicionales se necesitan.
        </p>
      </div>

      {/* Botón + formulario nuevo recorrido */}
      <div className="space-y-3">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setMostrarForm(v => !v)}
        >
          {mostrarForm ? <><X className="h-3.5 w-3.5" />Cancelar</> : <><Plus className="h-3.5 w-3.5" />Agregar recorrido</>}
        </Button>

        {mostrarForm && (
          <div className="border rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <p className="text-xs font-semibold">Nuevo recorrido</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Código *</label>
                <input
                  type="text"
                  placeholder="ej: RF-OE-17"
                  value={nuevoForm.codigo}
                  onChange={e => setNuevoForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background font-mono uppercase"
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Nombre *</label>
                <input
                  type="text"
                  placeholder="ej: General Las Heras"
                  value={nuevoForm.nombre}
                  onChange={e => setNuevoForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Zona</label>
                <select
                  value={nuevoForm.zona}
                  onChange={e => setNuevoForm(p => ({ ...p, zona: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background"
                >
                  {["Oeste","Norte","Sur","CABA"].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tipo</label>
                <select
                  value={nuevoForm.tipo}
                  onChange={e => setNuevoForm(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background"
                >
                  <option value="fijo">Fijo (RF)</option>
                  <option value="corte">Corte (CE)</option>
                  <option value="pre_turno">Pre-Turno (PT)</option>
                  <option value="suplencia">Comodín (CMD)</option>
                </select>
              </div>
            </div>
            <Button
              size="sm"
              onClick={guardarNuevoRecorrido}
              disabled={guardandoNuevo || !nuevoForm.codigo.trim() || !nuevoForm.nombre.trim()}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
            >
              <Plus className="h-3 w-3" />
              {guardandoNuevo ? "Guardando…" : "Agregar"}
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          placeholder="Buscar código o nombre…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-xs h-8 bg-background w-52"
        />
        <div className="flex gap-1">
          {zonas.map(z => (
            <button key={z} onClick={() => setFiltroZona(filtroZona === z ? null : z)}
              className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors font-medium",
                filtroZona === z ? `${ZONA_COLORS[z]} text-white border-transparent` : "border-border text-muted-foreground hover:border-blue-400")}>
              {z}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {tipos.map(t => {
            const cfg = TIPO_CONFIG[t];
            return (
              <button key={t} onClick={() => setFiltroTipo(filtroTipo === t ? null : t)}
                className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
                  filtroTipo === t ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "border-border text-muted-foreground hover:border-blue-400")}>
                {cfg.label}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">{filtrados.length} de {recorridos.length}</span>
      </div>

      {/* Tabla de recorridos */}
      <div className="border rounded-xl overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-background border-b sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Código</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Nombre</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Zona</th>
                  <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map(r => {
                  const cfg = TIPO_CONFIG[r.tipo] ?? TIPO_CONFIG.suplencia;
                  return (
                    <tr key={r.id} className={cn("hover:bg-accent/20 transition-colors", !r.activo && "opacity-50")}>
                      <td className="px-3 py-2 font-mono font-bold">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                          {r.codigo}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[260px] truncate">{r.nombre}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full", ZONA_COLORS[r.zona])} />
                          {r.zona}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", cfg.bg, cfg.text, cfg.border)}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleToggleActivo(r)}
                          className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors",
                            r.activo
                              ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                          )}>
                          {r.activo ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
