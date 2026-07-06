"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Upload, Package, Calendar, RefreshCw, CheckCircle2, XCircle, Search,
  AlertTriangle, MapPin, Truck, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  marcarPendiente, marcarPendientesLote,
  type Pendiente, type PendienteFila, type FechaPendiente, type EstadoRecepcion,
} from "@/app/actions/pendientes";
import type { PendientesStats } from "./PendientesPanel";
import { PendientesHistorico } from "./PendientesHistorico";

function fmtFechaHog(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const MACROZONA_COLOR: Record<string, string> = {
  NORTE: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40",
  OESTE: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40",
  SUR: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40",
  CABA: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40",
};

const MOTIVOS_RAPIDOS = ["Entregado", "Extraviado", "No vino el conductor", "Conductor no lo trajo"];

interface Props {
  vista: "dia" | "historico"; setVista: (v: "dia" | "historico") => void;
  fecha: string; setFecha: (f: string) => void; fechas: FechaPendiente[];
  pendientes: Pendiente[]; stats: PendientesStats; cargando: boolean; importando: boolean;
  puedeEditar: boolean; busqueda: string; setBusqueda: (v: string) => void;
  soloNoRecibidos: boolean; setSoloNoRecibidos: (v: boolean) => void;
  cadeteExpandido: string | null; setCadeteExpandido: (v: string | null) => void;
  onArchivo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  confirmImport: { fecha: string; filas: PendienteFila[]; marcas: number } | null;
  setConfirmImport: (v: { fecha: string; filas: PendienteFila[]; marcas: number } | null) => void;
  ejecutarImport: (f: string, filas: PendienteFila[], forzar: boolean) => Promise<void>;
  recargar: () => void;
  setPendientes: React.Dispatch<React.SetStateAction<Pendiente[]>>;
}

export function PendientesUI({
  vista, setVista,
  fecha, setFecha, fechas, pendientes, stats, cargando, importando, puedeEditar,
  busqueda, setBusqueda, soloNoRecibidos, setSoloNoRecibidos,
  cadeteExpandido, setCadeteExpandido, onArchivo,
  confirmImport, setConfirmImport, ejecutarImport, recargar, setPendientes,
}: Props) {

  // Filtro por zona (principal): al elegir una zona, contadores y conductores
  // se acotan a esa macrozona. Las tarjetas de zona siempre muestran el total global.
  const [filtroZona, setFiltroZona] = useState<string | null>(null);
  const [filtroCliente, setFiltroCliente] = useState<string>("");

  // Modal de motivo al marcar "no recibido"
  const [motivoModal, setMotivoModal] = useState<{ p: Pendiente } | null>(null);
  const [motivoElegido, setMotivoElegido] = useState<string>(MOTIVOS_RAPIDOS[0]);
  const [observacionTexto, setObservacionTexto] = useState("");

  // Lista de clientes de la zona elegida (para el desplegable)
  const clientes = useMemo(() => {
    const base = filtroZona ? pendientes.filter(p => p.macrozona === filtroZona) : pendientes;
    return [...new Set(base.map(p => p.cliente).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  }, [pendientes, filtroZona]);

  const visibles = useMemo(
    () => pendientes
      .filter(p => !filtroZona || p.macrozona === filtroZona)
      .filter(p => !filtroCliente || p.cliente === filtroCliente),
    [pendientes, filtroZona, filtroCliente]
  );

  // Contadores según la zona elegida
  const vTotal = visibles.length;
  const vRecibidos = visibles.filter(p => p.estado_recepcion === "recibido").length;
  const vNoRecibidos = visibles.filter(p => p.estado_recepcion === "no_recibido").length;
  const vFaltan = vTotal - vRecibidos;
  const vUrgentes = visibles.filter(p => p.urgencia === "urgente").length;
  const vUrgentesFaltan = visibles.filter(p => p.urgencia === "urgente" && p.estado_recepcion !== "recibido").length;
  const pctRecibido = vTotal > 0 ? Math.round(vRecibidos / vTotal * 100) : 0;

  // Agrupación: por conductor o por cliente
  const [agrupar, setAgrupar] = useState<"conductor" | "cliente">("conductor");
  const keyOf = (p: Pendiente) => agrupar === "conductor"
    ? (p.cadete || "Sin asignar")
    : (p.cliente || "Sin cliente");

  // Grupos (según agrupación) de la zona/cliente elegido
  const grupos = useMemo(() => {
    const m = new Map<string, { total: number; recibidos: number; noRecibidos: number; urgentes: number }>();
    for (const p of visibles) {
      const k = keyOf(p);
      const g = m.get(k) ?? { total: 0, recibidos: 0, noRecibidos: 0, urgentes: 0 };
      g.total++;
      if (p.estado_recepcion === "recibido") g.recibidos++;
      if (p.estado_recepcion === "no_recibido") g.noRecibidos++;
      if (p.urgencia === "urgente") g.urgentes++;
      m.set(k, g);
    }
    return [...m.entries()].map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => (b.total - b.recibidos) - (a.total - a.recibidos) || b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, agrupar]);

  // Marcar un paquete como recibido o volver a pendiente (optimista)
  async function marcar(p: Pendiente, estado: EstadoRecepcion, motivo?: string, observacion?: string) {
    if (!puedeEditar) return;
    const anterior = { estado_recepcion: p.estado_recepcion, motivo_no_recibido: p.motivo_no_recibido, observacion: p.observacion };
    setPendientes(prev => prev.map(x => x.id === p.id
      ? { ...x, estado_recepcion: estado, motivo_no_recibido: estado === "no_recibido" ? (motivo ?? null) : null, observacion: estado === "no_recibido" ? (observacion ?? null) : null }
      : x));
    const res = await marcarPendiente(p.id, estado, motivo, observacion);
    if (!res.ok) {
      setPendientes(prev => prev.map(x => x.id === p.id ? { ...x, ...anterior } : x));
      toast.error("No se pudo marcar", { description: res.error });
    }
  }

  function abrirModalNoRecibido(p: Pendiente) {
    if (!puedeEditar) return;
    setMotivoElegido(p.motivo_no_recibido && MOTIVOS_RAPIDOS.includes(p.motivo_no_recibido) ? p.motivo_no_recibido : MOTIVOS_RAPIDOS[0]);
    setObservacionTexto(p.observacion ?? "");
    setMotivoModal({ p });
  }

  async function confirmarNoRecibido() {
    if (!motivoModal) return;
    const { p } = motivoModal;
    setMotivoModal(null);
    await marcar(p, "no_recibido", motivoElegido, observacionTexto.trim() || undefined);
  }

  // Marcar todos los de un grupo — SOLO dentro de la zona/cliente filtrado
  // actualmente (antes usaba "pendientes" sin filtrar, así que con una zona
  // seleccionada marcaba también paquetes de ese conductor/cliente en OTRAS
  // zonas sin avisar).
  async function toggleGrupo(nombre: string, recibido: boolean) {
    if (!puedeEditar) return;
    const ids = visibles.filter(p => keyOf(p) === nombre).map(p => p.id);
    const idsSet = new Set(ids);
    const estado: EstadoRecepcion = recibido ? "recibido" : "pendiente";
    setPendientes(prev => prev.map(x => idsSet.has(x.id) ? { ...x, estado_recepcion: estado, motivo_no_recibido: null, observacion: null } : x));
    const res = await marcarPendientesLote(ids, estado);
    if (!res.ok) { toast.error("No se pudo marcar el grupo", { description: res.error }); recargar(); return; }
    toast.success(`${nombre}: ${recibido ? "todo recibido" : "desmarcado"} (${res.actualizados})`);
  }

  // Paquetes de un grupo (en la zona/cliente filtrado). La búsqueda por texto NO
  // se aplica cuando coincide con el nombre del grupo: así, al buscar un conductor
  // o cliente, se ven todos sus paquetes (era el bug de la lista vacía).
  const detalleGrupo = (nombre: string) => {
    const q = busqueda.trim().toLowerCase();
    const buscaGrupo = q !== "" && nombre.toLowerCase().includes(q);
    return visibles.filter(p => keyOf(p) === nombre)
      .filter(p => !soloNoRecibidos || p.estado_recepcion !== "recibido")
      .filter(p => !q || buscaGrupo || [p.cliente, p.cadete, p.direccion, p.tracking, p.zona].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => (a.estado_recepcion === b.estado_recepcion ? 0 : a.estado_recepcion === "recibido" ? 1 : b.estado_recepcion === "recibido" ? -1 : 0)
        || (a.urgencia === "urgente" ? -1 : b.urgencia === "urgente" ? 1 : 0));
  };

  const gruposFiltrados = grupos.filter(g => {
    const q = busqueda.trim().toLowerCase();
    return !q || g.nombre.toLowerCase().includes(q) || detalleGrupo(g.nombre).length > 0;
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-5 space-y-5">
        {/* ── Encabezado ── */}
        <div className="flex items-start gap-3 flex-wrap">
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
            <Package className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">Pendientes</h1>
            <p className="text-xs text-muted-foreground">
              Control de recepción: marcá qué volvió al depósito, por conductor y por zona.
            </p>
          </div>
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            <button onClick={() => setVista("dia")}
              className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === "dia" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              Día
            </button>
            <button onClick={() => setVista("historico")}
              className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === "historico" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              Histórico mensual
            </button>
          </div>
          {vista === "dia" && (
            <>
              <div className="flex items-center gap-2 bg-muted/40 border rounded-lg px-2.5 py-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="text-xs bg-transparent outline-none" />
              </div>
              {fechas.length > 0 && (
                <select value={fecha} onChange={e => setFecha(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 bg-background max-w-40">
                  {fechas.map(f => (
                    <option key={f.fecha} value={f.fecha}>
                      {f.fecha} · {f.recibidos}/{f.total}{f.no_recibidos > 0 ? ` (${f.no_recibidos} no rec.)` : ""}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={recargar} disabled={cargando}
                className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
                <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
              </button>
              {puedeEditar && (
                <label className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium cursor-pointer",
                  "bg-brand-blue text-white hover:bg-brand-blue/90", importando && "opacity-60 pointer-events-none")}>
                  <Upload className="h-4 w-4" />
                  {importando ? "Importando…" : "Importar Excel"}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onArchivo} disabled={importando} />
                </label>
              )}
            </>
          )}
        </div>

        {vista === "historico" ? (
          <PendientesHistorico />
        ) : pendientes.length === 0 && !cargando ? (
          <EmptyState icon={Package} title="Sin pendientes para este día"
            description={puedeEditar ? "Importá el Excel de Pendientes para empezar el control de recepción." : "Todavía no se cargó el reporte de este día."} />
        ) : (
          <>
            {/* ── Por zona (filtro principal) ── */}
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Por zona
                <span className="text-[11px] text-muted-foreground font-normal">— clic para ver los paquetes de esa zona</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {/* Chip "Todas" */}
                <button onClick={() => setFiltroZona(null)}
                  className={cn("border rounded-xl p-3 text-left transition-all",
                    filtroZona === null ? "border-blue-500 ring-2 ring-blue-400/40 bg-blue-50/40 dark:bg-blue-950/30" : "bg-card hover:border-blue-300")}>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">TODAS</span>
                  <p className="text-lg font-bold tabular-nums mt-1">{stats.recibidos}<span className="text-xs text-muted-foreground font-normal">/{stats.total}</span></p>
                </button>
                {stats.zonas.map(z => {
                  const faltan = z.total - z.recibidos;
                  const sel = filtroZona === z.zona;
                  return (
                    <button key={z.zona} onClick={() => setFiltroZona(sel ? null : z.zona)}
                      className={cn("border rounded-xl p-3 text-left transition-all",
                        sel ? "border-blue-500 ring-2 ring-blue-400/40 bg-blue-50/40 dark:bg-blue-950/30" : "bg-card hover:border-blue-300")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", MACROZONA_COLOR[z.zona] ?? "bg-muted text-muted-foreground")}>{z.zona}</span>
                        {faltan === 0
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <span className="text-[11px] font-bold text-red-600 dark:text-red-300 tabular-nums">{faltan}</span>}
                      </div>
                      <p className="text-lg font-bold tabular-nums">{z.recibidos}<span className="text-xs text-muted-foreground font-normal">/{z.total}</span></p>
                      {z.noRecibidos > 0 && (
                        <p className="text-[10px] text-red-600 dark:text-red-300 font-medium">{z.noRecibidos} no recibido{z.noRecibidos > 1 ? "s" : ""}</p>
                      )}
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1 flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${z.total > 0 ? z.recibidos / z.total * 100 : 0}%` }} />
                        <div className="h-full bg-red-500" style={{ width: `${z.total > 0 ? z.noRecibidos / z.total * 100 : 0}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Contadores (de la zona elegida) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="border rounded-xl p-4 bg-card">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  {filtroZona ? `Pendientes ${filtroZona}` : "Total pendientes"}
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{vTotal}</p>
              </div>
              <div className="border rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/50">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Recibidos</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-700 dark:text-emerald-300">{vRecibidos}</p>
                <p className="text-[11px] text-muted-foreground">{pctRecibido}% del total</p>
              </div>
              <div className={cn("border rounded-xl p-4",
                vNoRecibidos > 0 ? "bg-red-50/50 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/50" : "bg-card")}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">No recibidos</p>
                <p className={cn("text-2xl font-bold tabular-nums mt-1", vNoRecibidos > 0 && "text-red-600 dark:text-red-300")}>{vNoRecibidos}</p>
                <p className="text-[11px] text-muted-foreground">{vTotal > 0 ? Math.round(vNoRecibidos / vTotal * 100) : 0}% del total</p>
              </div>
              <div className={cn("border rounded-xl p-4",
                vFaltan > 0 ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/50" : "bg-card")}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Sin resolver</p>
                <p className={cn("text-2xl font-bold tabular-nums mt-1", vFaltan > 0 && "text-amber-700 dark:text-amber-300")}>{vFaltan}</p>
              </div>
              <div className="border rounded-xl p-4 bg-card">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Urgentes sin recibir</p>
                <p className={cn("text-2xl font-bold tabular-nums mt-1", vUrgentesFaltan > 0 && "text-amber-700 dark:text-amber-300")}>
                  {vUrgentesFaltan}<span className="text-sm text-muted-foreground font-normal"> / {vUrgentes}</span>
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctRecibido}%` }} />
              <div className="h-full bg-red-500 transition-all" style={{ width: `${vTotal > 0 ? vNoRecibidos / vTotal * 100 : 0}%` }} />
            </div>

            {/* ── Filtros ── */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por dirección, conductor o tracking…"
                  className="w-full text-xs pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              {/* Filtro por cliente */}
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                className={cn("text-xs border rounded-lg px-2 py-2 bg-background max-w-52",
                  filtroCliente && "border-blue-500 ring-1 ring-blue-400/40")}>
                <option value="">Todos los clientes ({clientes.length})</option>
                {clientes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => setSoloNoRecibidos(!soloNoRecibidos)}
                className={cn("text-xs px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5",
                  soloNoRecibidos ? "bg-red-600 text-white border-red-600" : "border-border text-muted-foreground")}>
                <AlertTriangle className="h-3.5 w-3.5" /> Solo lo que falta
              </button>
            </div>

            {/* ── Agrupado por conductor o cliente (expandible) ── */}
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Detalle</p>
                {/* Toggle de agrupación */}
                <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5 ml-1">
                  {(["conductor", "cliente"] as const).map(g => (
                    <button key={g} onClick={() => { setAgrupar(g); setCadeteExpandido(null); }}
                      className={cn("text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors capitalize",
                        agrupar === g ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                      Por {g}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {gruposFiltrados.length} {agrupar === "conductor" ? "conductores" : "clientes"} · clic para ver los paquetes
                </span>
              </div>
              <div className="divide-y">
                {gruposFiltrados.map(c => {
                  const faltan = c.total - c.recibidos;
                  // Con búsqueda o filtro de cliente activo, abrir automáticamente
                  // los grupos que tengan coincidencias (sin tener que clickear).
                  const autoExpand = (busqueda.trim() !== "" || filtroCliente !== "");
                  const exp = cadeteExpandido === c.nombre || autoExpand;
                  const detalle = exp ? detalleGrupo(c.nombre) : [];
                  return (
                    <div key={c.nombre}>
                      <div
                        onClick={() => setCadeteExpandido(exp ? null : c.nombre)}
                        className={cn("flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors",
                          exp && "bg-blue-50/40 dark:bg-blue-950/20")}>
                        {exp ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="font-medium text-sm flex-1 truncate">{c.nombre}</span>
                        {c.urgentes > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                            {c.urgentes} urg.
                          </span>
                        )}
                        {c.noRecibidos > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-300 shrink-0">
                            {c.noRecibidos} no rec.
                          </span>
                        )}
                        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0 hidden sm:flex">
                          <div className="h-full bg-emerald-500" style={{ width: `${c.total > 0 ? c.recibidos / c.total * 100 : 0}%` }} />
                          <div className="h-full bg-red-500" style={{ width: `${c.total > 0 ? c.noRecibidos / c.total * 100 : 0}%` }} />
                        </div>
                        <span className="text-sm tabular-nums shrink-0 w-14 text-right">
                          <span className="font-bold">{c.recibidos}</span>
                          <span className="text-muted-foreground">/{c.total}</span>
                        </span>
                        {faltan === 0
                          ? <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 shrink-0 w-16 text-right">completo</span>
                          : <span className="text-[11px] font-semibold text-red-600 dark:text-red-300 shrink-0 w-16 text-right">faltan {faltan}</span>}
                        {puedeEditar && (
                          <button
                            onClick={e => { e.stopPropagation(); toggleGrupo(c.nombre, faltan > 0); }}
                            className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted transition-colors shrink-0"
                            title={faltan > 0 ? "Marcar todos como recibidos" : "Desmarcar todos"}>
                            {faltan > 0 ? "Recibí todo" : "Desmarcar"}
                          </button>
                        )}
                      </div>
                      {exp && (
                        <div className="bg-muted/10 divide-y">
                          {detalle.map(p => (
                            <div key={p.id}
                              className={cn("flex items-start gap-2.5 pl-11 pr-4 py-2.5 text-xs",
                                p.estado_recepcion === "recibido" && "opacity-60")}>
                              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                <button disabled={!puedeEditar} title="Marcar recibido"
                                  onClick={e => { e.stopPropagation(); marcar(p, p.estado_recepcion === "recibido" ? "pendiente" : "recibido"); }}
                                  className={cn("rounded-full", puedeEditar && "cursor-pointer")}>
                                  <CheckCircle2 className={cn("h-4 w-4", p.estado_recepcion === "recibido" ? "text-emerald-500" : "text-muted-foreground/30 hover:text-emerald-500/70")} />
                                </button>
                                <button disabled={!puedeEditar} title="Marcar no recibido (con motivo)"
                                  onClick={e => { e.stopPropagation(); p.estado_recepcion === "no_recibido" ? marcar(p, "pendiente") : abrirModalNoRecibido(p); }}
                                  className={cn("rounded-full", puedeEditar && "cursor-pointer")}>
                                  <XCircle className={cn("h-4 w-4", p.estado_recepcion === "no_recibido" ? "text-red-500" : "text-muted-foreground/30 hover:text-red-500/70")} />
                                </button>
                              </div>
                              <div className="flex-1 min-w-0">
                                {/* Línea 1: dimensión principal (según agrupación) + estado + fecha */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {p.urgencia === "urgente" && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="Urgente (+2 días)" />}
                                  {p.urgencia === "prioridad" && <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="Prioridad (1 día)" />}
                                  <span className="font-semibold">
                                    {agrupar === "conductor" ? (p.cliente ?? "—") : (p.cadete ?? "Sin asignar")}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.estado ?? "—"}</span>
                                  <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">{fmtFechaHog(p.fecha_hogareno)}</span>
                                </div>
                                {/* Línea 2: dirección + localidad + (la otra dimensión) */}
                                <p className="text-muted-foreground mt-0.5">
                                  {p.direccion ?? "Sin dirección"}
                                  {p.zona && <span className="text-foreground/70"> · {p.zona}</span>}
                                  {agrupar === "conductor"
                                    ? (p.cadete && <span className="text-muted-foreground/70"> · {p.cadete}</span>)
                                    : (p.cliente && <span className="text-muted-foreground/70"> · {p.cliente}</span>)}
                                  {p.tracking && <span className="text-muted-foreground/60 font-mono"> · {p.tracking}</span>}
                                </p>
                                {/* Línea 3: motivo + observación cuando no recibido */}
                                {p.estado_recepcion === "no_recibido" && (
                                  <p className="mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-300">
                                      {p.motivo_no_recibido ?? "No recibido"}
                                    </span>
                                    {p.observacion && <span className="text-[11px] text-muted-foreground italic">"{p.observacion}"</span>}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                          {detalle.length === 0 && (
                            <p className="pl-11 pr-4 py-2 text-xs text-muted-foreground">Sin paquetes que coincidan con el filtro.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal: motivo al marcar "no recibido" ── */}
      {motivoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold">Marcar como no recibido</p>
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {motivoModal.p.direccion ?? motivoModal.p.tracking ?? "Paquete"}
                  {motivoModal.p.cliente && ` · ${motivoModal.p.cliente}`}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">Motivo</p>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_RAPIDOS.map(m => (
                  <button key={m} onClick={() => setMotivoElegido(m)}
                    className={cn("text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                      motivoElegido === m ? "bg-red-600 text-white border-red-600" : "border-border text-muted-foreground hover:bg-muted")}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">Observación (opcional)</p>
              <textarea value={observacionTexto} onChange={e => setObservacionTexto(e.target.value)}
                placeholder="Detalle adicional…" rows={3}
                className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMotivoModal(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={confirmarNoRecibido}>Marcar no recibido</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar reimport ── */}
      {confirmImport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Ya hay marcas de recepción en este día</p>
                <p className="text-sm text-muted-foreground mt-1">
                  El día <span className="font-medium">{confirmImport.fecha}</span> tiene{" "}
                  <span className="font-semibold text-foreground">{confirmImport.marcas}</span> paquetes marcados como recibidos.
                  Reimportar reemplaza todo el día y borra esas marcas.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmImport(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1"
                onClick={async () => {
                  const c = confirmImport; setConfirmImport(null);
                  await ejecutarImport(c.fecha, c.filas, true);
                }}>
                Reemplazar de todos modos
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
