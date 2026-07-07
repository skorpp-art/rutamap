"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { hoyAR } from "@/lib/fechas";
import {
  getPendientes, getPendientesFechas, importarPendientes,
  type Pendiente, type PendienteFila, type FechaPendiente,
} from "@/app/actions/pendientes";
import { PendientesUI } from "./PendientesUI";

// ── Parseo del Excel de Pendientes ───────────────────────────────────────────
function limpiarEmoji(s: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").trim();
}
function normUrgencia(s: string): string | null {
  const t = limpiarEmoji(s).toUpperCase();
  if (t.includes("URGENTE")) return "urgente";
  if (t.includes("PRIORIDAD")) return "prioridad";
  return null;
}
function parseFechaGenerado(titulo: string): string | null {
  const m = titulo.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function parseFechaHogareno(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  // formato "01/07/2026 15:17"
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, hh = "0", mm = "0"] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:00`;
}

interface ParseResult { fecha: string | null; filas: PendienteFila[]; warning?: string }

async function parsearExcelPendientes(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });

  // Fecha del reporte: título de "Resumen General" → "Generado: 03/07/2026"
  let fecha: string | null = null;
  if (wb.SheetNames.includes("Resumen General")) {
    const rg = XLSX.utils.sheet_to_json(wb.Sheets["Resumen General"], { header: 1, defval: "" }) as unknown[][];
    for (const row of rg.slice(0, 4)) {
      const f = parseFechaGenerado(String(row[0] ?? ""));
      if (f) { fecha = f; break; }
    }
  }
  if (!fecha) fecha = hoyAR();

  // Detalle: hoja "Todos los Pendientes" (única con macrozona + todo junto)
  if (!wb.SheetNames.includes("Todos los Pendientes")) {
    return { fecha, filas: [], warning: 'El archivo no parece ser el reporte de Pendientes (falta la hoja "Todos los Pendientes").' };
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["Todos los Pendientes"], { header: 1, defval: "" }) as unknown[][];
  const filas: PendienteFila[] = [];
  // header: Macrozona, Fecha Hogareño, Urgencia, Nro Tracking, Dirección, Estado, Zona, Cadete Asignado, Cliente
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const macrozona = String(r[0] ?? "").trim();
    if (!macrozona) continue;
    filas.push({
      macrozona,
      fecha_hogareno: parseFechaHogareno(r[1]),
      urgencia: normUrgencia(String(r[2] ?? "")),
      tracking: String(r[3] ?? "").trim() || null,
      direccion: String(r[4] ?? "").trim() || null,
      estado: limpiarEmoji(String(r[5] ?? "")) || null,
      zona: String(r[6] ?? "").trim() || null,
      cadete: String(r[7] ?? "").trim() || null,
      cliente: String(r[8] ?? "").trim() || null,
    });
  }
  return { fecha, filas };
}

// ── Componente principal ─────────────────────────────────────────────────────
export function PendientesPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const [vista, setVista] = useState<"dia" | "historico">("dia");
  const [fecha, setFecha] = useState(() => hoyAR());
  const [fechas, setFechas] = useState<FechaPendiente[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [soloNoRecibidos, setSoloNoRecibidos] = useState(false);
  const [cadeteExpandido, setCadeteExpandido] = useState<string | null>(null);

  const cargarFechas = useCallback(async () => {
    const res = await getPendientesFechas();
    if (res.ok && res.data) setFechas(res.data);
  }, []);

  const cargar = useCallback(async (f: string) => {
    setCargando(true);
    try {
      const res = await getPendientes(f);
      if (res.ok) setPendientes(res.data ?? []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargarFechas(); }, [cargarFechas]);
  useEffect(() => { if (vista === "dia") cargar(fecha); }, [fecha, vista, cargar]);

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportando(true);
    try {
      const { fecha: fechaArchivo, filas, warning } = await parsearExcelPendientes(file);
      if (warning) { toast.error(warning); return; }
      if (filas.length === 0) { toast.error("No se encontraron pendientes en el archivo"); return; }
      await ejecutarImport(fechaArchivo ?? fecha, filas);
    } finally { setImportando(false); }
  }

  // Ya no borra ni reemplaza un día: cada fila se fusiona por tracking (ver
  // importarPendientes). Por eso un mismo Excel puede traer pendientes de
  // varios días (últimas 48hs hábiles) sin generar duplicados ni perder marcas.
  async function ejecutarImport(f: string, filas: PendienteFila[]) {
    const res = await importarPendientes(f, filas);
    if (!res.ok) { toast.error("Error al importar", { description: res.error }); return; }
    const r = res.resultado;
    const partes = [];
    if (r) {
      if (r.nuevos > 0) partes.push(`${r.nuevos} nuevos`);
      if (r.actualizados > 0) partes.push(`${r.actualizados} actualizados`);
      if (r.reincidencias > 0) partes.push(`${r.reincidencias} reincidencias`);
    }
    toast.success(`Importación completa (${r?.total ?? filas.length} filas)`, {
      description: partes.length > 0 ? partes.join(" · ") : undefined,
    });
    setFecha(f);
    setVista("dia");
    await Promise.all([cargar(f), cargarFechas()]);
  }

  // ── Cálculos de control ──
  const stats = useMemo(() => {
    const total = pendientes.length;
    const recibidos = pendientes.filter(p => p.estado_recepcion === "recibido").length;
    const noRecibidos = pendientes.filter(p => p.estado_recepcion === "no_recibido").length;
    const sinMarcar = total - recibidos - noRecibidos;
    const urgentes = pendientes.filter(p => p.urgencia === "urgente").length;
    const urgentesFaltan = pendientes.filter(p => p.urgencia === "urgente" && p.estado_recepcion !== "recibido").length;

    const porZona = new Map<string, { total: number; recibidos: number; noRecibidos: number }>();
    const porCadete = new Map<string, { total: number; recibidos: number; noRecibidos: number; urgentes: number }>();
    for (const p of pendientes) {
      const z = p.macrozona || "SIN ZONA";
      const zc = porZona.get(z) ?? { total: 0, recibidos: 0, noRecibidos: 0 };
      zc.total++;
      if (p.estado_recepcion === "recibido") zc.recibidos++;
      if (p.estado_recepcion === "no_recibido") zc.noRecibidos++;
      porZona.set(z, zc);

      const c = p.cadete || "Sin asignar";
      const cc = porCadete.get(c) ?? { total: 0, recibidos: 0, noRecibidos: 0, urgentes: 0 };
      cc.total++;
      if (p.estado_recepcion === "recibido") cc.recibidos++;
      if (p.estado_recepcion === "no_recibido") cc.noRecibidos++;
      if (p.urgencia === "urgente") cc.urgentes++;
      porCadete.set(c, cc);
    }
    return {
      total, recibidos, noRecibidos, sinMarcar, faltan: total - recibidos, urgentes, urgentesFaltan,
      zonas: [...porZona.entries()].map(([zona, v]) => ({ zona, ...v })).sort((a, b) => b.total - a.total),
      cadetes: [...porCadete.entries()].map(([cadete, v]) => ({ cadete, ...v }))
        .sort((a, b) => (b.total - b.recibidos) - (a.total - a.recibidos) || b.total - a.total),
    };
  }, [pendientes]);

  return (
    <PendientesUI
      vista={vista} setVista={setVista}
      fecha={fecha} setFecha={setFecha} fechas={fechas}
      pendientes={pendientes} stats={stats} cargando={cargando} importando={importando}
      puedeEditar={puedeEditar} busqueda={busqueda} setBusqueda={setBusqueda}
      soloNoRecibidos={soloNoRecibidos} setSoloNoRecibidos={setSoloNoRecibidos}
      cadeteExpandido={cadeteExpandido} setCadeteExpandido={setCadeteExpandido}
      onArchivo={onArchivo}
      recargar={() => cargar(fecha)}
      setPendientes={setPendientes}
    />
  );
}

export type PendientesStats = {
  total: number; recibidos: number; noRecibidos: number; sinMarcar: number; faltan: number; urgentes: number; urgentesFaltan: number;
  zonas: { zona: string; total: number; recibidos: number; noRecibidos: number }[];
  cadetes: { cadete: string; total: number; recibidos: number; noRecibidos: number; urgentes: number }[];
};
