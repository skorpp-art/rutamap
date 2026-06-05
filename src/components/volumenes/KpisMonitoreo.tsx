"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Activity, Save, Timer, CheckCircle2, RotateCcw, AlertTriangle, Settings2 } from "lucide-react";
import {
  getKpisDiarios, getKpiDia, upsertKpiDiario,
  type KpiDia, type KpiForm,
} from "@/app/actions/kpis";
import { PALETA } from "@/lib/estados";

function hoy() { return new Date().toISOString().slice(0, 10); }

// Objetivos por defecto (ajustables, se guardan en el navegador)
const TARGETS_DEFAULT = { carga: 45, termino: 91, devol: 5 };
function leerTargets() {
  if (typeof window === "undefined") return TARGETS_DEFAULT;
  try {
    const raw = localStorage.getItem("rutamap_kpi_targets");
    return raw ? { ...TARGETS_DEFAULT, ...JSON.parse(raw) } : TARGETS_DEFAULT;
  } catch { return TARGETS_DEFAULT; }
}

type Estado = "ok" | "alerta" | "malo" | "sin";

function colorEstado(e: Estado) {
  return e === "ok" ? PALETA.verde : e === "alerta" ? PALETA.ambar : e === "malo" ? PALETA.rojo : PALETA.gris;
}

export function KpisMonitoreo() {
  const [kpis, setKpis] = useState<KpiDia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [targets, setTargets] = useState(TARGETS_DEFAULT);
  const [editTargets, setEditTargets] = useState(false);

  // Formulario
  const [fecha, setFecha] = useState(hoy());
  const [form, setForm] = useState<KpiForm>({
    fecha: hoy(), carga_playon_min: null, pct_en_termino: null,
    total_despachado: null, devoluciones: null, incidencias: null, notas: null,
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setTargets(leerTargets()); }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getKpisDiarios(45);
      if (res.ok && res.data) setKpis(res.data);
    } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // Cargar el KPI de la fecha seleccionada en el formulario
  const cargarFecha = useCallback(async (f: string) => {
    const res = await getKpiDia(f);
    if (res.ok) {
      setForm(res.data
        ? { ...res.data, fecha: f }
        : { fecha: f, carga_playon_min: null, pct_en_termino: null, total_despachado: null, devoluciones: null, incidencias: null, notas: null });
    }
  }, []);
  useEffect(() => { cargarFecha(fecha); }, [fecha, cargarFecha]);

  async function guardar() {
    setGuardando(true);
    try {
      const res = await upsertKpiDiario({ ...form, fecha });
      if (!res.ok) { toast.error("Error al guardar", { description: res.error }); return; }
      toast.success(`KPIs del ${fecha} guardados`);
      await cargar();
    } finally { setGuardando(false); }
  }

  function guardarTargets(t: typeof TARGETS_DEFAULT) {
    setTargets(t);
    try { localStorage.setItem("rutamap_kpi_targets", JSON.stringify(t)); } catch {}
  }

  // Estado de cada métrica
  const estCarga = (v: number | null): Estado => v == null ? "sin" : v <= targets.carga ? "ok" : v <= targets.carga * 1.2 ? "alerta" : "malo";
  const estTermino = (v: number | null): Estado => v == null ? "sin" : v >= targets.termino ? "ok" : v >= targets.termino - 5 ? "alerta" : "malo";
  const estDevol = (v: number | null): Estado => v == null ? "sin" : v <= targets.devol ? "ok" : v <= targets.devol * 1.5 ? "alerta" : "malo";

  // Último día con datos
  const ultimo = kpis[kpis.length - 1] ?? null;

  // Datos para gráficos
  const chartData = kpis.map(k => ({
    dia: k.fecha.slice(5),
    carga: k.carga_playon_min ?? undefined,
    termino: k.pct_en_termino != null ? Number(k.pct_en_termino) : undefined,
    devol: k.pct_devoluciones != null ? Number(k.pct_devoluciones) : undefined,
  }));

  const num = (v: number | null | undefined, suf = "") => v == null ? "—" : `${v}${suf}`;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold">Monitoreo general · KPIs</h2>
            <p className="text-xs text-muted-foreground">Carga del playón, entregas en término y devoluciones. Cargá un día y seguí la tendencia.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-xs h-8" onClick={() => setEditTargets(v => !v)}>
          <Settings2 className="h-3.5 w-3.5" /> Objetivos
        </Button>
      </div>

      {/* Editor de objetivos */}
      {editTargets && (
        <div className="border rounded-xl p-4 bg-slate-50 flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Carga playón (máx min)</label>
            <input type="number" value={targets.carga}
              onChange={e => guardarTargets({ ...targets, carga: parseInt(e.target.value) || 0 })}
              className="w-24 border rounded-lg px-2 py-1.5 text-sm mt-1 block bg-background" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Entregas en término (mín %)</label>
            <input type="number" value={targets.termino}
              onChange={e => guardarTargets({ ...targets, termino: parseInt(e.target.value) || 0 })}
              className="w-24 border rounded-lg px-2 py-1.5 text-sm mt-1 block bg-background" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Devoluciones (máx %)</label>
            <input type="number" value={targets.devol}
              onChange={e => guardarTargets({ ...targets, devol: parseInt(e.target.value) || 0 })}
              className="w-24 border rounded-lg px-2 py-1.5 text-sm mt-1 block bg-background" />
          </div>
          <p className="text-[10px] text-muted-foreground">Se guardan en este navegador.</p>
        </div>
      )}

      {/* Tarjetas del último día */}
      {ultimo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={<Timer className="h-4 w-4" />} label="Carga playón"
            valor={num(ultimo.carga_playon_min, " min")} estado={estCarga(ultimo.carga_playon_min)}
            objetivo={`obj ≤ ${targets.carga} min`} />
          <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="En término"
            valor={num(ultimo.pct_en_termino, "%")} estado={estTermino(ultimo.pct_en_termino)}
            objetivo={`obj ≥ ${targets.termino}%`} />
          <KpiCard icon={<RotateCcw className="h-4 w-4" />} label="Devoluciones"
            valor={num(ultimo.pct_devoluciones, "%")} estado={estDevol(ultimo.pct_devoluciones)}
            objetivo={`obj ≤ ${targets.devol}% · ${num(ultimo.devoluciones)} dev`} />
          <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Incidencias"
            valor={num(ultimo.incidencias)} estado={ultimo.incidencias == null ? "sin" : ultimo.incidencias === 0 ? "ok" : ultimo.incidencias <= 3 ? "alerta" : "malo"}
            objetivo={ultimo.fecha} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Formulario de carga */}
        <div className="border rounded-xl p-4 bg-background space-y-3">
          <div className="flex items-center gap-2">
            <input type="date" value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm bg-background flex-1" />
          </div>
          <Campo label="Tiempo de carga en playón (min)" valor={form.carga_playon_min}
            onChange={v => setForm(f => ({ ...f, carga_playon_min: v }))} />
          <Campo label="Entregas en término (%)" valor={form.pct_en_termino} max={100}
            onChange={v => setForm(f => ({ ...f, pct_en_termino: v }))} />
          <Campo label="Total despachado (paq)" valor={form.total_despachado}
            onChange={v => setForm(f => ({ ...f, total_despachado: v }))} />
          <Campo label="Devoluciones (cantidad)" valor={form.devoluciones}
            onChange={v => setForm(f => ({ ...f, devoluciones: v }))} />
          <Campo label="Incidencias" valor={form.incidencias}
            onChange={v => setForm(f => ({ ...f, incidencias: v }))} />
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Notas</label>
            <textarea value={form.notas ?? ""} rows={2}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value || null }))}
              placeholder="Observaciones del día…"
              className="w-full border rounded-lg px-2 py-1.5 text-sm mt-1 bg-background resize-none" />
          </div>
          {form.total_despachado && form.devoluciones != null && form.total_despachado > 0 && (
            <p className="text-[11px] text-muted-foreground">
              % devoluciones: <strong>{(form.devoluciones / form.total_despachado * 100).toFixed(2)}%</strong>
            </p>
          )}
          <Button onClick={guardar} disabled={guardando} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-3.5 w-3.5" /> {guardando ? "Guardando…" : "Guardar KPIs del día"}
          </Button>
        </div>

        {/* Tendencias */}
        <div className="lg:col-span-2 space-y-4">
          {chartData.length === 0 ? (
            <div className="border rounded-xl p-10 text-center text-sm text-muted-foreground bg-background">
              Todavía no hay KPIs cargados. Empezá cargando el día de hoy en el formulario.
            </div>
          ) : (
            <>
              <MiniChart titulo="Carga del playón (min)" data={chartData} dataKey="carga"
                target={targets.carga} targetMode="max" color={PALETA.azul} />
              <MiniChart titulo="Entregas en término (%)" data={chartData} dataKey="termino"
                target={targets.termino} targetMode="min" color={PALETA.verde} dominio={[0, 100]} />
              <MiniChart titulo="Devoluciones (%)" data={chartData} dataKey="devol"
                target={targets.devol} targetMode="max" color={PALETA.rojo} />
            </>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {cargando ? "Cargando…" : `${kpis.length} días con KPIs en los últimos 45 días.`}
      </p>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────
function KpiCard({ icon, label, valor, estado, objetivo }: {
  icon: React.ReactNode; label: string; valor: string; estado: Estado; objetivo: string;
}) {
  const c = colorEstado(estado);
  return (
    <div className="border rounded-xl p-3 bg-background" style={{ borderColor: estado === "sin" ? undefined : c + "55" }}>
      <div className="flex items-center gap-1.5 text-muted-foreground" style={{ color: estado === "sin" ? undefined : c }}>
        {icon}
        <span className="text-[10px] uppercase font-bold tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black tabular-nums mt-1" style={{ color: estado === "sin" ? undefined : c }}>{valor}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{objetivo}</p>
    </div>
  );
}

function Campo({ label, valor, onChange, max }: {
  label: string; valor: number | null; onChange: (v: number | null) => void; max?: number;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</label>
      <input type="number" min={0} max={max} value={valor ?? ""}
        placeholder="—"
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full border rounded-lg px-2 py-1.5 text-sm mt-1 bg-background tabular-nums" />
    </div>
  );
}

function MiniChart({ titulo, data, dataKey, target, targetMode, color, dominio }: {
  titulo: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]; dataKey: string; target: number; targetMode: "min" | "max"; color: string;
  dominio?: [number, number];
}) {
  return (
    <div className="border rounded-xl p-4 bg-background">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <span className="text-[10px] text-muted-foreground">
          objetivo {targetMode === "min" ? "≥" : "≤"} {target}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9 }} domain={dominio ?? [0, "auto"]} />
          <Tooltip formatter={(v) => [v, titulo]} />
          <ReferenceLine y={target} stroke={targetMode === "min" ? PALETA.verde : PALETA.rojo} strokeDasharray="4 3" strokeWidth={1.5} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
            dot={{ r: 3, fill: color }} connectNulls name={titulo} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
