"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRange, Wand2, RefreshCw, History, ArrowRight, Info } from "lucide-react";
import {
  getPlantillasSemanales,
  upsertPlantillaSemanal,
  upsertFactorSemana,
  seedPlantillasDesdeHistorico,
  type PlantillaCelda,
} from "@/app/actions/volumenes";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const SEMANAS: { n: number; label: string; sub: string }[] = [
  { n: 1, label: "Semana 1", sub: "Tarjetas" },
  { n: 2, label: "Semana 2", sub: "Sueldos" },
  { n: 3, label: "Semana 3", sub: "Baja" },
  { n: 4, label: "Semana 4", sub: "Normal" },
  { n: 5, label: "Semana 5", sub: "Cierre mes" },
];

function key(s: number, d: number) { return `${s}-${d}`; }

interface Props {
  /** Lleva el valor elegido a la Operación del Día */
  onUsarValor?: (paquetes: number) => void;
}

export function PlantillasSemanales({ onUsarValor }: Props) {
  const [celdas, setCeldas] = useState<PlantillaCelda[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [factores, setFactores] = useState<Record<number, number | null>>({});
  const [cargando, setCargando] = useState(false);
  const [sembrando, setSembrando] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardandoFactor, setGuardandoFactor] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getPlantillasSemanales();
      if (res.ok && res.data) {
        setCeldas(res.data);
        const v: Record<string, number> = {};
        const f: Record<number, number | null> = {};
        res.data.forEach((c) => {
          v[key(c.semana_mes, c.dia_semana)] = c.paquetes_base;
          f[c.semana_mes] = c.factor_semana;
        });
        setValores(v);
        setFactores(f);
      } else {
        toast.error("Error al cargar plantillas", { description: res.error });
      }
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function celda(s: number, d: number): PlantillaCelda | undefined {
    return celdas.find((c) => c.semana_mes === s && c.dia_semana === d);
  }

  async function guardarCelda(s: number, d: number, valor: number) {
    const c = celda(s, d);
    if (c && c.paquetes_base === valor) return; // sin cambios
    setGuardando(key(s, d));
    try {
      const res = await upsertPlantillaSemanal(s, d, valor, c?.rutas_sugeridas ?? null, c?.notas ?? null);
      if (!res.ok) { toast.error("No se pudo guardar", { description: res.error }); return; }
      setCeldas((prev) => prev.map((x) =>
        x.semana_mes === s && x.dia_semana === d ? { ...x, paquetes_base: valor } : x
      ));
    } finally { setGuardando(null); }
  }

  async function guardarFactor(s: number, raw: string) {
    const valor = raw.trim() === "" ? null : Number(raw);
    if (valor !== null && Number.isNaN(valor)) return;
    if (factores[s] === valor) return; // sin cambios
    setGuardandoFactor(s);
    try {
      const res = await upsertFactorSemana(s, valor);
      if (!res.ok) { toast.error("No se pudo guardar el %", { description: res.error }); return; }
      setFactores((prev) => ({ ...prev, [s]: valor }));
    } finally { setGuardandoFactor(null); }
  }

  async function sembrar() {
    setSembrando(true);
    try {
      const res = await seedPlantillasDesdeHistorico();
      if (!res.ok) { toast.error("Error", { description: res.error }); return; }
      toast.success(`${res.celdas ?? 0} celdas cargadas desde el promedio histórico`);
      await cargar();
    } finally { setSembrando(false); }
  }

  // Totales por columna (día) y por fila (semana)
  function totalSemana(s: number) {
    return DIAS.reduce((acc, _, i) => acc + (valores[key(s, i + 1)] || 0), 0);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          <div>
            <h2 className="text-sm font-bold">Plantillas semanales</h2>
            <p className="text-xs text-muted-foreground">
              Volumen base pre-definido por semana del mes y día. Es tu punto de partida — después ajustás cada día.
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={sembrar} disabled={sembrando}>
            <Wand2 className={cn("h-3.5 w-3.5", sembrando && "animate-pulse")} />
            {sembrando ? "Cargando…" : "Auto-cargar desde histórico"}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cargar} disabled={cargando}>
            <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-800" />
          Valor base editable
        </span>
        <span className="flex items-center gap-1.5">
          <History className="h-3 w-3 text-slate-400 dark:text-slate-500" /> hist = promedio histórico real (clic para copiar)
        </span>
        <span>Estacionalidad ya aplicada por la proyección — acá cargás el volumen real esperado.</span>
      </div>

      {/* Aviso % manual */}
      <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          El <strong>% por semana</strong> ahora se ingresa manualmente — dejá el campo vacío si todavía es ambiguo.
          Recién tiene sentido calcularlo en automático cuando haya ~3 meses de datos guardados.
        </span>
      </div>

      {/* Grilla */}
      <div className="border rounded-xl overflow-x-auto bg-background">
        <table className="w-full text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-muted/30 border-b">
              <th className="text-left px-3 py-2.5 font-semibold w-32 sticky left-0 bg-muted/30">Semana</th>
              {DIAS.map((d) => (
                <th key={d} className="px-2 py-2.5 font-semibold text-center">{d}</th>
              ))}
              <th className="px-3 py-2.5 font-semibold text-center text-muted-foreground">Total sem.</th>
            </tr>
          </thead>
          <tbody>
            {SEMANAS.map((sem) => (
              <tr key={sem.n} className="border-b last:border-0 hover:bg-accent/10">
                {/* Etiqueta de semana */}
                <td className="px-3 py-2 sticky left-0 bg-background">
                  <div className="font-semibold">{sem.label}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{sem.sub}</span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        step="1"
                        placeholder="—"
                        defaultValue={factores[sem.n] ?? ""}
                        onBlur={(e) => guardarFactor(sem.n, e.target.value)}
                        title="% manual de esta semana (vacío = sin dato suficiente)"
                        className={cn(
                          "w-12 text-[10px] font-bold px-1 py-px rounded border text-center tabular-nums",
                          "focus:outline-none focus:ring-1 focus:ring-blue-400",
                          guardandoFactor === sem.n && "ring-1 ring-emerald-400",
                          (factores[sem.n] ?? 0) > 0 ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : (factores[sem.n] ?? 0) < 0 ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        )}
                      />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                  </div>
                </td>

                {/* Celdas por día */}
                {DIAS.map((_, i) => {
                  const d = i + 1;
                  const c = celda(sem.n, d);
                  const k = key(sem.n, d);
                  const val = valores[k] ?? 0;
                  const hist = c?.prom_historico ?? 0;
                  const regs = c?.registros ?? 0;
                  return (
                    <td key={d} className="px-1.5 py-1.5 text-center align-top">
                      <input
                        type="number"
                        min={0}
                        value={val || ""}
                        placeholder="0"
                        onChange={(e) => setValores((p) => ({ ...p, [k]: parseInt(e.target.value) || 0 }))}
                        onBlur={(e) => guardarCelda(sem.n, d, parseInt(e.target.value) || 0)}
                        className={cn(
                          "w-16 text-center border rounded-md px-1 py-1.5 text-sm font-semibold tabular-nums bg-blue-50/40 dark:bg-blue-950/40",
                          "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-background",
                          guardando === k && "ring-2 ring-emerald-400"
                        )}
                      />
                      {/* Histórico */}
                      <button
                        type="button"
                        disabled={hist <= 0}
                        onClick={() => { setValores((p) => ({ ...p, [k]: hist })); guardarCelda(sem.n, d, hist); }}
                        title={hist > 0 ? `Copiar promedio histórico (${regs} ${regs === 1 ? "registro" : "registros"})` : "Sin histórico"}
                        className={cn(
                          "mt-1 block mx-auto text-[10px] tabular-nums transition-colors",
                          hist > 0 ? "text-slate-400 dark:text-slate-500 hover:text-blue-600 cursor-pointer" : "text-slate-300 dark:text-slate-600 cursor-default"
                        )}
                      >
                        hist {hist > 0 ? hist.toLocaleString("es-AR") : "—"}
                      </button>
                      {/* Usar */}
                      {val > 0 && onUsarValor && (
                        <button
                          type="button"
                          onClick={() => onUsarValor(val)}
                          title="Usar este valor en Operación del Día"
                          className="mt-0.5 mx-auto flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 font-medium"
                        >
                          usar <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </td>
                  );
                })}

                {/* Total semana */}
                <td className="px-3 py-2 text-center font-bold tabular-nums text-blue-700 dark:text-blue-300">
                  {totalSemana(sem.n).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Se guarda solo al salir de cada casilla. La <strong>semana del mes</strong> se calcula como el día ÷ 7
        (días 1–7 = semana 1, 8–14 = semana 2, etc.), igual que la proyección.
      </p>
    </div>
  );
}
