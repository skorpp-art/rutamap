"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ClipboardList, Calendar, RefreshCw, Package, Trash2, Download,
  Send, Sunrise, Plus, Users, Upload, X, Wallet, Boxes, PackagePlus, Sigma, Check,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hoyAR } from "@/lib/fechas";
import {
  getCargaDia, upsertCargaFila, eliminarCargaFila, iniciarCargaDesdeOperacion,
  publicarCargaDia, getChoferesConocidos, setEstadoControlFila,
  getConductores, agregarConductor, importarConductores, eliminarConductor,
  type CargaFila, type TurnoCarga, type EstadoControl,
} from "@/app/actions/carga-dia";
import { getOperacionDia, getTotalPaquetesFecha } from "@/app/actions/operacion";
import type { OperacionRuta } from "@/app/actions/operacion";
import {
  getPaquetesEspeciales, getPaquetesEspecialesRango, getClientesSugeridos, getChoferesRango,
  getCondicionesEspeciales, importarCondicionesEspeciales,
  type CondicionEspecial,
} from "@/app/actions/paquetes-especiales";
import { PaquetesEspecialesModal, urlImagen } from "@/components/volumenes/PaquetesEspecialesModal";
import { ImportarClientes } from "@/components/volumenes/ImportarClientes";

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

// Anima un número de su valor anterior al nuevo (count-up) con easing.
// Respeta prefers-reduced-motion: si está activo, muestra el valor directo.
function useCountUp(value: number, duration = 550): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) { setDisplay(to); fromRef.current = to; return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

// Stat card estilo dashboard: cuadro de ícono + número grande
const STAT_TONO: Record<string, { tile: string; num: string }> = {
  slate: { tile: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300", num: "text-foreground" },
  blue: { tile: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300", num: "text-blue-700 dark:text-blue-300" },
  amber: { tile: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300", num: "text-amber-700 dark:text-amber-300" },
};
function StatCard({ icon: Icon, tono, label, valor, sub }: {
  icon: typeof Package; tono: "slate" | "blue" | "amber"; label: string; valor: number; sub?: string;
}) {
  const t = STAT_TONO[tono];
  const shown = useCountUp(valor);
  return (
    <div className="border rounded-xl p-3.5 bg-card shadow-sm flex items-center gap-3 hover-lift">
      <span className={cn("inline-flex items-center justify-center h-10 w-10 rounded-xl shrink-0", t.tile)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums leading-tight", t.num)}>{shown.toLocaleString("es-AR")}</p>
        {sub && <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// Pill de filtro de zona (tab con punto de color + contador)
function ZonaPill({ activo, onClick, dot, label, count, icon: Icon }: {
  activo: boolean; onClick: () => void; dot: string; label: string; count: number; icon?: typeof Package;
}) {
  return (
    <button onClick={onClick}
      className={cn("shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors",
        activo ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-card border-border hover:bg-muted")}>
      {Icon
        ? <Icon className={cn("h-3 w-3", activo ? "text-white" : "text-violet-500")} />
        : <span className={cn("h-2 w-2 rounded-full", dot)} />}
      <span className={activo ? "text-white" : "text-foreground"}>{label}</span>
      <span className={cn("tabular-nums", activo ? "text-white/80" : "text-muted-foreground")}>{count}</span>
    </button>
  );
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
  // Banco de conductores (nómina estable, importable desde el Excel)
  const [conductores, setConductores] = useState<string[]>([]);
  const [modalConductores, setModalConductores] = useState(false);
  const [nuevoConductor, setNuevoConductor] = useState("");
  const [importandoCond, setImportandoCond] = useState(false);
  const fileCondRef = useRef<HTMLInputElement>(null);
  // Banco de condiciones especiales por cliente (Excel de administración)
  const [condicionesEsp, setCondicionesEsp] = useState<CondicionEspecial[]>([]);
  const [modalCondiciones, setModalCondiciones] = useState(false);
  const [importandoCondEsp, setImportandoCondEsp] = useState(false);
  const fileCondEspRef = useRef<HTMLInputElement>(null);
  const [clientesSug, setClientesSug] = useState<string[]>([]);
  const [rutasDia, setRutasDia] = useState<OperacionRuta[]>([]);
  const [agregandoCodigo, setAgregandoCodigo] = useState("");
  const [mostrarImportarClientes, setMostrarImportarClientes] = useState(false);
  const [totalPaquetesCliente, setTotalPaquetesCliente] = useState(0);
  // Paquetes especiales
  const [especialesCount, setEspecialesCount] = useState<Record<string, number>>({});
  const [modalEspeciales, setModalEspeciales] = useState<{ recorrido_id: string; codigo: string; nombre: string; zona: string } | null>(null);
  // Debounce de autoguardado por fila
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Última versión editada (sin guardar todavía) de cada fila, para poder
  // forzar el guardado antes de publicar y no perder tipeos recientes.
  const pendientesRef = useRef<Record<string, CargaFila>>({});
  // Feedback visual de autosave: id de fila → timestamp del último guardado ok
  const [guardadoOk, setGuardadoOk] = useState<Record<string, number>>({});

  const cargar = useCallback(async (f: string) => {
    setCargando(true);
    try {
      const [rCarga, rEsp, rOp, rCli] = await Promise.all([
        getCargaDia(f), getPaquetesEspeciales(f), getOperacionDia(f), getTotalPaquetesFecha(f),
      ]);
      if (rCarga.ok) setFilas(rCarga.data ?? []);
      if (rEsp.ok) {
        const counts: Record<string, number> = {};
        for (const p of rEsp.data ?? []) counts[p.recorrido_id] = (counts[p.recorrido_id] ?? 0) + 1;
        setEspecialesCount(counts);
      }
      if (rOp.ok) setRutasDia(rOp.data ?? []);
      if (rCli.ok) setTotalPaquetesCliente(rCli.total ?? 0);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);
  useEffect(() => {
    getChoferesConocidos().then(r => { if (r.ok) setChoferes(r.data ?? []); });
    getClientesSugeridos().then(r => { if (r.ok) setClientesSug(r.data ?? []); });
    getConductores().then(r => { if (r.ok) setConductores(r.data ?? []); });
    getCondicionesEspeciales().then(r => { if (r.ok) setCondicionesEsp(r.data ?? []); });
  }, []);

  // Sugerencias del campo chofer: nómina de conductores + nombres ya usados en cargas
  const sugerenciasChofer = useMemo(() => {
    const set = new Map<string, string>(); // clave normalizada → nombre original
    for (const n of [...conductores, ...choferes]) {
      const k = n.trim().toLowerCase();
      if (k && !set.has(k)) set.set(k, n.trim());
    }
    return [...set.values()].sort((a, b) => a.localeCompare(b));
  }, [conductores, choferes]);

  // ── Gestión de conductores ──
  async function altaConductor() {
    const nombre = nuevoConductor.trim();
    if (!nombre) return;
    const res = await agregarConductor(nombre);
    if (!res.ok) { toast.error("No se pudo agregar el conductor", { description: res.error }); return; }
    setNuevoConductor("");
    setConductores(prev => [...new Set([...prev, nombre])].sort((a, b) => a.localeCompare(b)));
    toast.success(`Conductor "${nombre}" agregado`);
  }

  async function bajaConductor(nombre: string) {
    const res = await eliminarConductor(nombre);
    if (!res.ok) { toast.error("No se pudo eliminar", { description: res.error }); return; }
    setConductores(prev => prev.filter(c => c !== nombre));
  }

  // Importa nombres desde un Excel: usa la hoja "Conductores" si existe
  // (como la del archivo TABLAS), si no toma la primera columna con texto.
  async function onArchivoConductores(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportandoCond(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const hoja = wb.SheetNames.find(n => n.trim().toLowerCase().startsWith("conductor")) ?? wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: "" }) as unknown[][];
      const nombres = new Set<string>();
      for (const r of rows) {
        for (const celda of r) {
          const v = String(celda ?? "").trim();
          if (!v || v.toLowerCase() === "conductores") continue;
          if (v.length < 3 || /\d{3,}/.test(v)) continue; // descarta códigos/números
          nombres.add(v.replace(/\s+/g, " "));
        }
      }
      if (nombres.size === 0) { toast.error("No se encontraron nombres en el archivo"); return; }
      const res = await importarConductores([...nombres]);
      if (!res.ok) { toast.error("No se pudo importar", { description: res.error }); return; }
      toast.success(`${res.agregados} conductores nuevos importados (${nombres.size} leídos, el resto ya existía)`);
      const r2 = await getConductores();
      if (r2.ok) setConductores(r2.data ?? []);
    } finally { setImportandoCond(false); }
  }

  // Importa la planilla "CONDICIONES DE PAGO ESPECIAL": columnas Cliente /
  // Condición especial / Observación adicional, con el cliente en celdas
  // combinadas (una fila sin cliente pertenece al último cliente visto).
  // Reemplaza todo el banco — se resube entero cuando cambia el Excel.
  async function onArchivoCondiciones(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportandoCondEsp(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }) as unknown[][];
      const filasParseadas: { cliente: string; condicion: string; observacion: string | null }[] = [];
      let clienteActual = "";
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const cliente = String(r[0] ?? "").trim();
        const condicion = String(r[1] ?? "").trim();
        const obs = String(r[2] ?? "").trim();
        if (!cliente && !condicion) continue;
        if (cliente) clienteActual = cliente;
        if (!condicion || !clienteActual) continue;
        filasParseadas.push({ cliente: clienteActual, condicion, observacion: obs || null });
      }
      if (filasParseadas.length === 0) { toast.error("No se encontraron condiciones en el archivo"); return; }
      const res = await importarCondicionesEspeciales(filasParseadas);
      if (!res.ok) { toast.error("No se pudo importar", { description: res.error }); return; }
      toast.success(`${res.importadas} condiciones especiales importadas (reemplazó el banco anterior)`);
      const r2 = await getCondicionesEspeciales();
      if (r2.ok) setCondicionesEsp(r2.data ?? []);
    } finally { setImportandoCondEsp(false); }
  }

  // Clientes agrupados (para la lista del modal)
  const condicionesPorCliente = useMemo(() => {
    const m = new Map<string, CondicionEspecial[]>();
    for (const c of condicionesEsp) m.set(c.cliente, [...(m.get(c.cliente) ?? []), c]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [condicionesEsp]);

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
    pendientesRef.current[key] = actualizada;
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(() => guardarFila(key), 600);
  }

  async function guardarFila(key: string) {
    const actualizada = pendientesRef.current[key];
    if (!actualizada) return;
    delete pendientesRef.current[key];
    if (timersRef.current[key]) { clearTimeout(timersRef.current[key]); delete timersRef.current[key]; }
    const res = await upsertCargaFila(
      actualizada.fecha, actualizada.turno, actualizada.recorrido_id,
      actualizada.chofer, actualizada.sistema, actualizada.x_fuera,
    );
    if (!res.ok) { toast.error(`No se pudo guardar ${actualizada.codigo}`, { description: res.error }); return; }
    // Tilde de "guardado" en la fila (se limpia al terminar la animación)
    setGuardadoOk(g => ({ ...g, [key]: Date.now() }));
    setTimeout(() => setGuardadoOk(g => { const n = { ...g }; delete n[key]; return n; }), 1400);
  }

  // Antes de publicar/exportar hay que asegurarse de que no queden ediciones
  // recién tipeadas esperando el debounce de 600ms — si no, se publican con
  // el valor viejo (ej: paquetes de pre-turno recién cargados que no entran).
  async function flushPendientes() {
    const keys = Object.keys(pendientesRef.current);
    await Promise.all(keys.map(k => guardarFila(k)));
  }

  function numero(s: string): number {
    const v = parseInt(s, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  // Trae ambos turnos (tarde y pre-turno) sin importar en qué pestaña esté
  // parado el coordinador, para no dejar afuera los pre-turnos por accidente.
  async function traerDeOperacion() {
    const [rTarde, rPre] = await Promise.all([
      iniciarCargaDesdeOperacion(fecha, "tarde"),
      iniciarCargaDesdeOperacion(fecha, "preturno"),
    ]);
    if (!rTarde.ok || !rPre.ok) {
      toast.error("No se pudo iniciar la carga", { description: rTarde.error ?? rPre.error });
      return;
    }
    const total = (rTarde.agregados ?? 0) + (rPre.agregados ?? 0);
    if (total === 0) {
      toast.info("No hay recorridos activos nuevos en la Operación del Día para esta fecha");
    } else {
      toast.success(`${total} recorridos agregados desde la Operación del Día`, {
        description: `${rTarde.agregados ?? 0} de tarde · ${rPre.agregados ?? 0} de pre-turno`,
      });
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
  // lleva el chofer y marcan el recorrido. Ciclo: sin marcar → verde (en control)
  // → rojo (por encima de lo esperado) → amarillo (recorrido finalizado) →
  // azul (frenado por alguna razón) → sin marcar.
  const CICLO_CONTROL: EstadoControl[] = [null, "verde", "rojo", "amarillo", "azul"];
  async function ciclarControl(fila: CargaFila) {
    if (!puedeEditar) return;
    const i = CICLO_CONTROL.indexOf(fila.estado_control);
    const siguiente = CICLO_CONTROL[(i + 1) % CICLO_CONTROL.length];
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
      await flushPendientes();
      const res = await publicarCargaDia(fecha);
      if (!res.ok) { toast.error("No se pudo enviar al análisis", { description: res.error }); return; }
      toast.success(`Día enviado al análisis: ${res.publicados} recorridos publicados`, {
        description: "Los datos ya están disponibles en Volúmenes → Análisis por recorrido.",
      });
    } finally { setPublicando(false); }
  }

  // Rango del mes de la fecha elegida (para el export "todo el mes")
  function rangoMes() {
    const desde = fecha.slice(0, 8) + "01";
    const [y, m] = fecha.split("-").map(Number);
    const fin = new Date(y, m, 0);
    const hasta = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
    return { desde, hasta };
  }

  // Alcance del export: "dia" = solo la fecha elegida (default) · "mes" = todo el mes
  const [alcanceExport, setAlcanceExport] = useState<"dia" | "mes">("dia");

  // Trae especiales + chofer por recorrido/fecha (para completar la columna Chofer)
  async function traerEspecialesExport() {
    const { desde, hasta } = alcanceExport === "dia" ? { desde: fecha, hasta: fecha } : rangoMes();
    const [rEsp, rChof] = await Promise.all([getPaquetesEspecialesRango(desde, hasta), getChoferesRango(desde, hasta)]);
    if (!rEsp.ok) { toast.error("No se pudo exportar", { description: rEsp.error }); return null; }
    const lista = rEsp.data ?? [];
    if (lista.length === 0) {
      toast.info(alcanceExport === "dia" ? "No hay paquetes especiales en la fecha elegida" : "No hay paquetes especiales en el mes de la fecha elegida");
      return null;
    }
    const choferPorRuta = new Map<string, string>();
    if (rChof.ok) for (const c of rChof.data ?? []) choferPorRuta.set(`${c.fecha}|${c.codigo}`, c.chofer);
    const etiqueta = alcanceExport === "dia" ? desde : desde.slice(0, 7);
    return { lista, choferPorRuta, etiqueta };
  }

  // Exporta a Excel los paquetes especiales (para administración)
  async function exportarEspeciales() {
    setExportandoEsp(true);
    try {
      const datos = await traerEspecialesExport();
      if (!datos) return;
      const { lista, choferPorRuta, etiqueta } = datos;
      const XLSX = await import("xlsx");
      const hoja = lista.map(p => ({
        Fecha: p.fecha, Zona: p.zona, "Código": p.codigo, Recorrido: p.recorrido_nombre,
        Chofer: choferPorRuta.get(`${p.fecha}|${p.codigo}`) ?? "",
        Cliente: p.cliente ?? "", Tracking: p.tracking ?? "", "Dirección": p.direccion ?? "",
        "Alto (cm)": p.alto_cm ?? "", "Ancho (cm)": p.ancho_cm ?? "",
        "Largo (cm)": p.largo_cm ?? "", "Peso (kg)": p.peso_kg ?? "",
        "Condición especial": p.condicion_especial ?? p.observacion ?? "",
        Fotos: p.imagenes.map(urlImagen).join("  "),
      }));
      const ws = XLSX.utils.json_to_sheet(hoja);
      ws["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 28 },
        { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 40 }, { wch: 60 }];
      // Hipervínculo real en la celda de Fotos (a la primera foto) para poder
      // abrirla con un clic desde Excel, no solo copiar la URL como texto.
      lista.forEach((p, i) => {
        if (p.imagenes.length === 0) return;
        const addr = XLSX.utils.encode_cell({ r: i + 1, c: 13 });
        if (ws[addr]) ws[addr].l = { Target: urlImagen(p.imagenes[0]), Tooltip: "Ver foto" };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Paquetes especiales");
      XLSX.writeFile(wb, `paquetes-especiales-${etiqueta}.xlsx`);
      toast.success(`${lista.length} paquetes especiales exportados (${etiqueta})`);
    } finally { setExportandoEsp(false); }
  }

  // Exporta un reporte HTML con las fotos visibles en miniatura — para que
  // administración/cobranzas vea el paquete de un vistazo, sin depender de
  // que Excel abra los links (algunos visores de Excel no muestran hipervínculos).
  async function exportarEspecialesConFotos() {
    setExportandoEsp(true);
    try {
      const datos = await traerEspecialesExport();
      if (!datos) return;
      const { lista, choferPorRuta, etiqueta } = datos;
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const filas = lista.map(p => {
        const chofer = choferPorRuta.get(`${p.fecha}|${p.codigo}`) ?? "—";
        const medidas = [p.alto_cm, p.ancho_cm, p.largo_cm].filter(v => v != null).length === 3
          ? `${p.alto_cm}×${p.ancho_cm}×${p.largo_cm} cm` : "";
        const fotos = p.imagenes.map(img => {
          const url = urlImagen(img);
          return `<a href="${esc(url)}" target="_blank"><img src="${esc(url)}" style="width:110px;height:110px;object-fit:cover;border-radius:8px;border:1px solid #ddd;margin:2px"></a>`;
        }).join("");
        return `<tr>
          <td>${esc(p.fecha)}</td><td>${esc(p.zona)}</td><td><b>${esc(p.codigo)}</b><br>${esc(p.recorrido_nombre)}</td>
          <td>${esc(chofer)}</td><td>${esc(p.cliente ?? "—")}</td><td>${esc(p.tracking ?? "—")}</td>
          <td>${esc(p.direccion ?? "—")}</td><td>${esc(medidas)}${p.peso_kg != null ? ` · ${p.peso_kg} kg` : ""}</td>
          <td>${esc(p.condicion_especial ?? p.observacion ?? "")}</td>
          <td>${fotos || "<span style=\"color:#999\">sin fotos</span>"}</td>
        </tr>`;
      }).join("\n");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Paquetes especiales ${etiqueta}</title>
        <style>
          body{font-family:system-ui,sans-serif;padding:20px;color:#111}
          table{border-collapse:collapse;width:100%;font-size:13px}
          th,td{border:1px solid #ddd;padding:8px;vertical-align:top;text-align:left}
          th{background:#fef3c7;position:sticky;top:0}
          h1{font-size:18px}
        </style></head><body>
        <h1>Paquetes especiales — ${etiqueta}</h1>
        <table><thead><tr>
          <th>Fecha</th><th>Zona</th><th>Recorrido</th><th>Chofer</th><th>Cliente</th><th>Tracking</th>
          <th>Dirección</th><th>Medidas</th><th>Condición especial</th><th>Fotos</th>
        </tr></thead><tbody>${filas}</tbody></table>
        </body></html>`;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `paquetes-especiales-${etiqueta}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${lista.length} paquetes especiales exportados con fotos (${etiqueta})`);
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

        {/* ── Resumen (stat cards estilo dashboard) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 stagger-children">
          <StatCard icon={Boxes} tono="slate" label="Sistema" valor={granTotal.sistema} />
          <StatCard icon={PackagePlus} tono="slate" label="X fuera" valor={granTotal.xFuera} />
          <StatCard icon={Sigma} tono="blue" label="Gran total" valor={granTotal.total}
            sub={`${filasVisibles.length} recorridos`} />
          <StatCard icon={Package} tono="amber" label="Especiales" valor={granTotal.especiales} />
          <StatCard icon={FileSpreadsheet} tono="blue" label="Paq. por cliente" valor={totalPaquetesCliente}
            sub={totalPaquetesCliente > 0 ? "Excel importado" : "sin importar"} />
        </div>

        {/* Filtro por zona (pills tipo tabs; pre-turno como 5ta zona) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 stagger-children">
          <ZonaPill activo={filtro === null} onClick={() => setFiltro(null)}
            dot="bg-slate-400" label="Todas" count={filasTarde.length} />
          {ORDEN_ZONAS.map(zona => {
            const st = subtotalZona(zona);
            return (
              <ZonaPill key={zona} activo={filtro === zona} onClick={() => setFiltro(filtro === zona ? null : zona)}
                dot={ZONA_COLOR[zona] ?? "bg-slate-400"} label={zona} count={st.n} />
            );
          })}
          <ZonaPill activo={filtro === "preturno"} onClick={() => setFiltro(filtro === "preturno" ? null : "preturno")}
            dot="bg-violet-500" label="Pre-Turno" count={filasPre.length} icon={Sunrise} />
        </div>

        {/* ── Acciones de armado ── */}
        {puedeEditar && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={traerDeOperacion} className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Traer recorridos de Operación del Día
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModalConductores(true)} className="h-8 gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Conductores ({conductores.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModalCondiciones(true)} className="h-8 gap-1.5 text-xs">
              <Wallet className="h-3.5 w-3.5" />
              Condiciones especiales ({condicionesPorCliente.length})
            </Button>
            <Button size="sm" variant={mostrarImportarClientes ? "default" : "outline"}
              onClick={() => setMostrarImportarClientes(v => !v)}
              className={cn("h-8 gap-1.5 text-xs", mostrarImportarClientes && "bg-blue-600 text-white hover:bg-blue-700")}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {mostrarImportarClientes ? "Cerrar" : "Paquetes por cliente (Excel)"}
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

        {mostrarImportarClientes && (
          <div className="border rounded-xl overflow-hidden bg-slate-50/80 dark:bg-slate-800/40">
            <ImportarClientes fechaFija={fecha}
              onImportado={() => cargar(fecha)} />
          </div>
        )}

        {filasVisibles.length > 0 && (
          <p className="text-[11px] text-muted-foreground -mt-2 flex items-center gap-3 flex-wrap">
            <span className="font-medium">Control (clic en el círculo):</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> En control</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Por encima de lo esperado</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Recorrido finalizado</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Frenado</span>
          </p>
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
                          f.estado_control === "verde" && "bg-emerald-50/30 dark:bg-emerald-950/10",
                          f.estado_control === "amarillo" && "bg-amber-50/50 dark:bg-amber-950/20",
                          f.estado_control === "azul" && "bg-blue-50/50 dark:bg-blue-950/20")}>
                          <td className="px-2 py-2 text-center">
                            <button onClick={() => ciclarControl(f)} disabled={!puedeEditar}
                              title={f.estado_control === "verde" ? "En control — clic para marcar en rojo"
                                : f.estado_control === "rojo" ? "Por encima de lo esperado — clic para marcar finalizado"
                                : f.estado_control === "amarillo" ? "Recorrido finalizado — clic para marcar frenado"
                                : f.estado_control === "azul" ? "Frenado por alguna razón — clic para desmarcar"
                                : "Sin controlar — clic para marcar en verde"}
                              className={cn("h-7 w-7 sm:h-5 sm:w-5 rounded-full border-2 transition-colors",
                                f.estado_control === "verde" && "bg-emerald-500 border-emerald-600",
                                f.estado_control === "rojo" && "bg-red-500 border-red-600",
                                f.estado_control === "amarillo" && "bg-amber-400 border-amber-500",
                                f.estado_control === "azul" && "bg-blue-500 border-blue-600",
                                !f.estado_control && "bg-transparent border-slate-300 dark:border-slate-600 hover:border-slate-400",
                                puedeEditar && "cursor-pointer")} />
                          </td>
                          <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {f.codigo}
                              {guardadoOk[f.id] && (
                                <Check key={guardadoOk[f.id]} className="h-3.5 w-3.5 text-emerald-500 animate-check-ok shrink-0" />
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[260px] truncate">{f.nombre}</td>
                          <td className="px-3 py-2">
                            <input list="choferes-carga" value={f.chofer ?? ""} disabled={!puedeEditar}
                              onChange={e => editarFila(f, { chofer: e.target.value })}
                              placeholder="Nombre del chofer…"
                              className="w-full border-0 border-b border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-base sm:text-xs focus:outline-none focus:border-blue-400 py-1.5 sm:py-0.5 placeholder:text-slate-300" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="number" min={0} value={f.sistema === 0 ? "" : f.sistema} disabled={!puedeEditar}
                              onChange={e => editarFila(f, { sistema: numero(e.target.value) })}
                              placeholder="0"
                              inputMode="numeric"
                              className="w-16 text-center border rounded-lg py-2 sm:py-1 bg-background text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="number" min={0} value={f.x_fuera === 0 ? "" : f.x_fuera} disabled={!puedeEditar}
                              onChange={e => editarFila(f, { x_fuera: numero(e.target.value) })}
                              placeholder="0"
                              inputMode="numeric"
                              className="w-16 text-center border rounded-lg py-2 sm:py-1 bg-background text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums" />
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
                              <Package className="h-6 w-6 sm:h-4 sm:w-4" />
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
                                className="p-1.5 sm:p-0 text-muted-foreground/30 hover:text-red-600 transition-colors">
                                <Trash2 className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
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
          {sugerenciasChofer.map(c => <option key={c} value={c} />)}
        </datalist>

        {/* ── Cierre del día ── */}
        <div className="flex items-center gap-2 flex-wrap border-t pt-4 pb-8">
          <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
            <button onClick={() => setAlcanceExport("dia")}
              className={cn("text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-colors",
                alcanceExport === "dia" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
              Solo {fecha}
            </button>
            <button onClick={() => setAlcanceExport("mes")}
              className={cn("text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-colors",
                alcanceExport === "mes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
              Todo el mes
            </button>
          </div>
          <Button size="sm" onClick={exportarEspeciales} disabled={exportandoEsp}
            variant="outline" className="h-9 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            {exportandoEsp ? "Exportando…" : "Exportar especiales (Excel)"}
          </Button>
          <Button size="sm" onClick={exportarEspecialesConFotos} disabled={exportandoEsp}
            variant="outline" className="h-9 gap-1.5 text-xs border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20">
            <Package className="h-3.5 w-3.5" />
            {exportandoEsp ? "Exportando…" : "Exportar con fotos (para cobranzas)"}
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

      {/* ── Modal gestión de conductores ── */}
      {modalConductores && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setModalConductores(false)}>
          <div className="bg-background border rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col p-6 gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 shrink-0">
                <Users className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">Conductores</p>
                <p className="text-xs text-muted-foreground">
                  {conductores.length} en la nómina — se sugieren al cargar el chofer de cada recorrido.
                </p>
              </div>
              <button onClick={() => setModalConductores(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Alta manual + import */}
            <div className="flex items-center gap-2">
              <input value={nuevoConductor} onChange={e => setNuevoConductor(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") altaConductor(); }}
                placeholder="Nombre del conductor nuevo…"
                className="flex-1 text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <Button size="sm" onClick={altaConductor} disabled={!nuevoConductor.trim()}
                className="h-9 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-3.5 w-3.5" /> Agregar
              </Button>
            </div>
            <div>
              <input ref={fileCondRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onArchivoConductores} />
              <button onClick={() => fileCondRef.current?.click()} disabled={importandoCond}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-border hover:bg-muted transition-colors disabled:opacity-50">
                <Upload className="h-3.5 w-3.5" />
                {importandoCond ? "Importando…" : 'Importar desde Excel (hoja "Conductores" de la planilla TABLAS)'}
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto border rounded-xl divide-y min-h-24">
              {conductores.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  Todavía no hay conductores cargados. Importá el Excel o agregalos de a uno.
                </p>
              ) : conductores.map(c => (
                <div key={c} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="flex-1 truncate">{c}</span>
                  <button onClick={() => bajaConductor(c)} title="Quitar de la nómina"
                    className="text-muted-foreground/40 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal banco de condiciones especiales ── */}
      {modalCondiciones && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setModalCondiciones(false)}>
          <div className="bg-background border rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col p-6 gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 shrink-0">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">Condiciones especiales por cliente</p>
                <p className="text-xs text-muted-foreground">
                  {condicionesPorCliente.length} clientes con condición registrada — se muestra al cargar un paquete especial.
                </p>
              </div>
              <button onClick={() => setModalCondiciones(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <input ref={fileCondEspRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onArchivoCondiciones} />
              <button onClick={() => fileCondEspRef.current?.click()} disabled={importandoCondEsp}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-border hover:bg-muted transition-colors disabled:opacity-50">
                <Upload className="h-3.5 w-3.5" />
                {importandoCondEsp ? "Importando…" : "Importar / actualizar desde Excel (reemplaza el banco anterior)"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-xl divide-y min-h-24">
              {condicionesPorCliente.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  Todavía no hay condiciones cargadas. Importá el Excel de "Condiciones de pago especial".
                </p>
              ) : condicionesPorCliente.map(([cliente, lista]) => (
                <div key={cliente} className="px-3 py-2">
                  <p className="text-xs font-semibold mb-1">{cliente}</p>
                  <div className="space-y-1">
                    {lista.map(c => (
                      <div key={c.id} className="text-[11px] text-muted-foreground pl-2 border-l-2 border-amber-300 dark:border-amber-800">
                        <span className="whitespace-pre-line">{c.condicion}</span>
                        {c.observacion_adicional && <span className="block italic">{c.observacion_adicional}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
