"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ClipboardList, Calendar, RefreshCw, Package, Trash2, Download,
  Send, Sunrise, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hoyAR } from "@/lib/fechas";
import {
  getCargaDia, upsertCargaFila, eliminarCargaFila, iniciarCargaDesdeOperacion,
  publicarCargaDia, getChoferesConocidos, setEstadoControlFila,
  type CargaFila, type TurnoCarga,
} from "@/app/actions/carga-dia";
import { getOperacionDia } from "@/app/actions/operacion";
import type { OperacionRuta } from "@/app/actions/operacion";
import {
  getPaquetesEspeciales, getPaquetesEspecialesRango, getClientesSugeridos,
} from "@/app/actions/paquetes-especiales";
import { PaquetesEspecialesModal, urlImagen } from "@/components/volumenes/PaquetesEspecialesModal";

const ORDEN_ZONAS = ["Oeste", "Norte", "CABA", "Sur"];
const ZONA_COLOR: Record<string, string> = {
  CABA: "bg-red-500", Norte: "bg-amber-500", Sur: "bg-green-600", Oeste: "bg-blue-600",
};
const ZONA_BADGE: Record<string, string> = {
  CABA: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40",
  Norte: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40",
  Sur: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40",
  Oeste: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40",
};

// Semáforo del Excel: hasta 29 verde, 30-39 amarillo, 40+ rojo
function semaforo(total: number): string {
  if (total >= 40) return "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800";
  if (total >= 30) return "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
  if (total > 0) return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
  return "bg-muted text-muted-foreground border-border";
}

export function CargaDia({ puedeEditar }: { puedeEditar: boolean }) {
  const [fecha, setFecha] = useState(() => hoyAR());
  // Filtro principal: null = todas las zonas del turno tarde; una zona puntual;
  // o "preturno", que funciona como 5ta zona.
  const [filtro, setFiltro] = useState<string | null>(null);
  const turno: TurnoCarga = filtro === "preturno" ? "preturno" : "tarde";
  const [filas, setFilas] = useState<CargaFila[]>([]);
  const [cargando, setCargando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [exportandoEsp, setExportandoEsp] = useState(false);
  const [choferes, setChoferes] = useState<string[]>([]);
  const [clientesSug, setClientesSug] = useState<string[]>([]);
  const [rutasDia, setRutasDia] = useState<OperacionRuta[]>([]);
  const [agregandoCodigo, setAgregandoCodigo] = useState("");
  // Paquetes especiales
  const [especialesCount, setEspecialesCount] = useState<Record<string, number>>({});
  const [modalEspeciales, setModalEspeciales] = useState<{ recorrido_id: string; codigo: string; nombre: string; zona: string } | null>(null);
  // Debounce de autoguardado por fila
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const cargar = useCallback(async (f: string) => {
    setCargando(true);
    try {
      const [rCarga, rEsp, rOp] = await Promise.all([
        getCargaDia(f), getPaquetesEspeciales(f), getOperacionDia(f),
      ]);
      if (rCarga.ok) setFilas(rCarga.data ?? []);
      if (rEsp.ok) {
        const counts: Record<string, number> = {};
        for (const p of rEsp.data ?? []) counts[p.recorrido_id] = (counts[p.recorrido_id] ?? 0) + 1;
        setEspecialesCount(counts);
      }
      if (rOp.ok) setRutasDia(rOp.data ?? []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);
  useEffect(() => {
    getChoferesConocidos().then(r => { if (r.ok) setChoferes(r.data ?? []); });
    getClientesSugeridos().then(r => { if (r.ok) setClientesSug(r.data ?? []); });
  }, []);

  const filasTurno = useMemo(() => filas.filter(f => f.turno === turno), [filas, turno]);
  // Lo que se muestra en las tablas: el turno elegido, acotado a la zona si hay una seleccionada
  const filasVisibles = useMemo(
    () => filasTurno.filter(f => !filtro || filtro === "preturno" || f.zona === filtro),
    [filasTurno, filtro]
  );
  // Subtotales para las tarjetas-filtro (siempre globales del día)
  const filasTarde = useMemo(() => filas.filter(f => f.turno === "tarde"), [filas]);
  const filasPre = useMemo(() => filas.filter(f => f.turno === "preturno"), [filas]);
  const subtotalZona = useCallback((zona: string) => {
    const items = filasTarde.filter(f => f.zona === zona);
    return {
      n: items.length,
      sistema: items.reduce((s, f) => s + f.sistema, 0),
      xFuera: items.reduce((s, f) => s + f.x_fuera, 0),
      total: items.reduce((s, f) => s + f.sistema + f.x_fuera, 0),
    };
  }, [filasTarde]);

  // Guardado con debounce por recorrido
  function editarFila(fila: CargaFila, patch: Partial<Pick<CargaFila, "chofer" | "sistema" | "x_fuera">>) {
    if (!puedeEditar) return;
    const actualizada = { ...fila, ...patch };
    setFilas(prev => prev.map(f => f.id === fila.id ? actualizada : f));
    const key = fila.id;
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(async () => {
      const res = await upsertCargaFila(
        actualizada.fecha, actualizada.turno, actualizada.recorrido_id,
        actualizada.chofer, actualizada.sistema, actualizada.x_fuera,
      );
      if (!res.ok) toast.error(`No se pudo guardar ${actualizada.codigo}`, { description: res.error });
    }, 600);
  }

  function numero(s: string): number {
    const v = parseInt(s, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  async function traerDeOperacion() {
    const res = await iniciarCargaDesdeOperacion(fecha, turno);
    if (!res.ok) { toast.error("No se pudo iniciar la carga", { description: res.error }); return; }
    if ((res.agregados ?? 0) === 0) {
      toast.info("No hay recorridos activos nuevos en la Operación del Día para esta fecha");
    } else {
      toast.success(`${res.agregados} recorridos agregados desde la Operación del Día`);
    }
    await cargar(fecha);
  }

  async function agregarRecorrido(recorridoId: string) {
    const r = rutasDia.find(x => x.recorrido_id === recorridoId);
    if (!r) return;
    const res = await upsertCargaFila(fecha, turno, recorridoId, null, 0, 0);
    if (!res.ok) { toast.error("No se pudo agregar", { description: res.error }); return; }
    setAgregandoCodigo("");
    await cargar(fecha);
  }

  // Control de los coordinadores de noche: cada hora chequean cuántos paquetes
  // lleva el chofer y marcan el recorrido. Ciclo: sin marcar → verde → rojo → sin marcar.
  async function ciclarControl(fila: CargaFila) {
    if (!puedeEditar) return;
    const siguiente: "verde" | "rojo" | null =
      fila.estado_control === null ? "verde" : fila.estado_control === "verde" ? "rojo" : null;
    setFilas(prev => prev.map(f => f.id === fila.id ? { ...f, estado_control: siguiente } : f));
    const res = await setEstadoControlFila(fila.id, siguiente);
    if (!res.ok) {
      setFilas(prev => prev.map(f => f.id === fila.id ? { ...f, estado_control: fila.estado_control } : f));
      toast.error("No se pudo actualizar el control", { description: res.error });
    }
  }

  async function quitarFila(fila: CargaFila) {
    const res = await eliminarCargaFila(fila.id);
    if (!res.ok) { toast.error("No se pudo quitar", { description: res.error }); return; }
    setFilas(prev => prev.filter(f => f.id !== fila.id));
  }

  async function publicar() {
    setPublicando(true);
    try {
      const res = await publicarCargaDia(fecha);
      if (!res.ok) { toast.error("No se pudo enviar al análisis", { description: res.error }); return; }
      toast.success(`Día enviado al análisis: ${res.publicados} recorridos publicados`, {
        description: "Los datos ya están disponibles en Volúmenes → Análisis por recorrido.",
      });
    } finally { setPublicando(false); }
  }

  // Exporta a Excel los paquetes especiales del mes (para administración)
  async function exportarEspeciales() {
    setExportandoEsp(true);
    try {
      const desde = fecha.slice(0, 8) + "01";
      const [y, m] = fecha.split("-").map(Number);
      const fin = new Date(y, m, 0);
      const hasta = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
      const res = await getPaquetesEspecialesRango(desde, hasta);
      if (!res.ok) { toast.error("No se pudo exportar", { description: res.error }); return; }
      const lista = res.data ?? [];
      if (lista.length === 0) { toast.info("No hay paquetes especiales en el mes de la fecha elegida"); return; }
      const XLSX = await import("xlsx");
      const hoja = lista.map(p => ({
        Fecha: p.fecha, Zona: p.zona, "Código": p.codigo, Recorrido: p.recorrido_nombre,
        Cliente: p.cliente ?? "", Tracking: p.tracking ?? "",
        "Alto (cm)": p.alto_cm ?? "", "Ancho (cm)": p.ancho_cm ?? "",
        "Largo (cm)": p.largo_cm ?? "", "Peso (kg)": p.peso_kg ?? "",
        "Observación": p.observacion ?? "",
        Fotos: p.imagenes.map(urlImagen).join("  "),
      }));
      const ws = XLSX.utils.json_to_sheet(hoja);
      ws["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 28 }, { wch: 20 }, { wch: 14 },
        { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 40 }, { wch: 60 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Paquetes especiales");
      XLSX.writeFile(wb, `paquetes-especiales-${desde.slice(0, 7)}.xlsx`);
      toast.success(`${lista.length} paquetes especiales exportados (${desde.slice(0, 7)})`);
    } finally { setExportandoEsp(false); }
  }

  // Agrupar por zona + resumen
  const porZona = useMemo(() => {
    const m = new Map<string, CargaFila[]>();
    for (const f of filasVisibles) {
      const z = f.zona || "Sin zona";
      m.set(z, [...(m.get(z) ?? []), f]);
    }
    const zonas = [...m.keys()].sort((a, b) => {
      const ia = ORDEN_ZONAS.indexOf(a), ib = ORDEN_ZONAS.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return zonas.map(z => {
      const items = m.get(z)!;
      return {
        zona: z, items,
        sistema: items.reduce((s, f) => s + f.sistema, 0),
        xFuera: items.reduce((s, f) => s + f.x_fuera, 0),
        total: items.reduce((s, f) => s + f.sistema + f.x_fuera, 0),
      };
    });
  }, [filasVisibles]);

  const granTotal = useMemo(() => ({
    sistema: filasVisibles.reduce((s, f) => s + f.sistema, 0),
    xFuera: filasVisibles.reduce((s, f) => s + f.x_fuera, 0),
    total: filasVisibles.reduce((s, f) => s + f.sistema + f.x_fuera, 0),
    especiales: filasVisibles.reduce((s, f) => s + (especialesCount[f.recorrido_id] ?? 0), 0),
  }), [filasVisibles, especialesCount]);

  // Recorridos del día que todavía no están en la carga del turno actual (para el selector)
  const rutasDisponibles = useMemo(() => {
    const enCarga = new Set(filasTurno.map(f => f.recorrido_id));
    return rutasDia.filter(r => !enCarga.has(r.recorrido_id))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [rutasDia, filasTurno]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-5 space-y-5">
        {/* ── Encabezado ── */}
        <div className="flex items-start gap-3 flex-wrap">
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">Carga del Día</h1>
            <p className="text-xs text-muted-foreground">
              Los coordinadores cargan chofer y paquetes (sistema / por fuera) por recorrido. Al cierre, enviá el día al análisis.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-muted/40 border rounded-lg px-2.5 py-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="text-xs bg-transparent outline-none" />
          </div>
          <button onClick={() => cargar(fecha)} disabled={cargando}
            className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
        </div>

        {/* ── Resumen (como la hoja RESUMEN del Excel) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="border rounded-xl p-4 bg-card">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Sistema</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{granTotal.sistema}</p>
          </div>
          <div className="border rounded-xl p-4 bg-card">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">X fuera</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{granTotal.xFuera}</p>
          </div>
          <div className="border rounded-xl p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/50">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Gran total</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-blue-700 dark:text-blue-300">{granTotal.total}</p>
            <p className="text-[11px] text-muted-foreground">{filasVisibles.length} recorridos</p>
          </div>
          <div className="border rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/50">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Especiales</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-amber-700 dark:text-amber-300">{granTotal.especiales}</p>
          </div>
        </div>

        {/* Filtro por zona (+ pre-turno como 5ta zona) — clic para ver solo esos recorridos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button onClick={() => setFiltro(null)}
            className={cn("border rounded-xl p-3 text-left transition-all",
              filtro === null ? "border-blue-500 ring-2 ring-blue-400/40 bg-blue-50/40 dark:bg-blue-950/30" : "bg-card hover:border-blue-300")}>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">TODAS</span>
            <p className="text-lg font-bold tabular-nums mt-1">
              {filasTarde.reduce((s, f) => s + f.sistema + f.x_fuera, 0)}
              <span className="text-xs text-muted-foreground font-normal ml-1.5">{filasTarde.length} rec.</span>
            </p>
          </button>
          {ORDEN_ZONAS.map(zona => {
            const st = subtotalZona(zona);
            const sel = filtro === zona;
            return (
              <button key={zona} onClick={() => setFiltro(sel ? null : zona)}
                className={cn("border rounded-xl p-3 text-left transition-all",
                  sel ? "border-blue-500 ring-2 ring-blue-400/40 bg-blue-50/40 dark:bg-blue-950/30" : "bg-card hover:border-blue-300")}>
                <div className="flex items-center justify-between">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", ZONA_BADGE[zona] ?? "bg-muted text-muted-foreground")}>
                    {zona.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{st.n} rec.</span>
                </div>
                <p className="text-lg font-bold tabular-nums mt-1">
                  {st.total}
                  <span className="text-xs text-muted-foreground font-normal ml-1.5">({st.sistema}+{st.xFuera})</span>
                </p>
              </button>
            );
          })}
          {/* Pre-turno como 5ta zona */}
          <button onClick={() => setFiltro(filtro === "preturno" ? null : "preturno")}
            className={cn("border rounded-xl p-3 text-left transition-all",
              filtro === "preturno" ? "border-violet-500 ring-2 ring-violet-400/40 bg-violet-50/40 dark:bg-violet-950/30" : "bg-card hover:border-violet-300")}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 inline-flex items-center gap-1">
                <Sunrise className="h-2.5 w-2.5" /> PRE-TURNO
              </span>
              <span className="text-[10px] text-muted-foreground">{filasPre.length} rec.</span>
            </div>
            <p className="text-lg font-bold tabular-nums mt-1">
              {filasPre.reduce((s, f) => s + f.sistema + f.x_fuera, 0)}
              <span className="text-xs text-muted-foreground font-normal ml-1.5">
                ({filasPre.reduce((s, f) => s + f.sistema, 0)}+{filasPre.reduce((s, f) => s + f.x_fuera, 0)})
              </span>
            </p>
          </button>
        </div>

        {/* ── Acciones de armado ── */}
        {puedeEditar && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={traerDeOperacion} className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Traer recorridos de Operación del Día
            </Button>
            {rutasDisponibles.length > 0 && (
              <select value={agregandoCodigo}
                onChange={e => { if (e.target.value) agregarRecorrido(e.target.value); }}
                className="text-xs border rounded-lg px-2 py-1.5 bg-background max-w-72 h-8">
                <option value="">+ Agregar recorrido suelto…</option>
                {rutasDisponibles.map(r => (
                  <option key={r.recorrido_id} value={r.recorrido_id}>
                    {r.codigo} · {r.nombre} ({r.zona})
                  </option>
                ))}
              </select>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">
              Semáforo: <span className="text-emerald-600 font-medium">≤29</span> ·{" "}
              <span className="text-amber-600 font-medium">30–39</span> ·{" "}
              <span className="text-red-600 font-medium">40+</span> — se guarda solo al escribir
            </span>
          </div>
        )}

        {/* ── Tablas por zona ── */}
        {filasVisibles.length === 0 && !cargando ? (
          <EmptyState icon={ClipboardList} title={`Sin carga para ${filtro === "preturno" ? "el pre-turno" : filtro ? `la zona ${filtro}` : "este día"}`}
            description={puedeEditar
              ? 'Empezá con "Traer recorridos de Operación del Día" o agregá recorridos sueltos.'
              : "Todavía no se cargó este día."} />
        ) : (
          porZona.map(z => (
            <div key={z.zona} className="border rounded-xl overflow-hidden bg-card">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
                <span className={cn("h-2.5 w-2.5 rounded-full", ZONA_COLOR[z.zona] ?? "bg-slate-400")} />
                <p className="text-sm font-semibold">Zona {z.zona}</p>
                <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                  {z.sistema} sistema · {z.xFuera} x fuera · <strong className="text-foreground">{z.total} total</strong>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/10 border-b">
                    <tr className="text-muted-foreground">
                      <th className="w-12 px-2 py-2 font-medium text-center" title="Control horario (coordinador de noche)">Control</th>
                      <th className="text-left px-3 py-2 font-medium">Código</th>
                      <th className="text-left px-3 py-2 font-medium">Recorrido</th>
                      <th className="text-left px-3 py-2 font-medium min-w-40">Chofer</th>
                      <th className="text-center px-2 py-2 font-medium w-20">Sistema</th>
                      <th className="text-center px-2 py-2 font-medium w-20">X fuera</th>
                      <th className="text-center px-2 py-2 font-medium w-20">Total</th>
                      <th className="text-center px-2 py-2 font-medium w-24">Especiales</th>
                      {puedeEditar && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {z.items.map(f => {
                      const total = f.sistema + f.x_fuera;
                      return (
                        <tr key={f.id} className={cn("hover:bg-muted/20 transition-colors",
                          f.estado_control === "rojo" && "bg-red-50/50 dark:bg-red-950/20",
                          f.estado_control === "verde" && "bg-emerald-50/30 dark:bg-emerald-950/10")}>
                          <td className="px-2 py-2 text-center">
                            <button onClick={() => ciclarControl(f)} disabled={!puedeEditar}
                              title={f.estado_control === "verde" ? "En control — clic para marcar en rojo"
                                : f.estado_control === "rojo" ? "Por encima de lo esperado — clic para desmarcar"
                                : "Sin controlar — clic para marcar en verde"}
                              className={cn("h-5 w-5 rounded-full border-2 transition-colors",
                                f.estado_control === "verde" && "bg-emerald-500 border-emerald-600",
                                f.estado_control === "rojo" && "bg-red-500 border-red-600",
                                !f.estado_control && "bg-transparent border-slate-300 dark:border-slate-600 hover:border-slate-400",
                                puedeEditar && "cursor-pointer")} />
                          </td>
                          <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">{f.codigo}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[260px] truncate">{f.nombre}</td>
                          <td className="px-3 py-2">
                            <input list="choferes-carga" value={f.chofer ?? ""} disabled={!puedeEditar}
                              onChange={e => editarFila(f, { chofer: e.target.value })}
                              placeholder="Nombre del chofer…"
                              className="w-full border-0 border-b border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-xs focus:outline-none focus:border-blue-400 py-0.5 placeholder:text-slate-300" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="number" min={0} value={f.sistema === 0 ? "" : f.sistema} disabled={!puedeEditar}
                              onChange={e => editarFila(f, { sistema: numero(e.target.value) })}
                              placeholder="0"
                              className="w-16 text-center border rounded-lg py-1 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="number" min={0} value={f.x_fuera === 0 ? "" : f.x_fuera} disabled={!puedeEditar}
                              onChange={e => editarFila(f, { x_fuera: numero(e.target.value) })}
                              placeholder="0"
                              className="w-16 text-center border rounded-lg py-1 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={cn("inline-flex items-center justify-center min-w-12 px-2 py-1 rounded-lg border font-bold tabular-nums", semaforo(total))}>
                              {total}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => setModalEspeciales({ recorrido_id: f.recorrido_id, codigo: f.codigo, nombre: f.nombre, zona: f.zona })}
                              className={cn("relative inline-flex items-center justify-center transition-colors",
                                (especialesCount[f.recorrido_id] ?? 0) > 0
                                  ? "text-amber-500 hover:text-amber-600"
                                  : "text-muted-foreground/40 hover:text-amber-500")}
                              title="Paquetes especiales">
                              <Package className="h-4 w-4" />
                              {(especialesCount[f.recorrido_id] ?? 0) > 0 && (
                                <span className="absolute -top-1.5 -right-2.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">
                                  {especialesCount[f.recorrido_id]}
                                </span>
                              )}
                            </button>
                          </td>
                          {puedeEditar && (
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => quitarFila(f)} title="Quitar de la carga"
                                className="text-muted-foreground/30 hover:text-red-600 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        <datalist id="choferes-carga">
          {choferes.map(c => <option key={c} value={c} />)}
        </datalist>

        {/* ── Cierre del día ── */}
        <div className="flex items-center gap-2 flex-wrap border-t pt-4 pb-8">
          <Button size="sm" onClick={exportarEspeciales} disabled={exportandoEsp}
            variant="outline" className="h-9 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            {exportandoEsp ? "Exportando…" : "Exportar especiales (mes)"}
          </Button>
          {puedeEditar && (
            <Button size="sm" onClick={publicar} disabled={publicando || filas.length === 0}
              className="ml-auto h-9 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              <Send className="h-3.5 w-3.5" />
              {publicando ? "Enviando…" : "Enviar día al análisis"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Modal paquetes especiales ── */}
      {modalEspeciales && (
        <PaquetesEspecialesModal
          fecha={fecha}
          recorrido={modalEspeciales}
          clientes={clientesSug}
          puedeEditar={puedeEditar}
          onClose={cantidad => {
            setEspecialesCount(prev => ({ ...prev, [modalEspeciales.recorrido_id]: cantidad }));
            setModalEspeciales(null);
          }}
        />
      )}
    </div>
  );
}
