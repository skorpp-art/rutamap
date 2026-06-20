"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileDown, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, CalendarRange } from "lucide-react";
import { getHistorialDiasV2 } from "@/app/actions/operaciones-diarias";
import type { HistorialDiaV2 } from "@/app/actions/operaciones-diarias";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const SEMANA_LABELS: Record<number, string> = { 1: "Tarjetas", 2: "Sueldos", 3: "Baja", 4: "Normal", 5: "Cierre mes" };
const DIA_ORDEN = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function mesKey(fecha: string) {
  return fecha.slice(0, 7); // YYYY-MM
}

interface Resumen {
  mesLabel: string;
  dias: HistorialDiaV2[];
  diasOperados: number;
  totalPaquetes: number;
  promDiario: number;
  promPorRuta: number;
  promChoferes: number | null;
  aciertoProm: number | null;
  diasConAlerta: number;
  mejorDia: HistorialDiaV2 | null;
  peorDia: HistorialDiaV2 | null;
  porSemana: { semana: number; total: number; dias: number; prom: number; promProyectado: number | null; aciertoProm: number | null }[];
  porDiaSemana: { dia: string; total: number; dias: number; prom: number; promRuta: number; promProyectado: number | null; aciertoProm: number | null }[];
}

function resumirMes(dias: HistorialDiaV2[]): Resumen | null {
  if (dias.length === 0) return null;
  const operados = dias.filter((d) => d.total_paquetes > 0);
  const totalPaquetes = operados.reduce((a, d) => a + d.total_paquetes, 0);
  const promDiario = operados.length > 0 ? totalPaquetes / operados.length : 0;
  const promPorRuta = operados.length > 0
    ? operados.reduce((a, d) => a + Number(d.prom_por_ruta || 0), 0) / operados.length
    : 0;
  const conChoferes = operados.filter((d) => d.choferes_real != null);
  const promChoferes = conChoferes.length > 0
    ? conChoferes.reduce((a, d) => a + (d.choferes_real ?? 0), 0) / conChoferes.length
    : null;
  const conAcierto = operados.filter((d) => d.acierto_pct != null);
  const aciertoProm = conAcierto.length > 0
    ? conAcierto.reduce((a, d) => a + (d.acierto_pct ?? 0), 0) / conAcierto.length
    : null;
  const diasConAlerta = operados.filter((d) => d.rutas_en_alerta > 0).length;
  const mejorDia = operados.length > 0
    ? operados.reduce((a, d) => (d.total_paquetes > a.total_paquetes ? d : a))
    : null;
  const peorDia = operados.length > 0
    ? operados.reduce((a, d) => (d.total_paquetes < a.total_paquetes ? d : a))
    : null;
  const porSemanaMap = new Map<number, { total: number; dias: number; sumaProy: number; nProy: number; sumaAcierto: number; nAcierto: number }>();
  operados.forEach((d) => {
    const cur = porSemanaMap.get(d.semana_mes) ?? { total: 0, dias: 0, sumaProy: 0, nProy: 0, sumaAcierto: 0, nAcierto: 0 };
    cur.total += d.total_paquetes;
    cur.dias += 1;
    if (d.proyectado_pkg != null) { cur.sumaProy += d.proyectado_pkg; cur.nProy += 1; }
    if (d.acierto_pct != null) { cur.sumaAcierto += d.acierto_pct; cur.nAcierto += 1; }
    porSemanaMap.set(d.semana_mes, cur);
  });
  const porSemana = Array.from(porSemanaMap.entries())
    .map(([semana, v]) => ({
      semana, total: v.total, dias: v.dias, prom: v.dias > 0 ? v.total / v.dias : 0,
      promProyectado: v.nProy > 0 ? v.sumaProy / v.nProy : null,
      aciertoProm: v.nAcierto > 0 ? v.sumaAcierto / v.nAcierto : null,
    }))
    .sort((a, b) => a.semana - b.semana);

  const porDiaSemanaMap = new Map<string, { total: number; dias: number; sumaProm: number; sumaProy: number; nProy: number; sumaAcierto: number; nAcierto: number }>();
  operados.forEach((d) => {
    const cur = porDiaSemanaMap.get(d.dia_semana) ?? { total: 0, dias: 0, sumaProm: 0, sumaProy: 0, nProy: 0, sumaAcierto: 0, nAcierto: 0 };
    cur.total += d.total_paquetes;
    cur.dias += 1;
    cur.sumaProm += Number(d.prom_por_ruta || 0);
    if (d.proyectado_pkg != null) { cur.sumaProy += d.proyectado_pkg; cur.nProy += 1; }
    if (d.acierto_pct != null) { cur.sumaAcierto += d.acierto_pct; cur.nAcierto += 1; }
    porDiaSemanaMap.set(d.dia_semana, cur);
  });
  const porDiaSemana = Array.from(porDiaSemanaMap.entries())
    .map(([dia, v]) => ({
      dia, total: v.total, dias: v.dias,
      prom: v.dias > 0 ? v.total / v.dias : 0,
      promRuta: v.dias > 0 ? v.sumaProm / v.dias : 0,
      promProyectado: v.nProy > 0 ? v.sumaProy / v.nProy : null,
      aciertoProm: v.nAcierto > 0 ? v.sumaAcierto / v.nAcierto : null,
    }))
    .sort((a, b) => DIA_ORDEN.indexOf(a.dia) - DIA_ORDEN.indexOf(b.dia));

  const f = dias[0].fecha;
  const [y, m] = f.split("-");
  const mesLabel = `${MESES[Number(m) - 1]} ${y}`;

  return {
    mesLabel, dias, diasOperados: operados.length, totalPaquetes, promDiario, promPorRuta,
    promChoferes, aciertoProm, diasConAlerta, mejorDia, peorDia, porSemana, porDiaSemana,
  };
}

export function InformeMensual() {
  const [historial, setHistorial] = useState<HistorialDiaV2[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getHistorialDiasV2(180);
      if (res.ok && res.data) {
        setHistorial(res.data);
        if (!mesSeleccionado && res.data.length > 0) {
          setMesSeleccionado(mesKey(res.data[0].fecha));
        }
      } else {
        toast.error("Error al cargar historial", { description: res.error });
      }
    } finally { setCargando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mesesDisponibles = useMemo(() => {
    const set = new Set(historial.map((d) => mesKey(d.fecha)));
    return Array.from(set).sort().reverse();
  }, [historial]);

  const resumen = useMemo(() => {
    if (!mesSeleccionado) return null;
    const dias = historial.filter((d) => mesKey(d.fecha) === mesSeleccionado);
    return resumirMes(dias);
  }, [historial, mesSeleccionado]);

  const resumenAnterior = useMemo(() => {
    if (!mesSeleccionado) return null;
    const idx = mesesDisponibles.indexOf(mesSeleccionado);
    const anteriorKey = mesesDisponibles[idx + 1];
    if (!anteriorKey) return null;
    const dias = historial.filter((d) => mesKey(d.fecha) === anteriorKey);
    return resumirMes(dias);
  }, [historial, mesSeleccionado, mesesDisponibles]);

  const diasDelDiaSeleccionado = useMemo(() => {
    if (!resumen || !diaSeleccionado) return [];
    return resumen.dias
      .filter((d) => d.total_paquetes > 0 && d.dia_semana === diaSeleccionado)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [resumen, diaSeleccionado]);

  const vsAnteriorPct = resumen && resumenAnterior && resumenAnterior.totalPaquetes > 0
    ? Math.round(((resumen.totalPaquetes - resumenAnterior.totalPaquetes) / resumenAnterior.totalPaquetes) * 1000) / 10
    : null;

  async function exportarPDF() {
    if (!resumen) return;
    setExportando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const PW = pdf.internal.pageSize.getWidth();
      const M = 14;

      // Header
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, PW, 32, "F");
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 30, PW, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("LOGÍSTICA HOGAREÑO", M, 14);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(148, 163, 184);
      pdf.text("INFORME MENSUAL DE OPERACIONES", M, 22);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text(resumen.mesLabel.toUpperCase(), PW - M, 18, { align: "right" });

      let y = 42;

      // Cards de resumen
      const cards = [
        { label: "DÍAS OPERADOS", valor: resumen.diasOperados.toString(), sub: `de ${resumen.dias.length} del mes`, r: 37, g: 99, b: 235 },
        { label: "TOTAL PAQUETES", valor: resumen.totalPaquetes.toLocaleString("es-AR"), sub: vsAnteriorPct != null ? `${vsAnteriorPct > 0 ? "+" : ""}${vsAnteriorPct}% vs mes ant.` : "sin comparativa", r: 22, g: 163, b: 74 },
        { label: "PROM. DIARIO", valor: Math.round(resumen.promDiario).toLocaleString("es-AR"), sub: "paquetes/día operado", r: 124, g: 58, b: 237 },
        { label: "PROM/RUTA", valor: resumen.promPorRuta > 0 ? resumen.promPorRuta.toFixed(1) : "—", sub: resumen.aciertoProm != null ? `acierto ${Math.round(resumen.aciertoProm)}%` : "sin dato de acierto", r: 217, g: 119, b: 6 },
      ];
      const cW = (PW - M * 2 - 6) / 2;
      const cH = 22;
      cards.forEach((c, i) => {
        const cx = M + (i % 2) * (cW + 6);
        const cy = y + Math.floor(i / 2) * (cH + 4);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(cx, cy, cW, cH, 2, 2, "F");
        pdf.setFillColor(c.r, c.g, c.b);
        pdf.roundedRect(cx, cy, 2, cH, 1, 1, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(c.label, cx + 6, cy + 7);
        pdf.setFontSize(15);
        pdf.setTextColor(c.r, c.g, c.b);
        pdf.text(c.valor, cx + 6, cy + 16);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(c.sub, cx + 6, cy + 20.5);
      });
      y += 2 * (cH + 4) + 6;

      // Mejor / peor día
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text("DESTACADOS DEL MES", M, y);
      y += 6;
      const destacados = [
        { label: "Mejor día", d: resumen.mejorDia, r: 22, g: 163, b: 74 },
        { label: "Día más bajo", d: resumen.peorDia, r: 220, g: 38, b: 38 },
      ];
      destacados.forEach((x) => {
        if (!x.d) return;
        pdf.setFillColor(x.r, x.g, x.b);
        pdf.circle(M + 1.5, y - 1.2, 1.5, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        const fecha = new Date(x.d.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
        pdf.text(`${x.label}: ${fecha} — ${x.d.total_paquetes.toLocaleString("es-AR")} paquetes (${x.d.rutas_activas} rutas)`, M + 6, y);
        y += 6;
      });
      y += 3;

      if (resumen.diasConAlerta > 0) {
        pdf.setFillColor(254, 243, 199);
        pdf.roundedRect(M, y, PW - M * 2, 9, 1.5, 1.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(146, 64, 14);
        pdf.text(`⚠ ${resumen.diasConAlerta} día(s) con rutas en alerta (>35 paq/ruta)`, M + 4, y + 6);
        y += 14;
      } else {
        y += 4;
      }

      // Desglose por semana del mes
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text("DESGLOSE POR SEMANA DEL MES", M, y);
      y += 4;
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(M, y, PW - M * 2, 6, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text("SEMANA", M + 2, y + 4);
      pdf.text("DÍAS", M + 55, y + 4);
      pdf.text("REAL/DÍA", M + 75, y + 4);
      pdf.text("PRONOST.", M + 105, y + 4);
      pdf.text("ACIERTO", M + 135, y + 4);
      y += 6;
      resumen.porSemana.forEach((s) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(30, 41, 59);
        pdf.text(`Semana ${s.semana} (${SEMANA_LABELS[s.semana] ?? ""})`, M + 2, y + 5);
        pdf.text(s.dias.toString(), M + 55, y + 5);
        pdf.text(Math.round(s.prom).toLocaleString("es-AR"), M + 75, y + 5);
        pdf.text(s.promProyectado != null ? Math.round(s.promProyectado).toLocaleString("es-AR") : "—", M + 105, y + 5);
        pdf.text(s.aciertoProm != null ? `${Math.round(s.aciertoProm)}%` : "—", M + 135, y + 5);
        pdf.setDrawColor(241, 245, 249);
        pdf.line(M, y + 7, PW - M, y + 7);
        y += 7;
      });
      y += 8;

      // Desglose por día de la semana
      if (y + 12 + resumen.porDiaSemana.length * 7 > 280) { pdf.addPage(); y = 20; }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text("DESGLOSE POR DÍA DE LA SEMANA", M, y);
      y += 4;
      pdf.setFillColor(241, 245, 249);
      pdf.rect(M, y, PW - M * 2, 6, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text("DÍA", M + 2, y + 4);
      pdf.text("DÍAS", M + 40, y + 4);
      pdf.text("REAL/DÍA", M + 58, y + 4);
      pdf.text("PRONOST.", M + 88, y + 4);
      pdf.text("ACIERTO", M + 118, y + 4);
      pdf.text("PROM/RUTA", M + 145, y + 4);
      y += 6;
      resumen.porDiaSemana.forEach((d) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(30, 41, 59);
        pdf.text(d.dia, M + 2, y + 5);
        pdf.text(d.dias.toString(), M + 40, y + 5);
        pdf.text(Math.round(d.prom).toLocaleString("es-AR"), M + 58, y + 5);
        pdf.text(d.promProyectado != null ? Math.round(d.promProyectado).toLocaleString("es-AR") : "—", M + 88, y + 5);
        pdf.text(d.aciertoProm != null ? `${Math.round(d.aciertoProm)}%` : "—", M + 118, y + 5);
        pdf.text(d.promRuta > 0 ? d.promRuta.toFixed(1) : "—", M + 145, y + 5);
        pdf.setDrawColor(241, 245, 249);
        pdf.line(M, y + 7, PW - M, y + 7);
        y += 7;
      });

      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Generado el ${new Date().toLocaleDateString("es-AR")} — RutaMap`, M, 290);

      pdf.save(`informe-mensual-${mesSeleccionado}.pdf`);
      toast.success("Informe exportado");
    } catch (e) {
      toast.error("Error al exportar PDF", { description: String(e) });
    } finally { setExportando(false); }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          <div>
            <h2 className="text-sm font-bold">Informe del mes</h2>
            <p className="text-xs text-muted-foreground">
              Resumen de paquetes, rutas y performance del mes — exportable a PDF.
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {mesesDisponibles.length > 0 && (
            <select
              value={mesSeleccionado ?? ""}
              onChange={(e) => { setMesSeleccionado(e.target.value); setDiaSeleccionado(null); }}
              className="h-8 text-xs border rounded-md px-2 bg-background"
            >
              {mesesDisponibles.map((m) => {
                const [y, mo] = m.split("-");
                return <option key={m} value={m}>{MESES[Number(mo) - 1]} {y}</option>;
              })}
            </select>
          )}
          <Button
            size="sm" className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700"
            onClick={exportarPDF} disabled={exportando || !resumen}
          >
            <FileDown className="h-3.5 w-3.5" />
            {exportando ? "Generando…" : "Exportar PDF"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cargar} disabled={cargando}>
            <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
          </Button>
        </div>
      </div>

      {cargando ? (
        <SkeletonTable rows={6} />
      ) : !resumen ? (
        <EmptyState
          icon={CalendarRange}
          title="Sin datos todavía"
          description="Importá el Excel de clientes y/o operaciones para empezar a generar informes mensuales."
        />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Días operados" valor={`${resumen.diasOperados}`} sub={`de ${resumen.dias.length} del mes`} color="text-blue-700 dark:text-blue-300" />
            <Kpi label="Total paquetes" valor={resumen.totalPaquetes.toLocaleString("es-AR")}
              sub={
                vsAnteriorPct != null
                  ? <span className="flex items-center gap-0.5">
                      <DeltaIcon pct={vsAnteriorPct} />{`${vsAnteriorPct > 0 ? "+" : ""}${vsAnteriorPct}% vs mes ant.`}
                    </span>
                  : "sin comparativa"
              }
              color="text-emerald-700 dark:text-emerald-300" />
            <Kpi label="Prom. diario" valor={Math.round(resumen.promDiario).toLocaleString("es-AR")} sub="paq/día operado" color="text-violet-700 dark:text-violet-300" />
            <Kpi label="Prom/ruta" valor={resumen.promPorRuta > 0 ? resumen.promPorRuta.toFixed(1) : "—"}
              sub={resumen.aciertoProm != null ? `acierto ${Math.round(resumen.aciertoProm)}%` : "sin dato"} color="text-amber-700 dark:text-amber-300" />
          </div>

          {/* Destacados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resumen.mejorDia && (
              <div className="border rounded-xl p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Mejor día</p>
                <p className="text-sm font-bold mt-1">
                  {new Date(resumen.mejorDia.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}
                </p>
                <p className="text-xs text-muted-foreground">{resumen.mejorDia.total_paquetes.toLocaleString("es-AR")} paquetes · {resumen.mejorDia.rutas_activas} rutas</p>
              </div>
            )}
            {resumen.peorDia && (
              <div className="border rounded-xl p-3 bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 dark:text-red-300">Día más bajo</p>
                <p className="text-sm font-bold mt-1">
                  {new Date(resumen.peorDia.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}
                </p>
                <p className="text-xs text-muted-foreground">{resumen.peorDia.total_paquetes.toLocaleString("es-AR")} paquetes · {resumen.peorDia.rutas_activas} rutas</p>
              </div>
            )}
          </div>

          {resumen.diasConAlerta > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {resumen.diasConAlerta} día(s) con rutas en alerta (&gt;35 paq/ruta) este mes.
            </div>
          )}

          {/* Desglose por semana */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Semana</th>
                  <th className="text-right px-3 py-2 font-semibold">Días</th>
                  <th className="text-right px-3 py-2 font-semibold">Total paq.</th>
                  <th className="text-right px-3 py-2 font-semibold">Real (prom/día)</th>
                  <th className="text-right px-3 py-2 font-semibold">Pronosticado</th>
                  <th className="text-right px-3 py-2 font-semibold">Acierto</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porSemana.map((s) => (
                  <tr key={s.semana} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">Semana {s.semana} <span className="text-muted-foreground">· {SEMANA_LABELS[s.semana]}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.dias}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{s.total.toLocaleString("es-AR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(s.prom).toLocaleString("es-AR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {s.promProyectado != null ? Math.round(s.promProyectado).toLocaleString("es-AR") : "—"}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums font-semibold",
                      s.aciertoProm == null ? "text-muted-foreground/40" :
                      s.aciertoProm >= 90 ? "text-emerald-600 dark:text-emerald-300" :
                      s.aciertoProm >= 75 ? "text-amber-600 dark:text-amber-300" : "text-red-500")}>
                      {s.aciertoProm != null ? `${Math.round(s.aciertoProm)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Por día de la semana */}
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2">
              Por día de la semana <span className="font-normal">— clic en un día para ver el detalle de fechas</span>
            </p>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Día</th>
                    <th className="text-right px-3 py-2 font-semibold">Días</th>
                    <th className="text-right px-3 py-2 font-semibold">Real (prom/día)</th>
                    <th className="text-right px-3 py-2 font-semibold">Pronosticado</th>
                    <th className="text-right px-3 py-2 font-semibold">Acierto</th>
                    <th className="text-right px-3 py-2 font-semibold">Prom/ruta</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.porDiaSemana.map((d) => (
                    <tr key={d.dia}
                      onClick={() => setDiaSeleccionado((prev) => prev === d.dia ? null : d.dia)}
                      className={cn("border-b last:border-0 cursor-pointer transition-colors hover:bg-accent/30",
                        diaSeleccionado === d.dia && "bg-blue-50/60 dark:bg-blue-950/40")}>
                      <td className="px-3 py-2 font-medium">{d.dia}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.dias}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{Math.round(d.prom).toLocaleString("es-AR")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {d.promProyectado != null ? Math.round(d.promProyectado).toLocaleString("es-AR") : "—"}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-semibold",
                        d.aciertoProm == null ? "text-muted-foreground/40" :
                        d.aciertoProm >= 90 ? "text-emerald-600 dark:text-emerald-300" :
                        d.aciertoProm >= 75 ? "text-amber-600 dark:text-amber-300" : "text-red-500")}>
                        {d.aciertoProm != null ? `${Math.round(d.aciertoProm)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.promRuta > 0 ? d.promRuta.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {diaSeleccionado && (
              <div className="mt-3 border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-blue-50/60 dark:bg-blue-950/30 border-b flex items-center justify-between">
                  <p className="text-xs font-bold">Detalle — todos los {diaSeleccionado} de {resumen.mesLabel}</p>
                  <button onClick={() => setDiaSeleccionado(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Fecha</th>
                      <th className="text-right px-3 py-2 font-semibold">Real</th>
                      <th className="text-right px-3 py-2 font-semibold">Pronosticado</th>
                      <th className="text-right px-3 py-2 font-semibold">Acierto</th>
                      <th className="text-right px-3 py-2 font-semibold">Rutas</th>
                      <th className="text-right px-3 py-2 font-semibold">Prom/ruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasDelDiaSeleccionado.map((d) => (
                      <tr key={d.fecha} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">
                          {new Date(d.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">{d.total_paquetes.toLocaleString("es-AR")}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {d.proyectado_pkg != null ? d.proyectado_pkg.toLocaleString("es-AR") : "—"}
                        </td>
                        <td className={cn("px-3 py-2 text-right tabular-nums font-semibold",
                          d.acierto_pct == null ? "text-muted-foreground/40" :
                          d.acierto_pct >= 90 ? "text-emerald-600 dark:text-emerald-300" :
                          d.acierto_pct >= 75 ? "text-amber-600 dark:text-amber-300" : "text-red-500")}>
                          {d.acierto_pct != null ? `${d.acierto_pct}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.rutas_activas}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{Number(d.prom_por_ruta) > 0 ? d.prom_por_ruta : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DeltaIcon({ pct }: { pct: number }) {
  const Icon = pct > 2 ? TrendingUp : pct < -2 ? TrendingDown : Minus;
  return <Icon className="h-3 w-3" />;
}

function Kpi({ label, valor, sub, color }: { label: string; valor: string; sub: React.ReactNode; color: string }) {
  return (
    <div className="border rounded-xl p-3 bg-background">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums mt-0.5", color)}>{valor}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
