"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Save, RefreshCw, ChevronLeft, ChevronRight,
  FileDown, AlertTriangle, CheckCircle, Users, Clock,
  Plus, Pencil, X, Lightbulb, Scissors, Sunrise,
} from "lucide-react";
import {
  getOperacionDia, inicializarOperacionDia,
  guardarOperacionBulk,
} from "@/app/actions/operacion";
import { getAnalisisRecorridos } from "@/app/actions/operaciones-diarias";
import type { AnalisisRecorrido } from "@/app/actions/operaciones-diarias";
import { crearRecorrido, actualizarCamposRecorrido, getSiguienteCodigo } from "@/app/actions/recorridos";
import { ZONA_COLOR as ZONA_HEX } from "@/lib/estados";
import { Skeleton } from "@/components/ui/skeleton";
import type { OperacionRuta } from "@/app/actions/operacion";
import { jsPDF } from "jspdf";

const ZONAS_OPT = ["Oeste", "Norte", "Sur", "CABA"] as const;
const TIPOS_OPT = [
  { valor: "fijo",      label: "Fijo" },
  { valor: "pre_turno", label: "Pre-Turno" },
  { valor: "corte",     label: "Corte" },
  { valor: "suplencia", label: "Comodín" },
] as const;
const COLORES_ZONA = ZONA_HEX;

function hoy() { return new Date().toISOString().slice(0, 10); }
function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
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
};
const TIPO_LABEL: Record<string, string> = {
  fijo: "Fijo", pre_turno: "Pre-T", corte: "Corte", suplencia: "Cmd",
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
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  // Debounce para autoguardado al cambiar rutas ON/OFF
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modal agregar/editar recorrido ───────────────────────────────────────
  const [modalRuta, setModalRuta] = useState<{
    modo: "nuevo" | "editar";
    id?: string;
    codigo: string; nombre: string; zona: string; tipo: string;
  } | null>(null);
  const [guardandoRuta, setGuardandoRuta] = useState(false);

  async function abrirNuevo() {
    const res = await getSiguienteCodigo("Oeste", "fijo");
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

  async function guardarRuta() {
    if (!modalRuta) return;
    if (!modalRuta.codigo.trim() || !modalRuta.nombre.trim()) {
      toast.error("Código y nombre son obligatorios"); return;
    }
    setGuardandoRuta(true);
    try {
      if (modalRuta.modo === "nuevo") {
        const res = await crearRecorrido({
          codigo: modalRuta.codigo.trim().toUpperCase(),
          nombre: modalRuta.nombre.trim(),
          zona: modalRuta.zona as "Oeste" | "Norte" | "Sur" | "CABA",
          tipo: modalRuta.tipo as "fijo" | "suplencia" | "corte" | "pre_turno",
          color: COLORES_ZONA[modalRuta.zona] ?? "#6b7280",
        });
        if (!res.ok) { toast.error("Error al crear recorrido", { description: res.error }); return; }
        toast.success(`Recorrido ${modalRuta.codigo.toUpperCase()} creado`);
      } else {
        if (!modalRuta.id) return;
        const res = await actualizarCamposRecorrido(modalRuta.id, {
          codigo: modalRuta.codigo.trim().toUpperCase(),
          nombre: modalRuta.nombre.trim(),
          zona: modalRuta.zona as "Oeste" | "Norte" | "Sur" | "CABA",
          tipo: modalRuta.tipo as "fijo" | "suplencia" | "corte" | "pre_turno",
          color: COLORES_ZONA[modalRuta.zona] ?? "#6b7280",
        });
        if (!res.ok) { toast.error("Error al actualizar", { description: res.error }); return; }
        toast.success(`Recorrido actualizado`);
      }
      setModalRuta(null);
      // Reinicializar y recargar para que el nuevo/editado aparezca
      await inicializarOperacionDia(fecha);
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
      const res = await getOperacionDia(f);
      if (res.ok && res.data && res.data.length > 0) {
        setRutas(res.data);
        setEditados({});
      } else if (!res.ok) {
        toast.error("Error al cargar operación del día", { description: res.error });
      }
    } catch (e) {
      toast.error("Error al cargar rutas", { description: String(e) });
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);

  // Análisis histórico para sugerencias de cortes / pre-turnos
  useEffect(() => {
    getAnalisisRecorridos(30).then(res => {
      if (res.ok && res.data) setAnalisisHist(res.data);
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
    setModalRuta({ modo: "nuevo", codigo: "", nombre: `Corte de ${s.codigo} — ${s.nombre}`.slice(0, 80), zona: s.zona, tipo: s.tipoSugerido });
    actualizarCodigoAuto(s.zona, s.tipoSugerido);
  }

  // Filtrado
  const rutasFiltradas = rutasConEdits.filter(r => {
    if (filtroZona && r.zona !== filtroZona) return false;
    if (filtroTipo && r.tipo !== filtroTipo) return false;
    if (soloActivos && !r.activo) return false;
    return true;
  });

  // Cálculos en tiempo real
  const activas = rutasConEdits.filter(r => r.activo);
  const nActivas = activas.length;
  const nFijos = activas.filter(r => r.tipo === "fijo").length;
  const nPreT = activas.filter(r => r.tipo === "pre_turno").length;
  const nCortes = activas.filter(r => r.tipo === "corte").length;
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

  // Toggle activo/inactivo con autoguardado debounceado (2s)
  function toggleRuta(recorrido_id: string) {
    setEditados(prev => {
      const ruta = rutasConEdits.find(r => r.recorrido_id === recorrido_id)!;
      const siguiente = { ...prev, [recorrido_id]: { ...prev[recorrido_id], activo: !ruta.activo } };

      // Programar autoguardado 2 segundos después de la última acción
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(async () => {
        const editadosSnap = siguiente;
        const rutasActualizadas = rutas.map(r => ({ ...r, ...editadosSnap[r.recorrido_id] }));
        const payload = rutasActualizadas.map(r => ({
          recorrido_id: r.recorrido_id,
          activo: r.activo,
          notas_dia: r.notas_dia ?? null,
          paquetes_asignados: r.paquetes_asignados ?? 0,
        }));
        try {
          const res = await guardarOperacionBulk(fecha, payload);
          if (res.ok) {
            setEditados({});
            await cargar(fecha);
          }
        } catch { /* silencioso */ }
      }, 2000);

      return siguiente;
    });
  }

  // Editar nota
  function setNota(recorrido_id: string, nota: string) {
    setEditados(prev => ({ ...prev, [recorrido_id]: { ...prev[recorrido_id], notas_dia: nota } }));
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

  // Manejar clic exportar: mostrar alerta si fuera de rango
  function handleExportar() {
    setMostrarAlerta(true);
  }

  // Exportar PDF — diseño por zonas, solo activos
  async function exportarPDF() {
    try {
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
        { label: "RUTAS ACTIVAS", valor: nActivas.toString(), sub: `${nFijos}F · ${nPreT}PT · ${nCortes}C`, r: 37, g: 99, b: 235 },
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
    <div className="flex flex-col h-full" ref={reportRef}>
      {/* ── Header / Controls ── */}
      <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap bg-background">
        {/* Fecha */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setFecha(addDias(fecha, -1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="border rounded px-2 py-1 text-xs h-7 bg-background" />
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={fecha >= addDias(hoy(), 3)}
            onClick={() => setFecha(addDias(fecha, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
          {fmtFecha(fecha)}
        </span>
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

      {/* ── Calculadora en tiempo real ── */}
      <div className="px-5 py-3 border-b bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-4 flex-wrap">
        {/* Estado */}
        <div className="flex items-center gap-2">
          {promedio === 0 ? <Clock className="h-5 w-5 text-muted-foreground" />
            : promedio > 35 || promedio < 25 ? <AlertTriangle className="h-5 w-5 text-amber-500" />
            : <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />}
          <span className={cn("text-sm font-bold", estadoColor)}>{estadoLabel}</span>
        </div>

        <div className="h-5 w-px bg-border" />

        {[
          { label: "Rutas activas", valor: nActivas.toString(), sub: `${nFijos}F ${nPreT}PT ${nCortes}C` },
          { label: "Choferes necesarios", valor: pkgTotal > 0 ? choferes.toString() : "—", sub: `@ ${targetPkg} pkg/chofer`, hl: true },
          { label: "Prom. pkg/ruta", valor: promedio > 0 ? promedio.toFixed(1) : "—", sub: "target 25–35" },
          { label: "Piso fijos", valor: nFijos.toString(), sub: "RF activos" },
        ].map(({ label, valor, sub, hl }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
            <p className={cn("text-lg font-bold tabular-nums leading-tight", hl ? "text-blue-700 dark:text-blue-300" : "text-foreground")}>{valor}</p>
            <p className="text-[9px] text-muted-foreground">{sub}</p>
          </div>
        ))}

        {/* Capacidad máxima — paquetes antes de superar 40P */}
        {nActivas > 0 && pkgTotal > 0 && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className={cn(
              "border rounded-lg px-3 py-2 text-center min-w-[110px]",
              margenHasta40 < 0 ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900" :
              margenHasta35 < 200 ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900" :
              "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900"
            )}>
              <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">
                Margen hasta 40P
              </p>
              <p className={cn("text-base font-bold tabular-nums",
                margenHasta40 < 0 ? "text-red-600 dark:text-red-300" :
                margenHasta35 < 200 ? "text-amber-600 dark:text-amber-300" :
                "text-emerald-600 dark:text-emerald-300")}>
                {margenHasta40 < 0
                  ? `−${Math.abs(margenHasta40).toLocaleString("es-AR")} paq`
                  : `+${margenHasta40.toLocaleString("es-AR")} paq`}
              </p>
              <p className="text-[9px] text-muted-foreground">
                {margenHasta40 < 0
                  ? "⚠ Superado"
                  : `cap. ${capacidadMax40.toLocaleString("es-AR")} · ${pctBuffer}% libre`}
              </p>
            </div>
          </>
        )}

        {/* Barra de banda */}
        {promedio > 0 && (
          <div className="flex-1 min-w-[120px]">
            <div className="flex justify-between text-[8px] text-muted-foreground mb-0.5">
              <span>20</span><span>25</span><span className="font-bold text-green-600 dark:text-green-300">30</span><span>35</span><span>40</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative">
              {/* Zona verde 25-35 */}
              <div className="absolute h-full bg-green-200" style={{ left: "25%", width: "50%" }} />
              {/* Indicador */}
              <div className="absolute h-full w-1 bg-blue-700 rounded-full transition-all"
                style={{ left: `${Math.min(100, Math.max(0, ((promedio - 20) / 20) * 100))}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Sugerencias inteligentes (cortes / pre-turnos) ── */}
      {sugerencias.length > 0 && (
        <div className="border-b bg-amber-50/40 dark:bg-amber-950/40">
          <button onClick={() => setMostrarSugerencias(v => !v)}
            className="w-full px-5 py-2 flex items-center gap-2 text-left hover:bg-amber-50/70 dark:hover:bg-amber-950/60 transition-colors">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" />
            <span className="text-xs font-bold text-amber-800 dark:text-amber-200">Sugerencias de cortes y pre-turnos</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 tabular-nums">
              {sugerencias.length}
            </span>
            <span className="hidden sm:inline text-[10px] text-amber-600/80 dark:text-amber-300/70">sobrecarga sostenida · últimos 30 días</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              {mostrarSugerencias ? "Ocultar" : "Ver"}
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", mostrarSugerencias && "rotate-90")} />
            </span>
          </button>
          {mostrarSugerencias && (
            <div className="px-5 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[38vh] overflow-y-auto animate-fade-up">
              {sugerencias.map(s => (
                <div key={s.codigo} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-xl p-3 flex items-start gap-2.5 hover-lift">
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
                  <Button size="sm" variant="outline"
                    className={cn("h-7 gap-1 text-[10px] shrink-0",
                      s.tipoSugerido === "pre_turno" ? "border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50" : "border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50")}
                    onClick={() => abrirSugerencia(s)}>
                    <Plus className="h-3 w-3" />
                    {s.tipoSugerido === "pre_turno" ? "Crear pre-turno" : "Crear corte"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
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
          {["fijo","pre_turno","corte"].map(t => (
            <button key={t} onClick={() => setFiltroTipo(filtroTipo === t ? null : t)}
              className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
                filtroTipo === t ? TIPO_BADGE[t] : "border-border text-muted-foreground hover:border-blue-400")}>
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        <button onClick={() => setSoloActivos(v => !v)}
          className={cn("text-[10px] px-2 py-0.5 rounded border transition-colors",
            soloActivos ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground")}>
          Solo activos
        </button>
        <span className="text-[10px] text-muted-foreground ml-2">
          {nActivas}/{rutas.length} · {rutasFiltradas.length} visibles
        </span>
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
                <th className="w-10 px-3 py-2.5 text-center text-muted-foreground font-medium">ON</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Código</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Nombre</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Zona</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Tipo</th>
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Notas del día</th>
                <th className="w-8 px-2 py-2.5" />
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
                    {/* Toggle ON/OFF */}
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => toggleRuta(r.recorrido_id)}
                        className={cn(
                          "h-5 w-9 rounded-full transition-colors relative inline-flex items-center",
                          r.activo ? "bg-blue-600" : "bg-slate-300"
                        )}>
                        <span className={cn(
                          "h-4 w-4 rounded-full bg-white shadow transition-transform",
                          r.activo ? "translate-x-4" : "translate-x-0.5"
                        )} />
                      </button>
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
                    {/* Editar recorrido */}
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => abrirEditar(r)}
                        className="text-muted-foreground/40 hover:text-blue-600 transition-colors"
                        title="Editar recorrido">
                        <Pencil className="h-3 w-3" />
                      </button>
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
              <button onClick={() => setModalRuta(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

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
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-300 font-normal normal-case bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
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

            <div className="flex gap-2">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={guardarRuta} disabled={guardandoRuta}>
                {guardandoRuta ? "Guardando…" : modalRuta.modo === "nuevo" ? "Agregar" : "Guardar cambios"}
              </Button>
              <Button variant="outline" onClick={() => setModalRuta(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal alerta inteligente ── */}
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
                <p className="text-[9px] text-muted-foreground">{nFijos}F · {nPreT}PT · {nCortes}C</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prom/ruta</p>
                <p className={`text-xl font-bold ${estadoColor}`}>{promedio > 0 ? promedio.toFixed(1) : "—"}</p>
                <p className="text-[9px] text-muted-foreground">target {targetPkg}±5</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Choferes</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{choferes}</p>
                <p className="text-[9px] text-muted-foreground">@{targetPkg} pkg</p>
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
