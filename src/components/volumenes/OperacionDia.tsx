"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Save, RefreshCw, ChevronLeft, ChevronRight,
  FileDown, AlertTriangle, CheckCircle, Users, Clock,
  Plus, Pencil, X, Lightbulb, Scissors, Sunrise, Trash2, Gauge, Search, Wand2,
} from "lucide-react";
import {
  getOperacionDia, inicializarOperacionDia,
  guardarOperacionBulk, getTotalPaquetesFecha, getSugerenciaOperacion,
} from "@/app/actions/operacion";
import type { SugerenciaRuta } from "@/app/actions/operacion";
import { getAnalisisRecorridos, getCoactivacionesHistoricas } from "@/app/actions/operaciones-diarias";
import type { AnalisisRecorrido } from "@/app/actions/operaciones-diarias";
import { crearRecorrido, actualizarCamposRecorrido, getSiguienteCodigo, eliminarRecorrido } from "@/app/actions/recorridos";
import { ZONA_COLOR as ZONA_HEX } from "@/lib/estados";
import { Skeleton } from "@/components/ui/skeleton";
import type { OperacionRuta } from "@/app/actions/operacion";
import { hoyAR, addDiasAR } from "@/lib/fechas";

const ZONAS_OPT = ["Oeste", "Norte", "Sur", "CABA"] as const;
const TIPOS_OPT = [
  { valor: "fijo",      label: "Fijo" },
  { valor: "pre_turno", label: "Pre-Turno" },
  { valor: "corte",     label: "Corte" },
  { valor: "suplencia", label: "Comodín" },
  { valor: "unificado", label: "Unificado" },
] as const;
const COLORES_ZONA = ZONA_HEX;

const hoy = hoyAR;
const addDias = addDiasAR;
function fmtFecha(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

const TIPO_BADGE: Record<string, string> = {
  fijo: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  pre_turno: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900",
  corte: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900",
  suplencia: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  unificado: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900",
};
const TIPO_LABEL: Record<string, string> = {
  fijo: "Fijo", pre_turno: "Pre-T", corte: "Corte", suplencia: "Cmd", unificado: "Unif.",
};
const ZONA_COLOR: Record<string, string> = {
  CABA: "bg-red-500", Norte: "bg-amber-500", Sur: "bg-green-600", Oeste: "bg-blue-600",
};

interface Props {
  pkgProyectado?: number;
  tipoProyeccion?: "min" | "esperado" | "max" | null;
  targetPkg?: number;
  modo?: "planificacion" | "resumen";
  onConfirmar?: () => void;
  totalPaquetes?: number;
}

export function OperacionDia({
  pkgProyectado = 0, totalPaquetes = 0, tipoProyeccion,
  targetPkg = 30, onConfirmar,
}: Props) {
  const pkgBase = pkgProyectado || totalPaquetes;
  const [fecha, setFecha] = useState(hoy());
  const [rutas, setRutas] = useState<OperacionRuta[]>([]);
  const [editados, setEditados] = useState<Record<string, Partial<OperacionRuta>>>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pkgTotal, setPkgTotal] = useState(pkgBase);
  const [filtroZona, setFiltroZona] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [soloActivos, setSoloActivos] = useState(false);
  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  const [analisisHist, setAnalisisHist] = useState<AnalisisRecorrido[]>([]);
  const [busqueda, setBusqueda] = useState("");
  // Historial de activaciones: recorrido_id -> set de fechas en que estuvo activo (últimos 120 días)
  const [historicoActivaciones, setHistoricoActivaciones] = useState<Record<string, Set<string>>>({});
  // Panel lateral derecho (estilo Drive): "resumen" | "sugerencias" | null
  const [panelAbierto, setPanelAbierto] = useState<"resumen" | "sugerencias" | null>(null);
  // Pre-armado automático: modal de sugerencia
  const [mostrarPreArmado, setMostrarPreArmado] = useState(false);
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false);
  const [sugerencia, setSugerencia] = useState<SugerenciaRuta[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  // Debounce para autoguardado al cambiar rutas ON/OFF
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Espejos siempre-actuales para que el autosave lea el estado vigente al
  // momento de disparar, no una foto vieja del render en que se programó.
  const rutasRef = useRef(rutas);
  const editadosRef = useRef(editados);
  useEffect(() => { rutasRef.current = rutas; }, [rutas]);
  useEffect(() => { editadosRef.current = editados; }, [editados]);

  // ── Modal agregar/editar recorrido ───────────────────────────────────────
  const [modalRuta, setModalRuta] = useState<{
    modo: "nuevo" | "editar";
    id?: string;
    codigo: string; nombre: string; zona: string; tipo: string;
  } | null>(null);
  const [guardandoRuta, setGuardandoRuta] = useState(false);
  // Borradores en cola para agregar varios recorridos juntos (solo modo "nuevo")
  const [draftsNuevos, setDraftsNuevos] = useState<{ codigo: string; nombre: string; zona: string; tipo: string }[]>([]);

  async function abrirNuevo() {
    const res = await getSiguienteCodigo("Oeste", "fijo");
    setDraftsNuevos([]);
    setModalRuta({ modo: "nuevo", codigo: res.codigo ?? "", nombre: "", zona: "Oeste", tipo: "fijo" });
  }

  // Auto-generar código cuando cambia zona o tipo (solo en modo nuevo)
  async function actualizarCodigoAuto(zona: string, tipo: string) {
    const res = await getSiguienteCodigo(zona, tipo);
    if (res.ok && res.codigo) {
      setModalRuta(m => m ? { ...m, zona, tipo, codigo: res.codigo! } : m);
    } else {
      setModalRuta(m => m ? { ...m, zona, tipo } : m);
    }
  }
  function abrirEditar(r: OperacionRuta) {
    setModalRuta({ modo: "editar", id: r.recorrido_id, codigo: r.codigo, nombre: r.nombre, zona: r.zona, tipo: r.tipo });
  }

  // Agrega el borrador actual del modal a la cola y limpia el formulario para el siguiente
  function agregarDraftALaLista() {
    if (!modalRuta || modalRuta.modo !== "nuevo") return;
    if (!modalRuta.codigo.trim() || !modalRuta.nombre.trim()) {
      toast.error("Código y nombre son obligatorios"); return;
    }
    setDraftsNuevos(prev => [...prev, {
      codigo: modalRuta.codigo.trim().toUpperCase(),
      nombre: modalRuta.nombre.trim(),
      zona: modalRuta.zona,
      tipo: modalRuta.tipo,
    }]);
    setModalRuta(m => m ? { ...m, nombre: "" } : m);
    actualizarCodigoAuto(modalRuta.zona, modalRuta.tipo);
  }

  function quitarDraft(i: number) {
    setDraftsNuevos(prev => prev.filter((_, idx) => idx !== i));
  }

  async function guardarRuta() {
    if (!modalRuta) return;
    if (modalRuta.modo === "nuevo") {
      const actual = modalRuta.codigo.trim() && modalRuta.nombre.trim()
        ? [{ codigo: modalRuta.codigo.trim().toUpperCase(), nombre: modalRuta.nombre.trim(), zona: modalRuta.zona, tipo: modalRuta.tipo }]
        : [];
      const todos = [...draftsNuevos, ...actual];
      if (todos.length === 0) { toast.error("Código y nombre son obligatorios"); return; }
      setGuardandoRuta(true);
      try {
        let okCount = 0;
        for (const d of todos) {
          const res = await crearRecorrido({
            codigo: d.codigo.trim().toUpperCase(),
            nombre: d.nombre.trim(),
            zona: d.zona as "Oeste" | "Norte" | "Sur" | "CABA",
            tipo: d.tipo as "fijo" | "suplencia" | "corte" | "pre_turno" | "unificado",
            color: COLORES_ZONA[d.zona] ?? "#6b7280",
          });
          if (!res.ok) { toast.error(`Error al crear ${d.codigo}`, { description: res.error }); }
          else okCount++;
        }
        if (okCount > 0) toast.success(`${okCount} recorrido${okCount > 1 ? "s" : ""} creado${okCount > 1 ? "s" : ""}`);
        setModalRuta(null);
        setDraftsNuevos([]);
        await inicializarOperacionDia(fecha);
        await cargar(fecha);
      } finally { setGuardandoRuta(false); }
      return;
    }

    if (!modalRuta.codigo.trim() || !modalRuta.nombre.trim()) {
      toast.error("Código y nombre son obligatorios"); return;
    }
    setGuardandoRuta(true);
    try {
      if (!modalRuta.id) return;
      const res = await actualizarCamposRecorrido(modalRuta.id, {
        codigo: modalRuta.codigo.trim().toUpperCase(),
        nombre: modalRuta.nombre.trim(),
        zona: modalRuta.zona as "Oeste" | "Norte" | "Sur" | "CABA",
        tipo: modalRuta.tipo as "fijo" | "suplencia" | "corte" | "pre_turno" | "unificado",
        color: COLORES_ZONA[modalRuta.zona] ?? "#6b7280",
      });
      if (!res.ok) { toast.error("Error al actualizar", { description: res.error }); return; }
      toast.success(`Recorrido actualizado`);
      setModalRuta(null);
      await inicializarOperacionDia(fecha);
      await cargar(fecha);
    } finally { setGuardandoRuta(false); }
  }

  async function eliminarRuta() {
    if (!modalRuta || modalRuta.modo !== "editar" || !modalRuta.id) return;
    if (!confirm(`¿Eliminar el recorrido ${modalRuta.codigo}? Esta acción no se puede deshacer.`)) return;
    setGuardandoRuta(true);
    try {
      const res = await eliminarRecorrido(modalRuta.id);
      if (!res.ok) { toast.error("Error al eliminar recorrido", { description: res.error }); return; }
      toast.success(`Recorrido ${modalRuta.codigo} eliminado`);
      setModalRuta(null);
      await cargar(fecha);
    } finally { setGuardandoRuta(false); }
  }

  // Cuando cambia pkgProyectado desde el padre, auto-poblar
  useEffect(() => {
    if (pkgBase > 0) setPkgTotal(pkgBase);
  }, [pkgBase]);

  // Cargar / inicializar operación del día
  const cargar = useCallback(async (f: string) => {
    setCargando(true);
    try {
      // Inicializar silenciosamente (puede fallar si ya existen)
      try { await inicializarOperacionDia(f); } catch { /* ignorar */ }
      const [res, pkgRes] = await Promise.all([
        getOperacionDia(f),
        getTotalPaquetesFecha(f),
      ]);
      if (res.ok && res.data && res.data.length > 0) {
        setRutas(res.data);
        setEditados({});
      } else if (!res.ok) {
        toast.error("Error al cargar operación del día", { description: res.error });
      }
      if (pkgRes.ok && pkgRes.total && pkgRes.total > 0) {
        setPkgTotal(pkgRes.total);
      }
    } catch (e) {
      toast.error("Error al cargar rutas", { description: String(e) });
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);

  // Al cambiar de fecha (o desmontar), cancelar cualquier autosave pendiente:
  // un timer de la fecha anterior no debe guardar sobre los datos de la nueva.
  useEffect(() => {
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [fecha]);

  // Análisis histórico para sugerencias de cortes / pre-turnos
  useEffect(() => {
    getAnalisisRecorridos(30).then(res => {
      if (res.ok && res.data) setAnalisisHist(res.data);
    });
  }, []);

  // Historial de coactivaciones (últimos 120 días) para detectar combinaciones atípicas
  useEffect(() => {
    getCoactivacionesHistoricas(120).then(res => {
      if (res.ok && res.data) {
        const map: Record<string, Set<string>> = {};
        res.data.forEach(c => {
          if (!map[c.recorrido_id]) map[c.recorrido_id] = new Set();
          map[c.recorrido_id].add(c.fecha);
        });
        setHistoricoActivaciones(map);
      }
    });
  }, []);

  // Merge local edits
  const rutasConEdits = rutas.map(r => ({ ...r, ...editados[r.recorrido_id] }));

  // ── Sugerencias inteligentes: dónde conviene armar cortes o pre-turnos ─────
  // Cruza el análisis histórico (30 días) con las rutas activas hoy: si una ruta
  // fija viene sobrecargada de forma sostenida, sugiere abrir un corte (split)
  // o, si lo que sobra es sistemático "x fuera", un pre-turno que lo absorba.
  const sugerencias = analisisHist
    .filter(a => a.tipo === "fijo" && rutasConEdits.some(r => r.codigo === a.codigo && r.activo))
    .filter(a => a.pct_sobrecarga >= 40 || a.prom_total >= 36)
    .sort((a, b) => b.pct_sobrecarga - a.pct_sobrecarga || b.prom_total - a.prom_total)
    .slice(0, 6)
    .map(a => {
      const ruta = rutasConEdits.find(r => r.codigo === a.codigo);
      const tipoSugerido: "corte" | "pre_turno" = a.prom_x_fuera >= 4 ? "pre_turno" : "corte";
      return {
        ...a,
        nombre: ruta?.nombre ?? "",
        tipoSugerido,
        motivo: tipoSugerido === "pre_turno"
          ? `Promedio ${a.prom_total} pkg + ${a.prom_x_fuera} "x fuera" recurrentes — un pre-turno puede absorber ese excedente antes del reparto`
          : `Sobrecargada el ${a.pct_sobrecarga}% de los días (prom. ${a.prom_total}, máx ${a.max_total}) — conviene dividirla en un corte`,
      };
    });

  function abrirSugerencia(s: typeof sugerencias[number]) {
    setDraftsNuevos([]);
    setModalRuta({ modo: "nuevo", codigo: "", nombre: `Corte de ${s.codigo} — ${s.nombre}`.slice(0, 80), zona: s.zona, tipo: s.tipoSugerido });
    actualizarCodigoAuto(s.zona, s.tipoSugerido);
  }

  // Filtrado
  const busquedaNorm = busqueda.trim().toLowerCase();
  const rutasFiltradas = rutasConEdits.filter(r => {
    if (filtroZona && r.zona !== filtroZona) return false;
    if (filtroTipo && r.tipo !== filtroTipo) return false;
    if (soloActivos && !r.activo) return false;
    if (busquedaNorm && !`${r.codigo} ${r.nombre}`.toLowerCase().includes(busquedaNorm)) return false;
    return true;
  });

  // ── Detección de errores comunes: nombres parecidos y combinaciones atípicas ──
  const STOPWORDS = new Set(["de", "la", "el", "los", "las", "con", "y", "del", "en", "san"]);
  function palabrasClave(nombre: string): string[] {
    return nombre
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOPWORDS.has(w));
  }
  function nombresSimilares(a: string, b: string): boolean {
    const wa = palabrasClave(a), wb = palabrasClave(b);
    return wa.some(w => wb.includes(w));
  }
  function esCombinacionAtipica(idA: string, idB: string): boolean {
    const fa = historicoActivaciones[idA], fb = historicoActivaciones[idB];
    if (!fa || !fb || fa.size < 5 || fb.size < 5) return false; // sin suficiente historial
    const juntos = [...fa].filter(f => fb.has(f)).length;
    return juntos / Math.min(fa.size, fb.size) < 0.15;
  }

  // Cálculos en tiempo real
  const activas = rutasConEdits.filter(r => r.activo);
  const nActivas = activas.length;
  const nFijos = activas.filter(r => r.tipo === "fijo").length;
  const nPreT = activas.filter(r => r.tipo === "pre_turno").length;
  const nCortes = activas.filter(r => r.tipo === "corte").length;
  const nUnificados = activas.filter(r => r.tipo === "unificado").length;
  const comodinesActivos = activas.filter(r => r.tipo === "suplencia").length;
  const comodinesTotal = rutasConEdits.filter(r => r.tipo === "suplencia").length;

  // Checklist final: avisos de posibles duplicados / errores entre las rutas activas
  const advertenciasActivas: string[] = [];
  for (let i = 0; i < activas.length; i++) {
    for (let j = i + 1; j < activas.length; j++) {
      const a = activas[i], b = activas[j];
      if (nombresSimilares(a.nombre, b.nombre)) {
        advertenciasActivas.push(`"${a.codigo} — ${a.nombre}" y "${b.codigo} — ${b.nombre}" tienen nombres parecidos. ¿Es un duplicado o son zonas distintas?`);
      }
      if (esCombinacionAtipica(a.recorrido_id, b.recorrido_id)) {
        advertenciasActivas.push(`Rara vez tenés activos juntos ${a.codigo} y ${b.codigo} — revisá si corresponde.`);
      }
    }
  }
  const promedio = nActivas > 0 && pkgTotal > 0 ? pkgTotal / nActivas : 0;
  const choferes = pkgTotal > 0 ? Math.ceil(pkgTotal / targetPkg) : nActivas;
  const estadoColor = promedio === 0 ? "text-muted-foreground"
    : promedio > 40 || promedio < 20 ? "text-red-600 dark:text-red-300"
    : promedio > 35 || promedio < 25 ? "text-amber-600 dark:text-amber-300"
    : "text-green-600 dark:text-green-300";
  const estadoLabel = promedio === 0 ? "Sin paquetes"
    : promedio > 40 ? "⚠ SOBRECARGA"
    : promedio > 35 ? "↑ SOBRE TARGET"
    : promedio >= 25 ? "✓ EN RANGO"
    : "↓ BAJO TARGET";

  // ── Capacidad máxima antes de superar banda de 40P ─────────────────────────
  // Máximo de paquetes que soporta la flota actual antes de pasar a zona peligrosa
  const capacidadMax40 = nActivas * 40;                          // límite absoluto
  const margenHasta40  = pkgTotal > 0 ? capacidadMax40 - pkgTotal : 0;
  const pctBuffer      = capacidadMax40 > 0 ? Math.round(margenHasta40 / capacidadMax40 * 100) : 0;
  const capacidadMax35 = nActivas * 35;                          // límite aceptable
  const margenHasta35  = pkgTotal > 0 ? Math.max(0, capacidadMax35 - pkgTotal) : 0;

  // Autoguardado: lee siempre el estado VIGENTE (refs), guarda, y al éxito
  // limpia solo lo efectivamente guardado. Los toggles hechos mientras se
  // guardaba quedan pendientes y disparan una nueva pasada automáticamente.
  const programarAutosave = useCallback((delayMs = 2000) => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      const editadosSnap = { ...editadosRef.current };
      if (Object.keys(editadosSnap).length === 0) return;
      const rutasActualizadas = rutasRef.current.map(r => ({ ...r, ...editadosSnap[r.recorrido_id] }));
      const payload = rutasActualizadas.map(r => ({
        recorrido_id: r.recorrido_id,
        activo: r.activo,
        notas_dia: r.notas_dia ?? null,
        paquetes_asignados: r.paquetes_asignados ?? 0,
      }));
      try {
        const res = await guardarOperacionBulk(fecha, payload);
        if (!res.ok) {
          toast.error("No se pudo autoguardar — tus cambios siguen marcados", { description: res.error });
          return;
        }
        // Aplicar lo guardado a las filas localmente (sin refetch que pise la UI)
        setRutas(prev => prev.map(r => editadosSnap[r.recorrido_id] ? { ...r, ...editadosSnap[r.recorrido_id] } : r));
        // Limpiar SOLO lo que se guardó y no cambió después
        let quedanPendientes = false;
        setEditados(prev => {
          const next = { ...prev };
          for (const id of Object.keys(editadosSnap)) {
            if (JSON.stringify(next[id]) === JSON.stringify(editadosSnap[id])) delete next[id];
          }
          quedanPendientes = Object.keys(next).length > 0;
          return next;
        });
        // Si el usuario siguió tildando durante el guardado, guardar eso también
        if (quedanPendientes) programarAutosave(500);
      } catch (e) {
        toast.error("No se pudo autoguardar — tus cambios siguen marcados", { description: String(e) });
      }
    }, delayMs);
  }, [fecha]);

  // Toggle activo/inactivo con autoguardado debounceado (2s)
  function toggleRuta(recorrido_id: string) {
    setEditados(prev => {
      const ruta = rutasConEdits.find(r => r.recorrido_id === recorrido_id)!;
      const activando = !ruta.activo;
      const siguiente = { ...prev, [recorrido_id]: { ...prev[recorrido_id], activo: activando } };

      // Al activar: avisar si hay nombres parecidos o combinaciones atípicas con lo ya activo
      if (activando) {
        const otrasActivas = rutasConEdits.filter(r =>
          r.recorrido_id !== recorrido_id && (siguiente[r.recorrido_id]?.activo ?? r.activo)
        );
        otrasActivas.forEach(otra => {
          if (nombresSimilares(ruta.nombre, otra.nombre)) {
            toast.warning(`"${ruta.nombre}" se parece a "${otra.nombre}" (ya activo) — ¿son zonas distintas?`);
          }
          if (esCombinacionAtipica(recorrido_id, otra.recorrido_id)) {
            toast.warning(`Rara vez activás ${ruta.codigo} junto con ${otra.codigo} — revisá si es correcto`);
          }
        });
      }

      programarAutosave();
      return siguiente;
    });
  }

  // Editar nota (también autoguarda, con debounce más largo para no guardar por tecla)
  function setNota(recorrido_id: string, nota: string) {
    setEditados(prev => ({ ...prev, [recorrido_id]: { ...prev[recorrido_id], notas_dia: nota } }));
    programarAutosave(3000);
  }

  // Guardar todo
  async function guardar() {
    setGuardando(true);
    try {
      const payload = rutasConEdits.map(r => ({
        recorrido_id: r.recorrido_id,
        activo: r.activo,
        notas_dia: r.notas_dia ?? null,
        paquetes_asignados: r.paquetes_asignados ?? 0,
      }));
      const res = await guardarOperacionBulk(fecha, payload);
      if (!res.ok) { toast.error("Error al guardar", { description: res.error }); return; }
      toast.success("Operación del día guardada");
      await cargar(fecha);
    } finally { setGuardando(false); }
  }

  // Deshabilitar TODOS los recorridos de todas las zonas (empezar de cero)
  async function limpiarRecorridos() {
    if (!confirm("¿Deshabilitar TODOS los recorridos de todas las zonas? Vas a empezar de cero para armar la operación del día.")) return;
    setGuardando(true);
    try {
      const payload = rutas.map(r => ({
        recorrido_id: r.recorrido_id,
        activo: false,
        notas_dia: r.notas_dia ?? null,
        paquetes_asignados: r.paquetes_asignados ?? 0,
      }));
      const res = await guardarOperacionBulk(fecha, payload);
      if (!res.ok) { toast.error("Error al limpiar recorridos", { description: res.error }); return; }
      setEditados({});
      toast.success("Todos los recorridos fueron deshabilitados");
      await cargar(fecha);
    } finally { setGuardando(false); }
  }

  // ── Pre-armado automático según historial ──────────────────────────────────
  async function abrirPreArmado() {
    setCargandoSugerencia(true);
    setMostrarPreArmado(true);
    try {
      const res = await getSugerenciaOperacion(fecha);
      if (!res.ok || !res.data) {
        toast.error("No se pudo calcular la sugerencia", { description: res.error });
        setMostrarPreArmado(false);
        return;
      }
      setSugerencia(res.data);
    } finally { setCargandoSugerencia(false); }
  }

  // Aplica la sugerencia: marca activo=sugerido en cada ruta (queda pendiente de guardar)
  function aplicarPreArmado() {
    const porId = new Map(sugerencia.map(s => [s.recorrido_id, s.sugerido]));
    setEditados(prev => {
      const next = { ...prev };
      for (const r of rutas) {
        const sug = porId.get(r.recorrido_id);
        if (sug === undefined) continue;
        if (r.activo !== sug) {
          next[r.recorrido_id] = { ...next[r.recorrido_id], activo: sug };
        } else if (next[r.recorrido_id]?.activo !== undefined) {
          // coincide con lo ya guardado: descartar el cambio pendiente de activo
          const { activo: _omit, ...resto } = next[r.recorrido_id];
          if (Object.keys(resto).length === 0) delete next[r.recorrido_id];
          else next[r.recorrido_id] = resto;
        }
      }
      return next;
    });
    const nOn = sugerencia.filter(s => s.sugerido).length;
    setMostrarPreArmado(false);
    toast.success(`Pre-armado aplicado: ${nOn} recorridos sugeridos. Revisá y guardá.`, { duration: 6000 });
    programarAutosave(1500);
  }

  // Manejar clic exportar: mostrar alerta si fuera de rango
  function handleExportar() {
    setMostrarAlerta(true);
  }

  // Exportar PDF — diseño por zonas, solo activos
  async function exportarPDF() {
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const PW = pdf.internal.pageSize.getWidth();  // 297
      const PH = pdf.internal.pageSize.getHeight(); // 210
      const M = 10;

      // Solo rutas activas
      const activos = rutasConEdits.filter(r => r.activo);

      // Configuración de zonas (incluyendo Pre-Turnos como 5ta)
      const ZONAS_PDF = [
        { nombre: "ZONA OESTE",     key: "Oeste",     tipos: ["fijo","corte"],  r: 37,  g: 99,  b: 235 },
        { nombre: "ZONA NORTE",     key: "Norte",     tipos: ["fijo","corte"],  r: 217, g: 119, b: 6   },
        { nombre: "ZONA SUR",       key: "Sur",       tipos: ["fijo","corte"],  r: 22,  g: 163, b: 74  },
        { nombre: "ZONA CABA",      key: "CABA",      tipos: ["fijo","corte"],  r: 220, g: 38,  b: 38  },
        { nombre: "PRE-TURNOS",     key: "PRETURNOS", tipos: ["pre_turno"],     r: 124, g: 58,  b: 237 },
      ] as const;

      // ── PÁGINA 1: Portada + resumen ──
      // Fondo oscuro superior
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, PW, 38, "F");

      // Línea de acento
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 36, PW, 2, "F");

      // Logo/título
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("LOGÍSTICA HOGAREÑO", M, 16);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(148, 163, 184);
      pdf.text("OPERACIÓN DEL DÍA — INFORME DE GESTIÓN", M, 25);

      // Fecha a la derecha
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text(fmtFecha(fecha).toUpperCase(), PW - M, 20, { align: "right" });

      // ── Cards de resumen ──
      let y = 46;
      const margenColor = margenHasta40 < 0 ? { r: 220, g: 38, b: 38 }
        : margenHasta35 < 200 ? { r: 217, g: 119, b: 6 }
        : { r: 22, g: 163, b: 74 };
      const cards = [
        { label: "RUTAS ACTIVAS", valor: nActivas.toString(), sub: `${nFijos}F · ${nPreT}PT · ${nCortes}C · ${nUnificados}U`, r: 37, g: 99, b: 235 },
        { label: "CHOFERES", valor: choferes.toString(), sub: `@ ${targetPkg} pkg/chofer`, r: 22, g: 163, b: 74 },
        { label: "PAQUETES", valor: pkgTotal > 0 ? pkgTotal.toLocaleString("es-AR") : "—", sub: "proyectados", r: 124, g: 58, b: 237 },
        { label: "PROM/RUTA", valor: promedio > 0 ? promedio.toFixed(1) : "—", sub: `target ${targetPkg}±5`, r: promedio > 0 && promedio >= targetPkg-5 && promedio <= targetPkg+5 ? 22 : 220, g: promedio > 0 && promedio >= targetPkg-5 && promedio <= targetPkg+5 ? 163 : 38, b: promedio > 0 && promedio >= targetPkg-5 && promedio <= targetPkg+5 ? 74 : 38 },
        {
          label: "MARGEN HASTA 40P",
          valor: margenHasta40 < 0 ? `−${Math.abs(margenHasta40)} paq` : `+${margenHasta40} paq`,
          sub: margenHasta40 < 0 ? "SUPERADO" : `cap. ${capacidadMax40} · ${pctBuffer}% libre`,
          ...margenColor,
        },
      ];
      const cW = (PW - M * 2 - 8) / cards.length;
      cards.forEach((c, i) => {
        const cx = M + i * (cW + 2);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(cx, y, cW, 22, 2, 2, "F");
        pdf.setFillColor(c.r, c.g, c.b);
        pdf.roundedRect(cx, y, 2, 22, 1, 1, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(c.label, cx + 5, y + 6);
        pdf.setFontSize(14);
        pdf.setTextColor(c.r, c.g, c.b);
        pdf.text(c.valor, cx + 5, y + 15);
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text(c.sub, cx + 5, y + 20.5);
      });
      y += 30;

      // ── Secciones por zona ──
      const renderZona = (def: typeof ZONAS_PDF[number]) => {
        let rutas: typeof activos;
        if (def.key === "PRETURNOS") {
          rutas = activos.filter(r => r.tipo === "pre_turno");
        } else {
          rutas = activos.filter(r => r.zona === def.key && r.tipo !== "pre_turno");
        }
        if (rutas.length === 0) return;

        // Verificar si necesita nueva página
        if (y + 12 + rutas.length * 7 > PH - 15) {
          pdf.addPage();
          y = 15;
        }

        // Header de zona
        pdf.setFillColor(def.r, def.g, def.b);
        pdf.roundedRect(M, y, PW - M * 2, 9, 1.5, 1.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(def.nombre, M + 4, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text(`${rutas.length} recorridos activos`, PW - M - 4, y + 6, { align: "right" });
        y += 12;

        // Filas de rutas
        rutas.forEach((r, i) => {
          if (y > PH - 18) {
            pdf.addPage();
            y = 15;
            // Repetir mini-header
            pdf.setFillColor(def.r, def.g, def.b);
            pdf.roundedRect(M, y, PW - M * 2, 6, 1, 1, "F");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7);
            pdf.setTextColor(255, 255, 255);
            pdf.text(`${def.nombre} (continuación)`, M + 4, y + 4.2);
            y += 9;
          }

          // Fondo alternado
          if (i % 2 === 1) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(M, y - 1, PW - M * 2, 6.5, "F");
          }

          // Punto de color (tipo)
          const dotR = r.tipo === "fijo" ? def.r : r.tipo === "pre_turno" ? 124 : 217;
          const dotG = r.tipo === "fijo" ? def.g : r.tipo === "pre_turno" ? 58  : 119;
          const dotB = r.tipo === "fijo" ? def.b : r.tipo === "pre_turno" ? 237 : 6;
          pdf.setFillColor(dotR, dotG, dotB);
          pdf.circle(M + 3, y + 2.5, 1.2, "F");

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.5);
          pdf.setTextColor(30, 41, 59);
          pdf.text(r.codigo, M + 7, y + 4);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(71, 85, 105);
          pdf.text(r.nombre.slice(0, 60), M + 40, y + 4);

          // Tipo badge
          pdf.setFillColor(dotR + 40 > 255 ? 255 : dotR + 40, dotG + 40 > 255 ? 255 : dotG + 40, dotB + 40 > 255 ? 255 : dotB + 40);
          pdf.roundedRect(M + 165, y, 18, 5.5, 1, 1, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6);
          pdf.setTextColor(dotR, dotG, dotB);
          pdf.text(TIPO_LABEL[r.tipo] ?? r.tipo, M + 174, y + 3.8, { align: "center" });

          // Notas
          if (r.notas_dia) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(6.5);
            pdf.setTextColor(148, 163, 184);
            pdf.text(r.notas_dia.slice(0, 50), M + 187, y + 4);
          }
          y += 7;
        });
        y += 4;
      };

      ZONAS_PDF.forEach(renderZona);

      // ── Pie de página ──
      const totalPags = (pdf.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      for (let i = 1; i <= totalPags; i++) {
        pdf.setPage(i);
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, PH - 8, PW, 8, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`RutaMap · Logística Hogareño · Generado: ${new Date().toLocaleString("es-AR")} · ${activos.length} rutas activas · ${choferes} choferes`, M, PH - 3);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`${i} / ${totalPags}`, PW - M, PH - 3, { align: "right" });
      }

      pdf.save(`operacion-${fecha}.pdf`);
      toast.success("Informe exportado");
    } catch (e) {
      toast.error("Error al exportar", { description: String(e) });
    }
  }

  const hayEdits = Object.keys(editados).length > 0;

  return (
    <div className="flex flex-col h-full relative overflow-hidden" ref={reportRef}>
      {/* ── Header / Controls ── */}
      <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap bg-background">
        {/* Fecha */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            disabled={fecha <= addDias(hoy(), -3)}
            onClick={() => setFecha(addDias(fecha, -1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <input type="date" value={fecha}
            min={addDias(hoy(), -3)} max={addDias(hoy(), 3)}
            onChange={e => setFecha(e.target.value)}
            className="border rounded px-2 py-1 text-xs h-7 bg-background" />
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={fecha >= addDias(hoy(), 3)}
            onClick={() => setFecha(addDias(fecha, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Chips días recientes */}
        <div className="flex items-center gap-1">
          {[-2, -1, 0].map(d => {
            const f = addDias(hoy(), d);
            const lbl = d === 0 ? "Hoy" : d === -1 ? "Ayer" : new Date(f + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short" });
            return (
              <button key={d}
                onClick={() => setFecha(f)}
                className={cn(
                  "h-6 px-2 rounded text-[10px] font-medium border transition-colors",
                  fecha === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                )}>
                {lbl}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
          {fmtFecha(fecha)}
        </span>
        {fecha < hoy() && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-medium">
            Editando día pasado
          </span>
        )}
        {tipoProyeccion && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium">
            Proyección {tipoProyeccion === "min" ? "Mínima" : tipoProyeccion === "esperado" ? "Esperada" : "Máxima"} — {pkgTotal.toLocaleString("es-AR")} paq
          </span>
        )}

        {/* Paquetes del día */}
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-[10px] text-muted-foreground">Paquetes del día:</span>
          <input
            type="number" min={0} value={pkgTotal || ""}
            placeholder={pkgBase > 0 ? pkgBase.toString() : "0"}
            onChange={e => setPkgTotal(parseInt(e.target.value) || 0)}
            className={cn(
              "border rounded px-2 py-0.5 text-sm h-7 w-28 tabular-nums text-right bg-background font-semibold",
              pkgTotal > 0 ? "border-blue-400 text-blue-700 dark:text-blue-300" : "border-border text-muted-foreground"
            )}
          />
          {pkgBase > 0 && pkgTotal !== pkgBase && (
            <button className="text-[10px] text-blue-600 dark:text-blue-300 hover:underline"
              onClick={() => setPkgTotal(pkgBase)}>
              ← {pkgBase.toLocaleString("es-AR")}
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cargar(fecha)} disabled={cargando}>
            <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
          </Button>
          {hayEdits && (
            <Button size="sm" onClick={guardar} disabled={guardando}
              className="h-7 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="h-3 w-3" />
              {guardando ? "…" : "Guardar"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Rail lateral derecho (estilo Drive) ── */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 bg-background/95 backdrop-blur border border-r-0 rounded-l-xl shadow-lg p-1.5">
        <button onClick={() => setPanelAbierto(p => p === "resumen" ? null : "resumen")}
          title="Rutas y paquetes"
          className={cn("relative h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
            panelAbierto === "resumen" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-accent")}>
          <Gauge className="h-5 w-5" />
          <span className={cn("absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-background",
            promedio === 0 ? "bg-slate-400" : promedio > 35 || promedio < 25 ? "bg-amber-500" : "bg-green-500")} />
        </button>
        {sugerencias.length > 0 && (
          <button onClick={() => setPanelAbierto(p => p === "sugerencias" ? null : "sugerencias")}
            title="Sugerencias de cortes y pre-turnos"
            className={cn("relative h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
              panelAbierto === "sugerencias" ? "bg-amber-500 text-white" : "text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40")}>
            <Lightbulb className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background tabular-nums">
              {sugerencias.length}
            </span>
          </button>
        )}
      </div>

      {/* ── Panel deslizable derecho ── */}
      {panelAbierto && (
        <>
          {/* Click fuera para cerrar */}
          <div className="absolute inset-0 z-30" onClick={() => setPanelAbierto(null)} />
          <div className="absolute right-[52px] top-0 bottom-0 z-40 w-[340px] max-w-[80vw] bg-background border-l shadow-2xl flex flex-col animate-fade-up">

            {panelAbierto === "resumen" && (
              <>
                <div className="px-4 py-3 border-b flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/40">
                  {promedio === 0 ? <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    : promedio > 35 || promedio < 25 ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    : <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300 shrink-0" />}
                  <span className={cn("text-sm font-bold", estadoColor)}>{estadoLabel}</span>
                  <button onClick={() => setPanelAbierto(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Rutas activas", valor: nActivas.toString(), sub: `${nFijos}F ${nPreT}PT ${nCortes}C ${nUnificados}U` },
                      { label: "Choferes necesarios", valor: pkgTotal > 0 ? choferes.toString() : "—", sub: `@ ${targetPkg} pkg/chofer`, hl: true },
                      { label: "Prom. pkg/ruta", valor: promedio > 0 ? promedio.toFixed(1) : "—", sub: "target 25–35" },
                      { label: "Piso fijos", valor: nFijos.toString(), sub: "RF activos" },
                    ].map(({ label, valor, sub, hl }) => (
                      <div key={label} className="border rounded-lg p-3 text-center bg-background">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
                        <p className={cn("text-xl font-bold tabular-nums leading-tight mt-0.5", hl ? "text-blue-700 dark:text-blue-300" : "text-foreground")}>{valor}</p>
                        <p className="text-[10px] text-muted-foreground">{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Capacidad máxima — paquetes antes de superar 40P */}
                  {nActivas > 0 && pkgTotal > 0 && (
                    <div className={cn(
                      "border rounded-lg px-3 py-3 text-center",
                      margenHasta40 < 0 ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900" :
                      margenHasta35 < 200 ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900" :
                      "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900"
                    )}>
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                        Margen hasta 40P
                      </p>
                      <p className={cn("text-xl font-bold tabular-nums",
                        margenHasta40 < 0 ? "text-red-600 dark:text-red-300" :
                        margenHasta35 < 200 ? "text-amber-600 dark:text-amber-300" :
                        "text-emerald-600 dark:text-emerald-300")}>
                        {margenHasta40 < 0
                          ? `−${Math.abs(margenHasta40).toLocaleString("es-AR")} paq`
                          : `+${margenHasta40.toLocaleString("es-AR")} paq`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {margenHasta40 < 0
                          ? "⚠ Superado"
                          : `cap. ${capacidadMax40.toLocaleString("es-AR")} · ${pctBuffer}% libre`}
                      </p>
                    </div>
                  )}

                  {/* Barra de banda */}
                  {promedio > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Banda de carga</p>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>20</span><span>25</span><span className="font-bold text-green-600 dark:text-green-300">30</span><span>35</span><span>40</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative">
                        <div className="absolute h-full bg-green-200" style={{ left: "25%", width: "50%" }} />
                        <div className="absolute h-full w-1 bg-blue-700 rounded-full transition-all"
                          style={{ left: `${Math.min(100, Math.max(0, ((promedio - 20) / 20) * 100))}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {panelAbierto === "sugerencias" && (
              <>
                <div className="px-4 py-3 border-b flex items-center gap-2 bg-amber-50/50 dark:bg-amber-950/40">
                  <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" />
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-200">Sugerencias</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 tabular-nums">
                    {sugerencias.length}
                  </span>
                  <button onClick={() => setPanelAbierto(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 pt-2 pb-1">
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-300/70">Cortes y pre-turnos · sobrecarga sostenida · últimos 30 días</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-2">
                  {sugerencias.map(s => (
                    <div key={s.codigo} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2.5">
                        {s.tipoSugerido === "pre_turno"
                          ? <Sunrise className="h-4 w-4 text-violet-600 dark:text-violet-300 shrink-0 mt-0.5" />
                          : <Scissors className="h-4 w-4 text-orange-600 dark:text-orange-300 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold">
                            <span className="font-mono text-blue-700 dark:text-blue-300">{s.codigo}</span>
                            <span className="text-muted-foreground font-normal"> · {s.zona}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.motivo}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline"
                        className={cn("w-full h-7 gap-1 text-[10px]",
                          s.tipoSugerido === "pre_turno" ? "border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50" : "border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50")}
                        onClick={() => { abrirSugerencia(s); setPanelAbierto(null); }}>
                        <Plus className="h-3 w-3" />
                        {s.tipoSugerido === "pre_turno" ? "Crear pre-turno" : "Crear corte"}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Filtros ── */}
      <div className="px-5 py-2 border-b flex items-center gap-2 flex-wrap bg-background">
        <div className="flex gap-1">
          {["Oeste","Norte","Sur","CABA"].map(z => (
            <button key={z} onClick={() => setFiltroZona(filtroZona === z ? null : z)}
              className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
                filtroZona === z ? `${ZONA_COLOR[z]} text-white border-transparent` : "border-border text-muted-foreground hover:border-blue-400")}>
              {z}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {["fijo","pre_turno","corte","unificado"].map(t => (
            <button key={t} onClick={() => setFiltroTipo(filtroTipo === t ? null : t)}
              className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
                filtroTipo === t ? TIPO_BADGE[t] : "border-border text-muted-foreground hover:border-blue-400")}>
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        {/* Comodines — ver cuáles están habilitados */}
        <button onClick={() => setFiltroTipo(filtroTipo === "suplencia" ? null : "suplencia")}
          className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1",
            filtroTipo === "suplencia" ? TIPO_BADGE.suplencia : "border-border text-muted-foreground hover:border-blue-400")}
          title="Ver comodines habilitados">
          Comodines
          <span className={cn("font-bold tabular-nums px-1 rounded",
            filtroTipo === "suplencia" ? "bg-white/40 dark:bg-black/20" : "bg-muted")}>
            {comodinesActivos}/{comodinesTotal}
          </span>
        </button>
        <button onClick={() => setSoloActivos(v => !v)}
          className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
            soloActivos ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground")}>
          Solo activos
        </button>
        <button onClick={abrirPreArmado} disabled={guardando || cargandoSugerencia}
          className="text-[10px] px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1 disabled:opacity-50"
          title="Sugerir qué recorridos activar según el historial de este día de la semana">
          <Wand2 className="h-3 w-3" />
          Pre-armar día
        </button>
        <button onClick={limpiarRecorridos} disabled={guardando}
          className="text-[10px] px-2 py-0.5 rounded border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center gap-1 disabled:opacity-50"
          title="Deshabilitar todos los recorridos de todas las zonas">
          <Trash2 className="h-3 w-3" />
          Limpiar recorridos
        </button>
        <span className="text-[10px] text-muted-foreground ml-2">
          {nActivas}/{rutas.length} · {rutasFiltradas.length} visibles
        </span>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar código o nombre…"
            className="text-[10px] pl-6 pr-2 py-1 rounded border border-border bg-background w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <Button size="sm" variant="outline" onClick={abrirNuevo}
          className="ml-auto h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          Agregar
        </Button>
      </div>

      {/* ── Tabla de rutas ── */}
      <div className="flex-1 overflow-y-auto">
        {cargando ? (
          <div className="p-3 space-y-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton className="h-3.5 w-20 shrink-0" />
                <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${40 + (i % 5) * 10}%` }} />
                <Skeleton className="h-3.5 w-12 shrink-0 ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/40 dark:bg-muted/20 border-b backdrop-blur-sm">
              <tr>
                <th className="w-16 px-3 py-2.5 text-center text-muted-foreground font-medium">ON</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Código</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Nombre</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Zona</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Tipo</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Notas del día</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rutasFiltradas.map(r => {
                const modificada = editados[r.recorrido_id] !== undefined;
                return (
                  <tr key={r.recorrido_id}
                    className={cn("transition-colors",
                      !r.activo ? "opacity-40 bg-slate-50 dark:bg-slate-800/40" : "hover:bg-accent/20",
                      modificada && "bg-amber-50/40 dark:bg-amber-950/40"
                    )}>
                    {/* Toggle ON/OFF + Editar */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => toggleRuta(r.recorrido_id)}
                          className={cn(
                            "h-5 w-9 rounded-full transition-colors relative inline-flex items-center shrink-0",
                            r.activo ? "bg-blue-600" : "bg-slate-300"
                          )}>
                          <span className={cn(
                            "h-4 w-4 rounded-full bg-white shadow transition-transform",
                            r.activo ? "translate-x-4" : "translate-x-0.5"
                          )} />
                        </button>
                        <button onClick={() => abrirEditar(r)}
                          className="text-muted-foreground/40 hover:text-blue-600 transition-colors shrink-0"
                          title="Editar recorrido">
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", ZONA_COLOR[r.zona])} />
                        {r.codigo}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate">{r.nombre}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.zona}</td>
                    <td className="px-3 py-2">
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", TIPO_BADGE[r.tipo] ?? TIPO_BADGE.suplencia)}>
                        {TIPO_LABEL[r.tipo] ?? r.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.notas_dia ?? ""}
                        placeholder="ej: con Castelar, max 30…"
                        onChange={e => setNota(r.recorrido_id, e.target.value)}
                        className="w-full border-0 border-b border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-xs focus:outline-none focus:border-blue-400 py-0.5 placeholder:text-slate-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-2.5 border-t bg-slate-50 dark:bg-slate-800/40 flex items-center gap-3 flex-wrap text-xs">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          <strong className="text-foreground">{nActivas}</strong> rutas ·
          <strong className="text-blue-700 dark:text-blue-300 ml-1">{choferes}</strong> choferes ·
          prom. <strong className={estadoColor}>{promedio > 0 ? promedio.toFixed(1) : "—"}</strong> pkg/ruta
        </span>
        {hayEdits && (
          <Button size="sm" onClick={guardar} disabled={guardando}
            className="h-7 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-3 w-3" />
            {guardando ? "…" : "Guardar"}
          </Button>
        )}
        <Button size="sm" onClick={handleExportar}
          className="ml-auto h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold">
          <FileDown className="h-3.5 w-3.5" />
          Exportar PDF
        </Button>
      </div>

      {/* ── Modal agregar / editar recorrido ── */}
      {modalRuta && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-base">
                {modalRuta.modo === "nuevo" ? "Agregar recorrido" : "Editar recorrido"}
              </p>
              <button onClick={() => { setModalRuta(null); setDraftsNuevos([]); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalRuta.modo === "nuevo" && draftsNuevos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  En la cola ({draftsNuevos.length})
                </p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {draftsNuevos.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5">
                      <div className="text-xs truncate">
                        <span className="font-mono font-bold">{d.codigo}</span>
                        <span className="text-muted-foreground"> · {d.nombre}</span>
                      </div>
                      <button onClick={() => quitarDraft(i)} className="text-muted-foreground hover:text-red-600 shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* PASO 1: Zona + Tipo → genera código automáticamente */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    1. Zona
                  </label>
                  <select value={modalRuta.zona}
                    onChange={e => {
                      if (modalRuta.modo === "nuevo") {
                        actualizarCodigoAuto(e.target.value, modalRuta.tipo);
                      } else {
                        setModalRuta(m => m ? { ...m, zona: e.target.value } : m);
                      }
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {ZONAS_OPT.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    2. Tipo
                  </label>
                  <select value={modalRuta.tipo}
                    onChange={e => {
                      if (modalRuta.modo === "nuevo") {
                        actualizarCodigoAuto(modalRuta.zona, e.target.value);
                      } else {
                        setModalRuta(m => m ? { ...m, tipo: e.target.value } : m);
                      }
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {TIPOS_OPT.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* PASO 2: Código auto-generado (editable si necesitás) */}
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-2">
                  3. Código
                  {modalRuta.modo === "nuevo" && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-normal normal-case bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      Auto-generado · podés editarlo
                    </span>
                  )}
                </label>
                <input
                  type="text" value={modalRuta.codigo}
                  placeholder="ej: RF-OE-17"
                  onChange={e => setModalRuta(m => m ? { ...m, codigo: e.target.value.toUpperCase() } : m)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono font-bold tracking-wide"
                />
              </div>

              {/* PASO 3: Nombre */}
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">4. Nombre</label>
                <input
                  type="text" value={modalRuta.nombre}
                  placeholder="ej: Villa del Parque / Devoto"
                  onChange={e => setModalRuta(m => m ? { ...m, nombre: e.target.value } : m)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-background focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {modalRuta.modo === "nuevo" && (
              <Button variant="outline" className="w-full gap-1.5" onClick={agregarDraftALaLista} disabled={guardandoRuta}>
                <Plus className="h-3.5 w-3.5" /> Agregar a la lista y seguir cargando
              </Button>
            )}

            <div className="flex gap-2">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={guardarRuta} disabled={guardandoRuta}>
                {guardandoRuta
                  ? "Guardando…"
                  : modalRuta.modo === "nuevo"
                    ? (draftsNuevos.length > 0 || (modalRuta.codigo.trim() && modalRuta.nombre.trim())
                        ? `Guardar ${draftsNuevos.length + (modalRuta.codigo.trim() && modalRuta.nombre.trim() ? 1 : 0)} recorrido${draftsNuevos.length + (modalRuta.codigo.trim() && modalRuta.nombre.trim() ? 1 : 0) > 1 ? "s" : ""}`
                        : "Agregar")
                    : "Guardar cambios"}
              </Button>
              <Button variant="outline" onClick={() => { setModalRuta(null); setDraftsNuevos([]); }}>Cancelar</Button>
            </div>
            {modalRuta.modo === "editar" && (
              <Button variant="outline" disabled={guardandoRuta} onClick={eliminarRuta}
                className="w-full border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar recorrido
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Modal alerta inteligente ── */}
      {mostrarPreArmado && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-start gap-3 p-5 border-b">
              <Wand2 className="h-6 w-6 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base">Pre-armar la operación del día</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Sugerencia según cuántas veces se activó cada recorrido en los{" "}
                  {(() => { const d = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long" }); return d + "s"; })()}{" "}
                  anteriores. Los fijos van siempre; el resto si se usó en más de la mitad.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setMostrarPreArmado(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {cargandoSugerencia ? (
              <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Calculando sugerencia…</div>
            ) : (() => {
              const on = sugerencia.filter(s => s.sugerido);
              const variablesOn = on.filter(s => s.tipo !== "fijo");
              const sinDatos = sugerencia[0]?.total_dias_dow === 0;
              return (
                <>
                  <div className="px-5 py-3 border-b bg-muted/20 flex items-center gap-4 text-sm">
                    <span><span className="font-bold text-lg tabular-nums">{on.length}</span> a activar</span>
                    <span className="text-muted-foreground">{on.filter(s => s.tipo === "fijo").length} fijos + {variablesOn.length} variables</span>
                    {sinDatos && <span className="text-amber-600 dark:text-amber-300 text-xs ml-auto">⚠ Sin historial de este día — solo fijos</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Recorridos variables sugeridos</p>
                    {variablesOn.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ninguno supera el umbral — solo se activarán los fijos.</p>
                    ) : variablesOn.map(s => (
                      <div key={s.recorrido_id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                        <span className="font-mono font-semibold w-16 shrink-0">{s.codigo}</span>
                        <span className="truncate flex-1 text-muted-foreground">{s.nombre}</span>
                        <span className="tabular-nums text-[11px] shrink-0 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                          {s.freq_pct}% ({s.veces_activo}/{s.total_dias_dow})
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setMostrarPreArmado(false)}>Cancelar</Button>
                    <Button className="flex-1 gap-1.5" onClick={aplicarPreArmado}>
                      <Wand2 className="h-4 w-4" />Aplicar ({on.length})
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {mostrarAlerta && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              {promedio >= targetPkg - 5 && promedio <= targetPkg + 5
                ? <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-300 shrink-0 mt-0.5" />
                : <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              }
              <div>
                <p className="font-bold text-base">
                  {promedio >= targetPkg - 5 && promedio <= targetPkg + 5
                    ? "Operación balanceada — lista para exportar"
                    : "Promedio fuera del rango objetivo"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {pkgTotal > 0
                    ? `${pkgTotal.toLocaleString("es-AR")} paq / ${nActivas} rutas activas`
                    : "No hay paquetes asignados"}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center border rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rutas</p>
                <p className="text-xl font-bold">{nActivas}</p>
                <p className="text-[10px] text-muted-foreground">{nFijos}F · {nPreT}PT · {nCortes}C</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prom/ruta</p>
                <p className={`text-xl font-bold ${estadoColor}`}>{promedio > 0 ? promedio.toFixed(1) : "—"}</p>
                <p className="text-[10px] text-muted-foreground">target {targetPkg}±5</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Choferes</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{choferes}</p>
                <p className="text-[10px] text-muted-foreground">@{targetPkg} pkg</p>
              </div>
            </div>

            {/* Margen hasta 40P */}
            {nActivas > 0 && pkgTotal > 0 && (
              <div className={cn(
                "rounded-xl p-3 border text-center",
                margenHasta40 < 0 ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900" :
                margenHasta35 < 200 ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900" :
                "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900"
              )}>
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                  Capacidad restante antes de superar 40 pkg/ruta
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div>
                    <p className={cn("text-2xl font-black tabular-nums",
                      margenHasta40 < 0 ? "text-red-600 dark:text-red-300" :
                      margenHasta35 < 200 ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300")}>
                      {margenHasta40 < 0
                        ? `−${Math.abs(margenHasta40).toLocaleString("es-AR")}`
                        : `+${margenHasta40.toLocaleString("es-AR")}`}
                    </p>
                    <p className="text-xs text-muted-foreground">paquetes de margen</p>
                  </div>
                  <div className="text-left text-xs text-muted-foreground space-y-0.5">
                    <p>Actual: <b>{pkgTotal.toLocaleString("es-AR")}</b> paq</p>
                    <p>Capacidad máx (@40): <b>{capacidadMax40.toLocaleString("es-AR")}</b></p>
                    <p>Buffer disponible: <b className={margenHasta40 < 0 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}>{pctBuffer}%</b></p>
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje de alerta si fuera de rango */}
            {promedio > 0 && !(promedio >= targetPkg - 5 && promedio <= targetPkg + 5) && (
              <div className={`rounded-lg p-3 text-sm ${
                promedio > targetPkg + 5
                  ? "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
                  : "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300"
              }`}>
                {promedio > targetPkg + 5
                  ? `⚠ Sobrecarga: ~${promedio.toFixed(0)} pkg/ruta (máx aceptable: ${targetPkg+5}). Agregá más recorridos para reducir la carga.`
                  : `↓ Subutilizado: ~${promedio.toFixed(0)} pkg/ruta (mín aceptable: ${targetPkg-5}). Podés desactivar recorridos.`
                }
              </div>
            )}

            {promedio === 0 && pkgTotal === 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                ⚠ No hay paquetes asignados. El PDF se exportará sin cálculo de promedio.
              </p>
            )}

            {/* Avisos de posibles duplicados / combinaciones raras */}
            {advertenciasActivas.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 space-y-1.5 max-h-32 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wide font-bold text-red-700 dark:text-red-300">
                  Revisá esto antes de exportar
                </p>
                {advertenciasActivas.map((a, i) => (
                  <p key={i} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {a}
                  </p>
                ))}
              </div>
            )}

            {/* Checklist final: rutas activas agrupadas por zona */}
            <div className="rounded-lg border p-3 space-y-2 max-h-40 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">
                Checklist final — {nActivas} recorridos activos
              </p>
              {ZONAS_OPT.map(z => {
                const deZona = activas.filter(r => r.zona === z);
                if (deZona.length === 0) return null;
                return (
                  <div key={z}>
                    <p className="text-[10px] font-semibold flex items-center gap-1.5">
                      <span className={cn("inline-block w-2 h-2 rounded-full", ZONA_COLOR[z])} />
                      {z} ({deZona.length})
                    </p>
                    <ul className="text-xs text-muted-foreground pl-3.5 space-y-0.5">
                      {deZona.map(r => (
                        <li key={r.recorrido_id}>
                          <span className="font-mono font-semibold">{r.codigo}</span> — {r.nombre}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 font-semibold"
                onClick={() => { setMostrarAlerta(false); exportarPDF(); }}>
                {promedio >= targetPkg - 5 && promedio <= targetPkg + 5
                  ? "✓ Exportar PDF"
                  : "Acepto el riesgo → Exportar igual"}
              </Button>
              {promedio > 0 && !(promedio >= targetPkg - 5 && promedio <= targetPkg + 5) && (
                <Button variant="outline" className="w-full"
                  onClick={() => setMostrarAlerta(false)}>
                  {promedio > targetPkg + 5
                    ? "Seguir agregando recorridos"
                    : "Seguir ajustando recorridos"}
                </Button>
              )}
              <button className="text-xs text-muted-foreground hover:text-foreground py-1"
                onClick={() => setMostrarAlerta(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
