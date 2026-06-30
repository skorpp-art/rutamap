"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Calendar,
  Search, Package, Users, Clock, RefreshCw, Truck, MapPin, Layers,
  Globe, Star, ShieldAlert,
} from "lucide-react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  guardarAnalisisDiario, getAnalisisDiario, getAnalisisDiarioEstados,
  getAnalisisDiarioClientes, getAnalisisDiarioTarde, getAnalisisDiarioHistorico,
  getHistoricoCliente, getClientesAnalisisDiario, getClientesTotalesPeriodo,
  guardarInformeMl, getInformeMl, getPeriodosMl,
} from "@/app/actions/analisis-diario";
import type {
  AnalisisDiarioPayload, ResumenAnalisisDia, EstadoDia, ClienteDia,
  TardeFila, HistoricoDia, HistoricoCliente, ClienteTotalPeriodo,
  InformeMlPayload, InformeMlRow,
} from "@/app/actions/analisis-diario";
import { useChartTheme } from "@/hooks/useChartTheme";
import { EmptyState } from "@/components/ui/empty-state";

// ── Helpers de parseo de los Excel ──────────────────────────────────────────
function toInt(v: unknown): number {
  const n = parseInt(String(v ?? "0").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
function toPct(v: unknown): number {
  const s = String(v ?? "0").replace("%", "").replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
// Números con formato AR: "." miles, "," decimal — sirve tanto para "39.891" como "-1,06"
function toFloatAr(s: string): number {
  const cleaned = String(s ?? "").replace(/[^\d,.-]/g, "");
  const norm = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
}
function toIntAr(s: string): number {
  return Math.round(toFloatAr(s));
}
function parseFechaFromTitle(title: string): string | null {
  const m = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sheetRows(XLSX: typeof import("xlsx"), wb: any, nombre: string): any[][] {
  const ws = wb.Sheets[nombre];
  if (!ws) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResumenRendimiento(rows: any[][]) {
  let fecha: string | null = null;
  let post21 = { total: 0, entregados: 0, pctExito: 0 };
  for (const row of rows) {
    const label = String(row[0] ?? "");
    if (!fecha) {
      const f = parseFechaFromTitle(label);
      if (f) fecha = f;
    }
    if (label.includes("Después de las 21")) {
      post21 = { total: toInt(row[1]), entregados: toInt(row[2]), pctExito: toPct(row[3]) };
    }
  }
  return { fecha, post21 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTardanzasTabla(rows: any[][]) {
  const out: { nombre: string; cantidad: number; entregados: number; pctEfectividad: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nombre = String(row[0] ?? "").trim();
    if (!nombre) continue;
    const cantidad = toInt(row[1]);
    if (cantidad === 0 && !row[2]) continue;
    out.push({ nombre, cantidad, entregados: toInt(row[2]), pctEfectividad: toPct(row[3]) });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResumenGeneral(rows: any[][]) {
  let fecha: string | null = null;
  let totalPaquetes = 0;
  const estados: EstadoDia[] = [];
  let enEstadosSection = false;
  for (const row of rows) {
    const label = String(row[0] ?? "").trim();
    if (!fecha) {
      const f = parseFechaFromTitle(label);
      if (f) fecha = f;
    }
    if (label.includes("Total General de Paquetes")) totalPaquetes = toInt(row[1]);
    if (label.includes("RESUMEN DE ENVÍOS POR ESTADO")) { enEstadosSection = true; continue; }
    if (enEstadosSection) {
      if (!label) { enEstadosSection = false; continue; }
      estados.push({ estado: label, cantidad: toInt(row[1]), pct: toPct(row[2]) });
    }
  }
  return { fecha, totalPaquetes, estados };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResumenPorCliente(rows: any[][]) {
  const out: { cliente: string; cantidad: number; pctDelDia: number; enCamino: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cliente = String(row[0] ?? "").trim();
    if (!cliente) continue;
    const cantidad = toInt(row[1]);
    if (cantidad === 0) continue;
    out.push({ cliente, cantidad, pctDelDia: toPct(row[2]), enCamino: toInt(row[3]) });
  }
  return out;
}

interface TardeRaw {
  fecha: string | null;
  post21: { total: number; entregados: number; pctExito: number };
  tardeZona: { nombre: string; cantidad: number; entregados: number; pctEfectividad: number }[];
  tardeChofer: { nombre: string; cantidad: number; entregados: number; pctEfectividad: number }[];
}
interface ResumenRaw {
  fecha: string | null;
  totalPaquetes: number;
  estados: EstadoDia[];
  porCliente: { cliente: string; cantidad: number; pctDelDia: number; enCamino: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraerTarde(XLSX: typeof import("xlsx"), wb: any): TardeRaw | null {
  if (!wb.SheetNames.includes("Resumen de Rendimiento")) return null;
  const resumenTarde = parseResumenRendimiento(sheetRows(XLSX, wb, "Resumen de Rendimiento"));
  const tardeZona = wb.SheetNames.includes("Tardanzas por Zona") ? parseTardanzasTabla(sheetRows(XLSX, wb, "Tardanzas por Zona")) : [];
  const tardeChofer = wb.SheetNames.includes("Tardanzas por Chofer") ? parseTardanzasTabla(sheetRows(XLSX, wb, "Tardanzas por Chofer")) : [];
  return { fecha: resumenTarde.fecha, post21: resumenTarde.post21, tardeZona, tardeChofer };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraerResumen(XLSX: typeof import("xlsx"), wb: any): ResumenRaw | null {
  if (!wb.SheetNames.includes("Resumen General")) return null;
  const resumenGeneral = parseResumenGeneral(sheetRows(XLSX, wb, "Resumen General"));
  const porCliente = wb.SheetNames.includes("Resumen por Cliente") ? parseResumenPorCliente(sheetRows(XLSX, wb, "Resumen por Cliente")) : [];
  return { fecha: resumenGeneral.fecha, totalPaquetes: resumenGeneral.totalPaquetes, estados: resumenGeneral.estados, porCliente };
}

async function parseArchivoTarde(file: File): Promise<{ data: TardeRaw | null; warning?: string }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const data = extraerTarde(XLSX, wb);
  if (!data) return { data: null, warning: "El archivo no parece ser \"Análisis Tarde\" (falta la hoja \"Resumen de Rendimiento\")." };
  return { data };
}

async function parseArchivoResumen(file: File): Promise<{ data: ResumenRaw | null; warning?: string }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const data = extraerResumen(XLSX, wb);
  if (!data) return { data: null, warning: "El archivo no parece ser \"Resumen de Envíos\" (falta la hoja \"Resumen General\")." };
  return { data };
}

// ── Parser del Informe mensual de Mercado Libre / Flex (.doc = HTML) ────────
type InformeMlSinPeriodo = Omit<InformeMlPayload, "periodo">;

function tablaSiguienteA(doc: Document, regex: RegExp): string[][] {
  const h2 = Array.from(doc.querySelectorAll("h2")).find(h => regex.test(h.textContent ?? ""));
  if (!h2) return [];
  let el = h2.nextElementSibling;
  while (el && el.tagName !== "TABLE") el = el.nextElementSibling;
  if (!el) return [];
  return Array.from(el.querySelectorAll("tr")).map(tr =>
    Array.from(tr.children).map(td => (td.textContent ?? "").trim())
  );
}

function parsePctConExceso(s: string): { pct: number; exceso_pct: number | null } {
  const mPct = s.match(/([\d.,]+)\s*%/);
  const mExc = s.match(/excede del promedio en\s*([\d.,]+)\s*%/i);
  return { pct: mPct ? toFloatAr(mPct[1]) : 0, exceso_pct: mExc ? toFloatAr(mExc[1]) : null };
}

function extraerInformeMl(html: string): InformeMlSinPeriodo | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!/deep dive mensual/i.test(doc.body.textContent ?? "")) return null;

  // ✨ Resumen ejecutivo
  let volumenTotal = 0;
  const vacio = { pct: 0, promedio: null as number | null, delta: null as number | null };
  let sla = vacio, visitas21 = vacio, sameday = vacio, perfectDelivery = vacio;
  const lis = Array.from(doc.querySelectorAll("ul.summary li")).map(li => li.textContent ?? "");
  for (const text of lis) {
    if (/volumen total/i.test(text)) {
      const m = text.match(/:\s*([\d.,]+)/);
      if (m) volumenTotal = toIntAr(m[1]);
      continue;
    }
    const m = text.match(/:\s*([\d.,]+)\s*%\s*promedio\s*([\d.,]+)\s*%.*?([+-]\s?[\d.,]+)\s*pp/i);
    if (!m) continue;
    const kpi = { pct: toFloatAr(m[1]), promedio: toFloatAr(m[2]), delta: toFloatAr(m[3]) };
    if (/SLA/i.test(text)) sla = kpi;
    else if (/visitas/i.test(text)) visitas21 = kpi;
    else if (/sameday/i.test(text)) sameday = kpi;
    else if (/perfect delivery/i.test(text)) perfectDelivery = kpi;
  }

  const batallas: BatallaFlexLocal[] = tablaSiguienteA(doc, /Batallas FLEX/i).slice(1)
    .filter(r => r[0]).map(r => ({ motivo: r[0], ...parsePctConExceso(r[1] ?? "") }));

  const motivosFallidos: BatallaFlexLocal[] = tablaSiguienteA(doc, /motivos visitas fallidas/i).slice(1)
    .filter(r => r[0]).map(r => ({ motivo: r[0], ...parsePctConExceso(r[1] ?? "") }));

  const sellersBajoSameday = tablaSiguienteA(doc, /bajo sameday/i).slice(1)
    .filter(r => r[0]).map(r => ({
      seller_id: r[0], nombre: r[1] ?? "", envios_total: toIntAr(r[2] ?? "0"),
      envios_sd: toIntAr(r[3] ?? "0"), share_sd: toFloatAr(r[4] ?? "0"),
    }));

  const sellersOportunidadSabado = tablaSiguienteA(doc, /oportunidad el sábado/i).slice(1)
    .filter(r => r[0]).map(r => ({
      seller_id: r[0], nombre: r[1] ?? "", envios_total: toIntAr(r[2] ?? "0"),
      envios_sab: toIntAr(r[3] ?? "0"), share_sab: toFloatAr(r[4] ?? "0"),
    }));

  const sellersOportunidadCapacidad = tablaSiguienteA(doc, /aumentar capacidades/i).slice(1)
    .filter(r => r[0]).map(r => ({
      seller_id: r[0], nombre: r[1] ?? "", envios_total: toIntAr(r[2] ?? "0"),
      upside_pct: toFloatAr(r[3] ?? "0"),
    }));

  const oportunidadesGeograficas = tablaSiguienteA(doc, /Oportunidades geográficas/i).slice(1)
    .filter(r => r[0]).map(r => ({
      ciudad: r[0], envios: toIntAr(r[1] ?? "0"), sla: toFloatAr(r[2] ?? "0"),
      sla_carrier: toFloatAr(r[3] ?? "0"), delta: toFloatAr(r[4] ?? "0"), post21_pct: toFloatAr(r[5] ?? "0"),
    }));

  const sellersOportunidad = tablaSiguienteA(doc, /^Sellers oportunidad$|🧩 Sellers oportunidad/i).slice(1)
    .filter(r => r[0]).map(r => ({ seller_id: r[0], nombre: r[1] ?? "", envios: toIntAr(r[2] ?? "0"), sla: toFloatAr(r[3] ?? "0") }));

  const sellersOptimos = tablaSiguienteA(doc, /Sellers óptimos/i).slice(1)
    .filter(r => r[0]).map(r => ({ seller_id: r[0], nombre: r[1] ?? "", envios: toIntAr(r[2] ?? "0"), sla: toFloatAr(r[3] ?? "0") }));

  return {
    volumenTotal, sla, visitas21, sameday, perfectDelivery,
    batallas, motivosFallidos, sellersBajoSameday, oportunidadesGeograficas,
    sellersOportunidad, sellersOptimos, sellersOportunidadSabado, sellersOportunidadCapacidad,
  };
}

interface BatallaFlexLocal { motivo: string; pct: number; exceso_pct: number | null }

async function parseArchivoMl(file: File): Promise<{ data: InformeMlSinPeriodo | null; warning?: string }> {
  const html = await file.text();
  const data = extraerInformeMl(html);
  if (!data) return { data: null, warning: "El archivo no parece ser un \"Deep dive mensual\" de Mercado Libre/Flex." };
  return { data };
}

// ── Carga en lote (varios Excel del mes a la vez) ────────────────────────────
export interface DiaLote {
  fecha: string;
  tarde: TardeRaw | null;
  resumen: ResumenRaw | null;
  payload: AnalisisDiarioPayload | null;
  warnings: string[];
}

async function parseLote(files: File[]): Promise<{ dias: DiaLote[]; sinReconocer: string[] }> {
  const XLSX = await import("xlsx");
  const porFecha = new Map<string, { tarde: TardeRaw | null; resumen: ResumenRaw | null }>();
  const sinReconocer: string[] = [];

  for (const file of files) {
    let wb;
    try {
      wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    } catch {
      sinReconocer.push(`${file.name} (no se pudo leer)`);
      continue;
    }
    const tarde = extraerTarde(XLSX, wb);
    const resumen = extraerResumen(XLSX, wb);
    const fecha = tarde?.fecha ?? resumen?.fecha ?? null;
    if ((!tarde && !resumen) || !fecha) {
      sinReconocer.push(file.name);
      continue;
    }
    const slot = porFecha.get(fecha) ?? { tarde: null, resumen: null };
    if (tarde) slot.tarde = tarde;
    if (resumen) slot.resumen = resumen;
    porFecha.set(fecha, slot);
  }

  const dias: DiaLote[] = [...porFecha.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, { tarde, resumen }]) => {
      const { payload, warnings } = construirPayload(tarde, resumen);
      return { fecha, tarde, resumen, payload, warnings };
    });

  return { dias, sinReconocer };
}

function construirPayload(tardeRaw: TardeRaw | null, resumenRaw: ResumenRaw | null): { payload: AnalisisDiarioPayload | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!resumenRaw) warnings.push("Falta cargar el archivo \"Resumen de Envíos\".");
  if (!tardeRaw) warnings.push("Falta cargar el archivo \"Análisis Tarde\".");
  if (!resumenRaw || !tardeRaw) return { payload: null, warnings };

  const fecha = resumenRaw.fecha ?? tardeRaw.fecha;
  if (!fecha) {
    warnings.push("No se pudo detectar la fecha en ninguno de los dos archivos.");
    return { payload: null, warnings };
  }

  const totalPaquetes = resumenRaw.totalPaquetes;
  const entregados = resumenRaw.estados.find(e => e.estado === "Entregado")?.cantidad ?? 0;
  const pctExito = totalPaquetes > 0 ? round2(entregados / totalPaquetes * 100) : 0;
  // Demorado = todo lo "post-21hs" que no se entregó (en camino al destinatario, reprogramado, etc.)
  const enCamino = Math.max(0, tardeRaw.post21.total - tardeRaw.post21.entregados);
  const enCaminoPct = totalPaquetes > 0 ? round2(enCamino / totalPaquetes * 100) : 0;

  const post21Total = tardeRaw.post21.total;
  const post21Entregados = tardeRaw.post21.entregados;
  const post21PctExito = post21Total > 0 ? round2(post21Entregados / post21Total * 100) : tardeRaw.post21.pctExito;
  const post21PctDelDia = totalPaquetes > 0 ? round2(post21Total / totalPaquetes * 100) : 0;

  const clientes: ClienteDia[] = resumenRaw.porCliente.map(c => ({
    cliente: c.cliente,
    cantidad: c.cantidad,
    pct_del_dia: c.pctDelDia,
    en_camino_destinatario: c.enCamino,
    en_camino_destinatario_pct: c.cantidad > 0 ? round2(c.enCamino / c.cantidad * 100) : 0,
  }));

  const resumen: ResumenAnalisisDia = {
    total_paquetes: totalPaquetes,
    entregados,
    pct_exito: pctExito,
    post21_total: post21Total,
    post21_entregados: post21Entregados,
    post21_pct_exito: post21PctExito,
    post21_pct_del_dia: post21PctDelDia,
    en_camino_destinatario: enCamino,
    en_camino_destinatario_pct: enCaminoPct,
  };

  return {
    payload: {
      fecha, resumen,
      estados: resumenRaw.estados,
      clientes,
      tardeZona: tardeRaw.tardeZona.map(z => ({ zona: z.nombre, cantidad: z.cantidad, entregados: z.entregados, pct_efectividad: z.pctEfectividad })),
      tardeChofer: tardeRaw.tardeChofer.map(c => ({ chofer: c.nombre, cantidad: c.cantidad, entregados: c.entregados, pct_efectividad: c.pctEfectividad })),
    },
    warnings,
  };
}

// ── Componente ───────────────────────────────────────────────────────────────
type Vista = "dia" | "historico" | "ml";

export function AnalisisDiario() {
  const [vista, setVista] = useState<Vista>("dia");
  const fileTardeRef = useRef<HTMLInputElement>(null);
  const fileResumenRef = useRef<HTMLInputElement>(null);
  const fileLoteRef = useRef<HTMLInputElement>(null);
  const fileMlRef = useRef<HTMLInputElement>(null);
  const ct = useChartTheme();

  // Informe mensual de Mercado Libre / Flex
  const [mlRaw, setMlRaw] = useState<InformeMlSinPeriodo | null>(null);
  const [mlPeriodo, setMlPeriodo] = useState(() => new Date().toISOString().slice(0, 7));
  const [guardandoMl, setGuardandoMl] = useState(false);
  const [periodosMl, setPeriodosMl] = useState<{ periodo: string; volumen_total: number }[]>([]);
  const [periodoMlSel, setPeriodoMlSel] = useState<string>("");
  const [informeMl, setInformeMl] = useState<InformeMlRow | null>(null);
  const [cruceMl, setCruceMl] = useState<{ total: number; pctExito: number; post21Pct: number } | null>(null);
  const [cargandoMl, setCargandoMl] = useState(false);

  // Carga / preview — cada archivo se sube por separado y se combinan acá
  const [tardeRaw, setTardeRaw] = useState<TardeRaw | null>(null);
  const [resumenRaw, setResumenRaw] = useState<ResumenRaw | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Carga en lote (varios Excel del mes a la vez)
  const [lote, setLote] = useState<DiaLote[]>([]);
  const [loteSinReconocer, setLoteSinReconocer] = useState<string[]>([]);
  const [procesandoLote, setProcesandoLote] = useState(false);
  const [guardandoLote, setGuardandoLote] = useState(false);
  const [progresoLote, setProgresoLote] = useState<{ hechos: number; total: number } | null>(null);

  const { payload: previa, warnings } = (tardeRaw || resumenRaw)
    ? construirPayload(tardeRaw, resumenRaw)
    : { payload: null, warnings: [] as string[] };

  // Día consultado
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [resumen, setResumen] = useState<(ResumenAnalisisDia & { fecha: string }) | null>(null);
  const [estados, setEstados] = useState<EstadoDia[]>([]);
  const [clientes, setClientes] = useState<ClienteDia[]>([]);
  const [tarde, setTarde] = useState<TardeFila[]>([]);
  const [cargando, setCargando] = useState(false);

  // Histórico
  const [clientesDisponibles, setClientesDisponibles] = useState<string[]>([]);
  const [clienteSel, setClienteSel] = useState<string>("");
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [historicoGeneral, setHistoricoGeneral] = useState<HistoricoDia[]>([]);
  const [historicoCliente, setHistoricoCliente] = useState<HistoricoCliente[]>([]);
  const [clientesTotales, setClientesTotales] = useState<ClienteTotalPeriodo[]>([]);
  const [cargandoHistorico, setCargandoHistorico] = useState(false);

  const cargarDia = useCallback(async (f: string) => {
    setCargando(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        getAnalisisDiario(f),
        getAnalisisDiarioEstados(f),
        getAnalisisDiarioClientes(f),
        getAnalisisDiarioTarde(f),
      ]);
      setResumen(r1.ok ? r1.data ?? null : null);
      setEstados(r2.ok ? r2.data ?? [] : []);
      setClientes(r3.ok ? r3.data ?? [] : []);
      setTarde(r4.ok ? r4.data ?? [] : []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { if (vista === "dia") cargarDia(fecha); }, [fecha, vista, cargarDia]);

  useEffect(() => {
    getClientesAnalisisDiario().then(res => { if (res.ok && res.data) setClientesDisponibles(res.data); });
  }, []);

  const cargarHistorico = useCallback(async () => {
    setCargandoHistorico(true);
    try {
      const [resGen, resTotales] = await Promise.all([
        getAnalisisDiarioHistorico(desde, hasta),
        getClientesTotalesPeriodo(desde, hasta),
      ]);
      setHistoricoGeneral(resGen.ok ? resGen.data ?? [] : []);
      setClientesTotales(resTotales.ok ? resTotales.data ?? [] : []);
      if (clienteSel) {
        const resCli = await getHistoricoCliente(clienteSel, desde, hasta);
        setHistoricoCliente(resCli.ok ? resCli.data ?? [] : []);
      } else {
        setHistoricoCliente([]);
      }
    } finally { setCargandoHistorico(false); }
  }, [desde, hasta, clienteSel]);

  useEffect(() => { if (vista === "historico") cargarHistorico(); }, [vista, cargarHistorico]);

  const cargarInformeMl = useCallback(async (periodo: string) => {
    if (!periodo) { setInformeMl(null); setCruceMl(null); return; }
    setCargandoMl(true);
    try {
      const res = await getInformeMl(`${periodo}-01`);
      setInformeMl(res.ok ? res.data ?? null : null);

      const [y, m] = periodo.split("-").map(Number);
      const desde = `${periodo}-01`;
      const hasta = new Date(y, m, 0).toISOString().slice(0, 10);
      const resHist = await getAnalisisDiarioHistorico(desde, hasta);
      const dias = resHist.ok ? resHist.data ?? [] : [];
      const total = dias.reduce((s, d) => s + d.total_paquetes, 0);
      const entregadosAprox = dias.reduce((s, d) => s + d.total_paquetes * d.pct_exito / 100, 0);
      const post21 = dias.reduce((s, d) => s + d.post21_total, 0);
      setCruceMl(total > 0 ? { total, pctExito: round2(entregadosAprox / total * 100), post21Pct: round2(post21 / total * 100) } : null);
    } finally { setCargandoMl(false); }
  }, []);

  useEffect(() => {
    if (vista !== "ml") return;
    getPeriodosMl().then(res => {
      if (!res.ok || !res.data) return;
      setPeriodosMl(res.data);
      if (!periodoMlSel && res.data.length) setPeriodoMlSel(res.data[0].periodo.slice(0, 7));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  useEffect(() => { if (vista === "ml" && periodoMlSel) cargarInformeMl(periodoMlSel); }, [vista, periodoMlSel, cargarInformeMl]);

  async function handleFileTarde(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data, warning } = await parseArchivoTarde(file);
      if (!data) {
        toast.error("No se pudo procesar \"Análisis Tarde\"", { description: warning });
        return;
      }
      setTardeRaw(data);
      toast.success(`"Análisis Tarde" cargado${data.fecha ? ` — ${data.fecha}` : ""}`);
    } catch (err) {
      toast.error("Error al leer el archivo", { description: String(err) });
    }
  }

  async function handleFileResumen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data, warning } = await parseArchivoResumen(file);
      if (!data) {
        toast.error("No se pudo procesar \"Resumen de Envíos\"", { description: warning });
        return;
      }
      setResumenRaw(data);
      toast.success(`"Resumen de Envíos" cargado${data.fecha ? ` — ${data.fecha}` : ""} — ${data.totalPaquetes.toLocaleString("es-AR")} paquetes`);
    } catch (err) {
      toast.error("Error al leer el archivo", { description: String(err) });
    }
  }

  async function handleFileMl(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data, warning } = await parseArchivoMl(file);
      if (!data) {
        toast.error("No se pudo procesar el Informe ML", { description: warning });
        return;
      }
      setMlRaw(data);
      toast.success(`Informe ML cargado — ${data.volumenTotal.toLocaleString("es-AR")} envíos`);
    } catch (err) {
      toast.error("Error al leer el archivo", { description: String(err) });
    } finally {
      if (fileMlRef.current) fileMlRef.current.value = "";
    }
  }

  function descartarCargaMl() {
    setMlRaw(null);
  }

  async function confirmarCargaMl() {
    if (!mlRaw) return;
    setGuardandoMl(true);
    try {
      const payload: InformeMlPayload = { periodo: `${mlPeriodo}-01`, ...mlRaw };
      const res = await guardarInformeMl(payload);
      if (!res.ok) { toast.error("Error al guardar el informe ML", { description: res.error }); return; }
      toast.success(`Informe ML de ${mlPeriodo} guardado`);
      setMlRaw(null);
      setVista("ml");
      setPeriodoMlSel(mlPeriodo);
      const resP = await getPeriodosMl();
      if (resP.ok && resP.data) setPeriodosMl(resP.data);
      await cargarInformeMl(mlPeriodo);
    } finally { setGuardandoMl(false); }
  }

  function descartarCarga() {
    setTardeRaw(null);
    setResumenRaw(null);
    if (fileTardeRef.current) fileTardeRef.current.value = "";
    if (fileResumenRef.current) fileResumenRef.current.value = "";
  }

  async function confirmarCarga() {
    if (!previa) return;
    setGuardando(true);
    try {
      const res = await guardarAnalisisDiario(previa);
      if (!res.ok) { toast.error("Error al guardar", { description: res.error }); return; }
      toast.success(`Análisis del ${previa.fecha} guardado`);
      setFecha(previa.fecha);
      setVista("dia");
      descartarCarga();
      await cargarDia(previa.fecha);
      const resC = await getClientesAnalisisDiario();
      if (resC.ok && resC.data) setClientesDisponibles(resC.data);
    } finally { setGuardando(false); }
  }

  async function handleFilesLote(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setProcesandoLote(true);
    try {
      const { dias, sinReconocer } = await parseLote(files);
      setLote(dias);
      setLoteSinReconocer(sinReconocer);
      const completos = dias.filter(d => d.payload).length;
      if (!dias.length) {
        toast.error("No se reconoció ningún archivo válido en la selección.");
      } else {
        toast.success(`${dias.length} día(s) detectado(s) · ${completos} listo(s) para guardar`);
      }
    } catch (err) {
      toast.error("Error al procesar el lote", { description: String(err) });
    } finally {
      setProcesandoLote(false);
      if (fileLoteRef.current) fileLoteRef.current.value = "";
    }
  }

  function descartarLote() {
    setLote([]);
    setLoteSinReconocer([]);
    setProgresoLote(null);
    if (fileLoteRef.current) fileLoteRef.current.value = "";
  }

  async function guardarLote() {
    const guardables = lote.filter(d => d.payload);
    if (!guardables.length) return;
    setGuardandoLote(true);
    setProgresoLote({ hechos: 0, total: guardables.length });
    let ok = 0;
    const fallidos: string[] = [];
    try {
      for (let i = 0; i < guardables.length; i++) {
        const d = guardables[i];
        const res = await guardarAnalisisDiario(d.payload!);
        if (res.ok) ok++; else fallidos.push(d.fecha);
        setProgresoLote({ hechos: i + 1, total: guardables.length });
      }
      if (fallidos.length) {
        toast.error(`${ok} guardado(s), ${fallidos.length} con error`, { description: `Fallaron: ${fallidos.join(", ")}` });
      } else {
        toast.success(`${ok} día(s) guardado(s) correctamente`);
      }
      descartarLote();
      const resC = await getClientesAnalisisDiario();
      if (resC.ok && resC.data) setClientesDisponibles(resC.data);
      if (vista === "dia") await cargarDia(fecha);
    } finally {
      setGuardandoLote(false);
    }
  }

  const tardeZonas = tarde.filter(t => t.tipo === "zona");
  const tardeChoferes = tarde.filter(t => t.tipo === "chofer");

  const chartGeneral = historicoGeneral.map(d => ({
    dia: d.fecha.slice(5),
    total: d.total_paquetes,
    pctExito: d.pct_exito,
    post21Total: d.post21_total,
    post21Pct: d.post21_pct_del_dia,
    enCaminoTotal: d.en_camino_destinatario,
    enCaminoPct: d.en_camino_destinatario_pct,
  }));
  const chartCliente = historicoCliente.map(d => ({
    dia: d.fecha.slice(5),
    enCaminoPct: d.en_camino_destinatario_pct,
    cantidad: d.cantidad,
  }));
  const chartClientesTotales = clientesTotales.slice(0, 15).map(c => ({
    cliente: c.cliente.length > 18 ? c.cliente.slice(0, 17) + "…" : c.cliente,
    clienteCompleto: c.cliente,
    total: c.total_paquetes,
    enCamino: c.total_en_camino,
    pctEnCamino: c.pct_en_camino,
  }));
  const totalesPeriodo = historicoGeneral.reduce((acc, d) => ({
    total: acc.total + d.total_paquetes,
    post21: acc.post21 + d.post21_total,
    enCamino: acc.enCamino + d.en_camino_destinatario,
  }), { total: 0, post21: 0, enCamino: 0 });

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            Análisis del Día
          </h2>
          <p className="text-xs text-muted-foreground">
            Entregas post-21hs, estados del día y demorados (todo lo post-21hs sin entregar) por cliente.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            <button onClick={() => setVista("dia")}
              className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === "dia" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              Día
            </button>
            <button onClick={() => setVista("historico")}
              className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === "historico" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              Histórico
            </button>
            <button onClick={() => setVista("ml")}
              className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                vista === "ml" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              ML / Flex
            </button>
          </div>
          <input ref={fileTardeRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileTarde} />
          <input ref={fileResumenRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileResumen} />
          <input ref={fileLoteRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={handleFilesLote} />
          <input ref={fileMlRef} type="file" accept=".doc,.html,.htm" className="hidden" onChange={handleFileMl} />
          <Button size="sm" variant={tardeRaw ? "secondary" : "outline"} className="gap-1.5 text-xs h-8" onClick={() => fileTardeRef.current?.click()}>
            {tardeRaw ? <CheckCircle className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            Análisis Tarde
          </Button>
          <Button size="sm" variant={resumenRaw ? "secondary" : "outline"} className="gap-1.5 text-xs h-8" onClick={() => fileResumenRef.current?.click()}>
            {resumenRaw ? <CheckCircle className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            Resumen de Envíos
          </Button>
          <div className="h-6 w-px bg-border" />
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => fileLoteRef.current?.click()} disabled={procesandoLote}>
            {procesandoLote ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
            Cargar lote del mes
          </Button>
          <div className="h-6 w-px bg-border" />
          <Button size="sm" variant={mlRaw ? "secondary" : "outline"} className="gap-1.5 text-xs h-8" onClick={() => fileMlRef.current?.click()}>
            {mlRaw ? <CheckCircle className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
            Informe ML
          </Button>
        </div>
      </div>

      {/* Preview de carga en lote */}
      {lote.length > 0 && (
        <div className="border rounded-xl p-4 space-y-3 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <p className="text-sm font-bold">
              Lote — {lote.length} día(s) · {lote.filter(d => d.payload).length} listo(s) para guardar
            </p>
          </div>
          {loteSinReconocer.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              No se reconocieron {loteSinReconocer.length} archivo(s): {loteSinReconocer.slice(0, 6).join(", ")}{loteSinReconocer.length > 6 ? "…" : ""}
            </p>
          )}
          <div className="max-h-72 overflow-y-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">A. Tarde</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">R. Envíos</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Paquetes</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Demorados</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lote.map(d => (
                  <tr key={d.fecha} className={cn(!d.payload && "bg-amber-50/40 dark:bg-amber-950/10")}>
                    <td className="px-3 py-1.5 tabular-nums">{d.fecha}</td>
                    <td className="px-3 py-1.5 text-center">{d.tarde ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 inline" /> : "—"}</td>
                    <td className="px-3 py-1.5 text-center">{d.resumen ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 inline" /> : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{d.payload ? d.payload.resumen.total_paquetes.toLocaleString("es-AR") : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{d.payload ? `${d.payload.resumen.en_camino_destinatario} (${d.payload.resumen.en_camino_destinatario_pct.toFixed(1)}%)` : "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{d.payload ? "Listo" : d.warnings[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={guardarLote} disabled={guardandoLote || lote.every(d => !d.payload)} className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              {guardandoLote
                ? `Guardando ${progresoLote?.hechos ?? 0}/${progresoLote?.total ?? 0}…`
                : `Guardar ${lote.filter(d => d.payload).length} día(s)`}
            </Button>
            <Button size="sm" variant="outline" onClick={descartarLote} disabled={guardandoLote}>
              Descartar lote
            </Button>
          </div>
        </div>
      )}

      {/* Preview de carga */}
      {(tardeRaw || resumenRaw) && (
        <div className="border rounded-xl p-4 space-y-3 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <p className="text-sm font-bold">Vista previa{previa ? ` — ${previa.fecha}` : ""}</p>
          </div>
          {warnings.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              {warnings.map((w, i) => <p key={i} className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" /> {w}</p>)}
            </div>
          )}
          {previa && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniKpi label="Total paquetes" valor={previa.resumen.total_paquetes.toLocaleString("es-AR")} />
                <MiniKpi label="% éxito" valor={`${previa.resumen.pct_exito.toFixed(2)}%`} />
                <MiniKpi label="Post-21" valor={`${previa.resumen.post21_total} (${previa.resumen.post21_pct_del_dia.toFixed(2)}%)`} />
                <MiniKpi label="Demorados" valor={`${previa.resumen.en_camino_destinatario} (${previa.resumen.en_camino_destinatario_pct.toFixed(2)}%)`} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {previa.clientes.length} clientes · {previa.tardeZona.length} zonas con tardanza · {previa.tardeChofer.length} choferes con tardanza
              </p>
            </>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmarCarga} disabled={guardando || !previa} className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              {guardando ? "Guardando…" : "Confirmar y guardar"}
            </Button>
            <Button size="sm" variant="outline" onClick={descartarCarga}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {/* Preview de carga del Informe ML */}
      {mlRaw && (
        <div className="border rounded-xl p-4 space-y-3 bg-violet-50/40 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            <p className="text-sm font-bold">Vista previa — Informe ML</p>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Período</span>
              <input type="month" value={mlPeriodo} onChange={e => setMlPeriodo(e.target.value)}
                className="text-xs bg-background border rounded-md px-2 py-1 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MiniKpi label="Volumen total" valor={mlRaw.volumenTotal.toLocaleString("es-AR")} />
            <MiniKpi label="SLA" valor={`${mlRaw.sla.pct.toFixed(2)}%`} />
            <MiniKpi label="Visitas ≥21h" valor={`${mlRaw.visitas21.pct.toFixed(2)}%`} />
            <MiniKpi label="Sameday" valor={`${mlRaw.sameday.pct.toFixed(2)}%`} />
            <MiniKpi label="Perfect Delivery" valor={`${mlRaw.perfectDelivery.pct.toFixed(2)}%`} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {mlRaw.sellersBajoSameday.length} sellers con bajo sameday · {mlRaw.oportunidadesGeograficas.length} ciudades · {mlRaw.motivosFallidos.length} motivos de fallo
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmarCargaMl} disabled={guardandoMl} className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              {guardandoMl ? "Guardando…" : `Confirmar y guardar (${mlPeriodo})`}
            </Button>
            <Button size="sm" variant="outline" onClick={descartarCargaMl}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {vista === "dia" ? (
        <DiaView
          fecha={fecha} setFecha={setFecha} cargando={cargando}
          resumen={resumen} estados={estados} clientes={clientes}
          tardeZonas={tardeZonas} tardeChoferes={tardeChoferes}
          onRefrescar={() => cargarDia(fecha)}
        />
      ) : vista === "historico" ? (
        <HistoricoView
          desde={desde} setDesde={setDesde} hasta={hasta} setHasta={setHasta}
          clienteSel={clienteSel} setClienteSel={setClienteSel}
          clientesDisponibles={clientesDisponibles}
          cargando={cargandoHistorico}
          chartGeneral={chartGeneral} chartCliente={chartCliente}
          chartClientesTotales={chartClientesTotales}
          totalesPeriodo={totalesPeriodo}
          historicoCliente={historicoCliente}
          ct={ct}
        />
      ) : (
        <MlView
          periodosMl={periodosMl} periodoSel={periodoMlSel} setPeriodoSel={setPeriodoMlSel}
          informe={informeMl} cruce={cruceMl} cargando={cargandoMl}
        />
      )}
    </div>
  );
}

function MiniKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-background border rounded-lg px-3 py-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{valor}</p>
    </div>
  );
}

// ── Vista Día ────────────────────────────────────────────────────────────────
function DiaView({
  fecha, setFecha, cargando, resumen, estados, clientes, tardeZonas, tardeChoferes, onRefrescar,
}: {
  fecha: string; setFecha: (f: string) => void; cargando: boolean;
  resumen: (ResumenAnalisisDia & { fecha: string }) | null;
  estados: EstadoDia[]; clientes: ClienteDia[];
  tardeZonas: TardeFila[]; tardeChoferes: TardeFila[];
  onRefrescar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [clienteSel, setClienteSel] = useState<string | null>(null);

  const clientesOrdenados = [...clientes].sort((a, b) => b.en_camino_destinatario - a.en_camino_destinatario || b.cantidad - a.cantidad);
  const maxPctDia = Math.max(1, ...clientes.map(c => c.pct_del_dia));
  const filtrados = clientesOrdenados.filter(c => c.cliente.toLowerCase().includes(busqueda.toLowerCase()));
  const sel = clienteSel ? clientes.find(c => c.cliente === clienteSel) ?? null : null;
  const maxEstado = Math.max(1, ...estados.map(e => e.cantidad));
  const fechaLinda = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-2.5 py-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="text-xs bg-transparent outline-none" />
        </div>
        {resumen && <span className="text-xs text-muted-foreground capitalize">{fechaLinda}</span>}
        <button onClick={onRefrescar} className="text-muted-foreground hover:text-foreground ml-auto">
          <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
        </button>
      </div>

      {!resumen && !cargando ? (
        <EmptyState icon={Package} title="Sin datos para este día"
          description="Cargá los dos reportes (Resumen de Envíos + Análisis Tarde) para este día." />
      ) : resumen ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Package} label="Total paquetes" valor={resumen.total_paquetes.toLocaleString("es-AR")} tono="blue" />
            <KpiCard icon={CheckCircle} label="% éxito del día" valor={`${resumen.pct_exito.toFixed(2)}%`}
              sub={`${resumen.entregados.toLocaleString("es-AR")} entregados`} tono="emerald" />
            <KpiCard icon={Clock} label="Post-21hs" valor={`${resumen.post21_total} · ${resumen.post21_pct_del_dia.toFixed(1)}%`}
              sub={`% éxito tardío: ${resumen.post21_pct_exito.toFixed(1)}%`} tono="amber" />
            <KpiCard icon={Truck} label="Demorados" valor={`${resumen.en_camino_destinatario} · ${resumen.en_camino_destinatario_pct.toFixed(1)}%`}
              sub="post-21hs sin entregar" tono="violet" />
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* Estados — con barra de proporción */}
            <div className="lg:col-span-2 border rounded-2xl overflow-hidden bg-card shadow-sm">
              <SeccionHeader icon={CheckCircle} titulo="Resolución del día por estado" tono="emerald" />
              <div className="divide-y max-h-[22rem] overflow-y-auto">
                {estados.map(e => {
                  const esDemorado = e.estado.toLowerCase().includes("en camino al destinatario");
                  const esEntregado = e.estado.toLowerCase().startsWith("entregado");
                  const tono: Tono = esDemorado ? "violet" : esEntregado ? "emerald" : "blue";
                  return (
                    <div key={e.estado} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-xs truncate">{e.estado}</span>
                        <span className="text-xs tabular-nums shrink-0">
                          <span className="font-semibold">{e.cantidad.toLocaleString("es-AR")}</span>
                          <span className="text-muted-foreground"> · {e.pct.toFixed(1)}%</span>
                        </span>
                      </div>
                      <BarraProp pct={e.cantidad / maxEstado * 100} tono={tono} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clientes — con búsqueda y análisis individual */}
            <div className="lg:col-span-3 border rounded-2xl overflow-hidden bg-card shadow-sm">
              <SeccionHeader icon={Users} titulo="Clientes del día" tono="blue">
                <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 py-1">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente…"
                    className="text-xs bg-transparent outline-none w-32 sm:w-40" />
                </div>
              </SeccionHeader>

              {/* Detalle del cliente seleccionado */}
              {sel && (
                <div className="m-3 rounded-xl border bg-gradient-to-br from-violet-50 to-sky-50/40 dark:from-violet-950/30 dark:to-sky-950/10 border-violet-200/70 dark:border-violet-900/50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-bold flex items-center gap-1.5"><Users className="h-4 w-4 text-violet-600 dark:text-violet-300" /> {sel.cliente}</p>
                    <button onClick={() => setClienteSel(null)} className="text-[11px] text-muted-foreground hover:text-foreground">Cerrar ✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniKpi label="Paquetes" valor={sel.cantidad.toLocaleString("es-AR")} />
                    <MiniKpi label="% del día" valor={`${sel.pct_del_dia.toFixed(2)}%`} />
                    <MiniKpi label={`Demorados (${sel.en_camino_destinatario_pct.toFixed(1)}%)`} valor={`${sel.en_camino_destinatario}`} />
                  </div>
                </div>
              )}

              <div className="max-h-[20rem] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Paquetes</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground w-28">% del día</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Demorados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtrados.map(c => (
                      <tr key={c.cliente} onClick={() => setClienteSel(c.cliente === clienteSel ? null : c.cliente)}
                        className={cn("cursor-pointer hover:bg-muted/30 transition-colors",
                          c.cliente === clienteSel && "bg-violet-50/60 dark:bg-violet-950/30")}>
                        <td className="px-4 py-1.5 truncate max-w-[10rem]">{c.cliente}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">{c.cantidad.toLocaleString("es-AR")}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <BarraProp pct={c.pct_del_dia / maxPctDia * 100} tono="blue" />
                            <span className="tabular-nums text-[10px] text-muted-foreground w-9 text-right shrink-0">{c.pct_del_dia.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {c.en_camino_destinatario > 0
                            ? <span className="font-semibold text-violet-600 dark:text-violet-300">{c.en_camino_destinatario} · {c.en_camino_destinatario_pct.toFixed(1)}%</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                    {filtrados.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sin clientes que coincidan</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Post-21 por zona y chofer */}
          <div className="grid sm:grid-cols-2 gap-4">
            <TardeTabla titulo="Post-21hs por zona" icono={MapPin} filas={tardeZonas} tono="amber" />
            <TardeTabla titulo="Post-21hs por chofer" icono={Truck} filas={tardeChoferes} tono="rose" />
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Sistema de tonos (paleta cálida y armónica) ──────────────────────────────
const TONOS = {
  blue: {
    card: "from-sky-50 to-blue-50/30 dark:from-sky-950/30 dark:to-blue-950/10 border-sky-200/70 dark:border-sky-900/50",
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  emerald: {
    card: "from-emerald-50 to-teal-50/30 dark:from-emerald-950/30 dark:to-teal-950/10 border-emerald-200/70 dark:border-emerald-900/50",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  amber: {
    card: "from-amber-50 to-orange-50/30 dark:from-amber-950/30 dark:to-orange-950/10 border-amber-200/70 dark:border-amber-900/50",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  violet: {
    card: "from-violet-50 to-fuchsia-50/30 dark:from-violet-950/30 dark:to-fuchsia-950/10 border-violet-200/70 dark:border-violet-900/50",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  rose: {
    card: "from-rose-50 to-pink-50/30 dark:from-rose-950/30 dark:to-pink-950/10 border-rose-200/70 dark:border-rose-900/50",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
  },
} as const;
type Tono = keyof typeof TONOS;

function KpiCard({ icon: Icon, label, valor, sub, tono }: {
  icon: React.ComponentType<{ className?: string }>; label: string; valor: string; sub?: React.ReactNode; tono: Tono;
}) {
  const t = TONOS[tono];
  return (
    <div className={cn("rounded-2xl p-4 border bg-gradient-to-br shadow-sm", t.card)}>
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex items-center justify-center h-7 w-7 rounded-lg", t.chip)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums mt-2", t.text)}>{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// Encabezado de sección reutilizable, con icono en chip de color
function SeccionHeader({ icon: Icon, titulo, tono = "blue", children }: {
  icon: React.ComponentType<{ className?: string }>; titulo: string; tono?: Tono; children?: React.ReactNode;
}) {
  const t = TONOS[tono];
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
      <span className={cn("inline-flex items-center justify-center h-6 w-6 rounded-md", t.chip)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="text-sm font-semibold">{titulo}</p>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

// Barra de proporción inline para celdas de tabla
function BarraProp({ pct, tono = "blue" }: { pct: number; tono?: Tono }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", TONOS[tono].bar)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function TardeTabla({ titulo, icono: Icon, filas, tono = "amber" }: {
  titulo: string; icono: React.ComponentType<{ className?: string }>; filas: TardeFila[]; tono?: Tono;
}) {
  const ordenadas = [...filas].sort((a, b) => b.cantidad - a.cantidad);
  const maxCant = Math.max(1, ...ordenadas.map(f => f.cantidad));
  return (
    <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
      <SeccionHeader icon={Icon} titulo={titulo} tono={tono} />
      <div className="max-h-72 overflow-y-auto divide-y">
        {ordenadas.map(f => (
          <div key={f.nombre} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs truncate">{f.nombre}</span>
              <span className="text-xs tabular-nums shrink-0">
                <span className="font-semibold">{f.cantidad}</span>
                <span className="text-muted-foreground"> tarde · {f.entregados} entreg. · {f.pct_efectividad.toFixed(0)}%</span>
              </span>
            </div>
            <BarraProp pct={f.cantidad / maxCant * 100} tono={tono} />
          </div>
        ))}
        {ordenadas.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Sin datos</div>
        )}
      </div>
    </div>
  );
}

// ── Vista Histórico ──────────────────────────────────────────────────────────
function HistoricoView({
  desde, setDesde, hasta, setHasta, clienteSel, setClienteSel, clientesDisponibles,
  cargando, chartGeneral, chartCliente, chartClientesTotales, totalesPeriodo, historicoCliente, ct,
}: {
  desde: string; setDesde: (v: string) => void;
  hasta: string; setHasta: (v: string) => void;
  clienteSel: string; setClienteSel: (v: string) => void;
  clientesDisponibles: string[];
  cargando: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chartGeneral: any[]; chartCliente: any[]; chartClientesTotales: any[];
  totalesPeriodo: { total: number; post21: number; enCamino: number };
  historicoCliente: HistoricoCliente[];
  ct: ReturnType<typeof useChartTheme>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap bg-muted/30 rounded-xl px-3 py-2.5 border">
        <div className="flex items-center gap-2 bg-background border rounded-lg px-2.5 py-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="text-xs bg-transparent outline-none" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="text-xs bg-transparent outline-none" />
        </div>
        <div className="flex items-center gap-2 bg-background border rounded-lg px-2.5 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <select value={clienteSel} onChange={e => setClienteSel(e.target.value)}
            className="text-xs bg-transparent outline-none min-w-44">
            <option value="">Resumen general del período</option>
            {clientesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {cargando && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {!clienteSel ? (
        <div className="space-y-5">
          {/* KPIs globales del período */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard icon={Package} label="Total paquetes del período" valor={totalesPeriodo.total.toLocaleString("es-AR")} tono="blue" />
            <KpiCard icon={Clock} label="Total post-21hs" valor={totalesPeriodo.post21.toLocaleString("es-AR")}
              sub={totalesPeriodo.total > 0 ? `${round2(totalesPeriodo.post21 / totalesPeriodo.total * 100).toFixed(2)}% del total` : undefined}
              tono="amber" />
            <KpiCard icon={Truck} label="Total demorados" valor={totalesPeriodo.enCamino.toLocaleString("es-AR")}
              sub={totalesPeriodo.total > 0 ? `${round2(totalesPeriodo.enCamino / totalesPeriodo.total * 100).toFixed(2)}% del total — post-21hs sin entregar` : undefined}
              tono="violet" />
          </div>

          {/* Paquetes totales del día */}
          <div className="border rounded-2xl p-4 bg-card shadow-sm">
            <p className="text-xs font-bold mb-2">Paquetes totales por día — y % de éxito</p>
            {chartGeneral.length === 0 ? (
              <EmptyState icon={Package} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartGeneral}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="cant" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                  <Tooltip {...ct.tooltip} />
                  <Bar yAxisId="cant" dataKey="total" name="Paquetes totales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="pctExito" name="% éxito" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Demorados / post-21hs por día */}
          <div className="border rounded-2xl p-4 bg-card shadow-sm">
            <p className="text-xs font-bold mb-2">Demorados (post-21hs) por día — cantidad y % del día</p>
            {chartGeneral.length === 0 ? (
              <EmptyState icon={Clock} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartGeneral}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="cant" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                  <Tooltip {...ct.tooltip} />
                  <Bar yAxisId="cant" dataKey="post21Total" name="Demorados (post-21hs)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="post21Pct" name="% del día" stroke="#b45309" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Demorados ("en camino al destinatario") por día */}
          <div className="border rounded-2xl p-4 bg-card shadow-sm">
            <p className="text-xs font-bold mb-2">Demorados por día — cantidad y % del día</p>
            <p className="text-[10px] text-muted-foreground mb-2">Demorado = todo lo post-21hs que no fue entregado ("en camino al destinatario")</p>
            {chartGeneral.length === 0 ? (
              <EmptyState icon={Truck} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartGeneral}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="cant" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                  <Tooltip {...ct.tooltip} />
                  <Bar yAxisId="cant" dataKey="enCaminoTotal" name="Demorados" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="enCaminoPct" name="% del día" stroke="#6d28d9" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Total de paquetes por cliente (acumulado del período) */}
          <div className="border rounded-2xl p-4 bg-card shadow-sm">
            <p className="text-xs font-bold mb-2">Paquetes totales por cliente (top 15 del período)</p>
            {chartClientesTotales.length === 0 ? (
              <EmptyState icon={Users} title="Sin datos en este rango" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, chartClientesTotales.length * 28)}>
                <ComposedChart data={chartClientesTotales} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <YAxis type="category" dataKey="cliente" width={130} tick={{ fontSize: 10, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                  <Tooltip {...ct.tooltip} labelFormatter={(_, p) => p?.[0]?.payload?.clienteCompleto ?? ""} />
                  <Bar dataKey="total" name="Paquetes totales" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="enCamino" name="Demorados" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {historicoCliente.length === 0 ? (
            <div className="border rounded-2xl p-4 bg-card shadow-sm">
              <EmptyState icon={Users} title={`Sin datos de ${clienteSel} en este rango`} />
            </div>
          ) : (() => {
            const totalPaq = historicoCliente.reduce((s, d) => s + d.cantidad, 0);
            const totalDem = historicoCliente.reduce((s, d) => s + d.en_camino_destinatario, 0);
            const pctDem = totalPaq > 0 ? round2(totalDem / totalPaq * 100) : 0;
            const pctExito = round2(100 - pctDem);
            return (
            <>
              {/* Pantallazo del cliente para el CEO */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard icon={Package} label={`Paquetes de ${clienteSel}`} valor={totalPaq.toLocaleString("es-AR")}
                  sub={`${historicoCliente.length} día(s) con envíos`} tono="blue" />
                <KpiCard icon={CheckCircle} label="% de éxito" valor={`${pctExito.toFixed(2)}%`}
                  sub="entregados a tiempo" tono="emerald" />
                <KpiCard icon={Truck} label="Paquetes demorados" valor={totalDem.toLocaleString("es-AR")}
                  sub="post-21hs sin entregar" tono="violet" />
                <KpiCard icon={Clock} label="% demorados s/ su total" valor={`${pctDem.toFixed(2)}%`}
                  sub="cuánto de lo suyo se demora" tono="amber" />
              </div>

              <div className="border rounded-2xl p-4 bg-card shadow-sm space-y-4">
                <p className="text-xs font-bold">Evolución diaria — paquetes y % demorados de {clienteSel}</p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartCliente}>
                    <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                    <YAxis yAxisId="pct" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} unit="%" />
                    <YAxis yAxisId="cant" orientation="right" tick={{ fontSize: 11, fill: ct.axis }} axisLine={{ stroke: ct.axisLine }} />
                    <Tooltip {...ct.tooltip} />
                    <Bar yAxisId="cant" dataKey="cantidad" name="Paquetes del día" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="pct" type="monotone" dataKey="enCaminoPct" name="% demorados" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>

                <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Paquetes</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Demorados</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historicoCliente.map(d => (
                    <tr key={d.fecha}>
                      <td className="px-3 py-1.5">{d.fecha}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.cantidad}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.en_camino_destinatario}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{d.en_camino_destinatario_pct.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Vista ML / Flex (informe mensual de Mercado Libre) ──────────────────────
function DeltaTexto({ delta, invertido = false }: { delta: number | null; invertido?: boolean }) {
  if (delta == null) return null;
  const bueno = invertido ? delta < 0 : delta > 0;
  return (
    <span className={cn("tabular-nums", bueno ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      {delta > 0 ? "+" : ""}{delta.toFixed(2)} pp vs promedio
    </span>
  );
}

function MlView({
  periodosMl, periodoSel, setPeriodoSel, informe, cruce, cargando,
}: {
  periodosMl: { periodo: string; volumen_total: number }[];
  periodoSel: string; setPeriodoSel: (v: string) => void;
  informe: InformeMlRow | null;
  cruce: { total: number; pctExito: number; post21Pct: number } | null;
  cargando: boolean;
}) {
  if (periodosMl.length === 0) {
    return (
      <EmptyState icon={Globe} title="Sin informes de Mercado Libre / Flex cargados"
        description={'Subí el "Deep dive mensual" (.doc) con el botón "Informe ML" para empezar a cruzar tus métricas con las de ML.'} />
    );
  }

  const geoOrdenadas = informe ? [...informe.oportunidades_geograficas].sort((a, b) => a.delta - b.delta) : [];
  const maxGeoEnvios = Math.max(1, ...geoOrdenadas.map(g => g.envios));
  const sellersBajoOrdenados = informe ? [...informe.sellers_bajo_sameday].sort((a, b) => a.share_sd - b.share_sd) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap bg-muted/30 rounded-xl px-3 py-2.5 border">
        <div className="flex items-center gap-2 bg-background border rounded-lg px-2.5 py-1.5">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <select value={periodoSel} onChange={e => setPeriodoSel(e.target.value)} className="text-xs bg-transparent outline-none">
            {periodosMl.map(p => <option key={p.periodo} value={p.periodo.slice(0, 7)}>{p.periodo.slice(0, 7)}</option>)}
          </select>
        </div>
        <span className="text-[11px] text-muted-foreground">Datos del propio reporte de Mercado Libre/Flex — comparados contra tus propios números de RutaMap para el mismo mes.</span>
        {cargando && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {!informe ? (
        <EmptyState icon={Globe} title="Sin informe para este período" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={Package} label="Volumen total (ML)" valor={informe.volumen_total.toLocaleString("es-AR")}
              sub={cruce ? `RutaMap: ${cruce.total.toLocaleString("es-AR")}` : undefined} tono="blue" />
            <KpiCard icon={ShieldAlert} label="SLA" valor={`${(informe.sla_pct ?? 0).toFixed(2)}%`}
              sub={cruce ? `Tu % éxito: ${cruce.pctExito.toFixed(2)}%` : <DeltaTexto delta={informe.sla_delta} />} tono="emerald" />
            <KpiCard icon={Clock} label="Visitas ≥21h" valor={`${(informe.visitas21_pct ?? 0).toFixed(2)}%`}
              sub={cruce ? `Tu post-21h: ${cruce.post21Pct.toFixed(2)}%` : <DeltaTexto delta={informe.visitas21_delta} invertido />} tono="amber" />
            <KpiCard icon={Truck} label="Sameday" valor={`${(informe.sameday_pct ?? 0).toFixed(2)}%`}
              sub="no medible hoy en RutaMap" tono="violet" />
            <KpiCard icon={Star} label="Perfect Delivery" valor={`${(informe.perfect_delivery_pct ?? 0).toFixed(2)}%`}
              sub="no medible hoy en RutaMap" tono="rose" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
              <SeccionHeader icon={ShieldAlert} titulo="Batallas FLEX" tono="rose" />
              <div className="divide-y max-h-72 overflow-y-auto">
                {informe.batallas.map(b => (
                  <div key={b.motivo} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs truncate">{b.motivo}</span>
                      <span className="text-xs tabular-nums shrink-0 font-semibold">
                        {b.pct.toFixed(2)}%{b.exceso_pct != null && <span className="text-muted-foreground font-normal"> · +{b.exceso_pct.toFixed(0)}% s/prom.</span>}
                      </span>
                    </div>
                    <BarraProp pct={b.pct / Math.max(1, ...informe.batallas.map(x => x.pct)) * 100} tono="rose" />
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
              <SeccionHeader icon={AlertTriangle} titulo="Motivos de visitas fallidas" tono="amber" />
              <div className="divide-y max-h-72 overflow-y-auto">
                {informe.motivos_fallidos.map(m => (
                  <div key={m.motivo} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs truncate">{m.motivo}</span>
                      <span className="text-xs tabular-nums shrink-0 font-semibold">
                        {m.pct.toFixed(2)}%{m.exceso_pct != null && <span className="text-muted-foreground font-normal"> · +{m.exceso_pct.toFixed(0)}% s/prom.</span>}
                      </span>
                    </div>
                    <BarraProp pct={m.pct / Math.max(1, ...informe.motivos_fallidos.map(x => x.pct)) * 100} tono="amber" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
            <SeccionHeader icon={MapPin} titulo="Oportunidades geográficas (peor delta vs carrier primero)" tono="blue" />
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Ciudad</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Envíos</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground w-28">SLA</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Delta vs carrier</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">% post-21h</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {geoOrdenadas.map(g => (
                    <tr key={g.ciudad}>
                      <td className="px-4 py-1.5 truncate max-w-[10rem]">{g.ciudad}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{g.envios.toLocaleString("es-AR")}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <BarraProp pct={g.envios / maxGeoEnvios * 100} tono="blue" />
                          <span className="tabular-nums text-[10px] text-muted-foreground w-9 text-right shrink-0">{g.sla.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className={cn("px-3 py-1.5 text-right tabular-nums font-semibold", g.delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                        {g.delta > 0 ? "+" : ""}{g.delta.toFixed(2)} pp
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{g.post21_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
              <SeccionHeader icon={Truck} titulo="Sellers con menor sameday" tono="violet" />
              <div className="max-h-80 overflow-y-auto divide-y">
                {sellersBajoOrdenados.slice(0, 20).map(s => (
                  <div key={s.seller_id} className="px-4 py-2 flex items-center justify-between gap-3">
                    <span className="text-xs truncate">{s.nombre}</span>
                    <span className="text-xs tabular-nums shrink-0">
                      <span className="font-semibold">{s.share_sd.toFixed(1)}%</span>
                      <span className="text-muted-foreground"> · {s.envios_sd}/{s.envios_total}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
              <SeccionHeader icon={Star} titulo="Sellers óptimos (mejor SLA)" tono="emerald" />
              <div className="max-h-80 overflow-y-auto divide-y">
                {informe.sellers_optimos.slice(0, 20).map(s => (
                  <div key={s.seller_id} className="px-4 py-2 flex items-center justify-between gap-3">
                    <span className="text-xs truncate">{s.nombre}</span>
                    <span className="text-xs tabular-nums shrink-0">
                      <span className="font-semibold">{s.sla.toFixed(2)}%</span>
                      <span className="text-muted-foreground"> · {s.envios} envíos</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(informe.sellers_oportunidad_sabado.length > 0 || informe.sellers_oportunidad_capacidad.length > 0) && (
            <div className="grid lg:grid-cols-2 gap-4">
              {informe.sellers_oportunidad_sabado.length > 0 && (
                <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                  <SeccionHeader icon={Calendar} titulo="Sellers sin operar los sábados" tono="amber" />
                  <div className="max-h-60 overflow-y-auto divide-y">
                    {informe.sellers_oportunidad_sabado.slice(0, 15).map(s => (
                      <div key={s.seller_id} className="px-4 py-2 flex items-center justify-between gap-3">
                        <span className="text-xs truncate">{s.nombre}</span>
                        <span className="text-xs tabular-nums shrink-0 text-muted-foreground">{s.envios_total} envíos/mes</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {informe.sellers_oportunidad_capacidad.length > 0 && (
                <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                  <SeccionHeader icon={Package} titulo="Sellers con upside de capacidad" tono="blue" />
                  <div className="max-h-60 overflow-y-auto divide-y">
                    {informe.sellers_oportunidad_capacidad.slice(0, 15).map(s => (
                      <div key={s.seller_id} className="px-4 py-2 flex items-center justify-between gap-3">
                        <span className="text-xs truncate">{s.nombre}</span>
                        <span className="text-xs tabular-nums shrink-0 font-semibold">+{s.upside_pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
