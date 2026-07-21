"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getPost21Recorridos, getPost21Clientes,
  type Post21Recorrido, type Post21Cliente,
} from "@/app/actions/analisis-diario";

const ZONA_COLOR: Record<string, string> = {
  OESTE: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  NORTE: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  SUR: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  CABA: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

export function Post21Recorridos() {
  const [dias, setDias] = useState(30);
  const [cliente, setCliente] = useState<string>("");
  const [clientes, setClientes] = useState<Post21Cliente[]>([]);
  const [data, setData] = useState<Post21Recorrido[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (d: number, cli: string) => {
    setCargando(true);
    try {
      const res = await getPost21Recorridos(d, cli || null);
      setData(res.ok ? (res.data ?? []) : []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(dias, cliente); }, [dias, cliente, cargar]);
  // Lista de clientes para el desplegable (depende del período)
  useEffect(() => {
    getPost21Clientes(dias).then(r => { if (r.ok) setClientes(r.data ?? []); });
  }, [dias]);

  const totalGeneral = data.reduce((s, r) => s + r.total_post21, 0);
  const maxTotal = Math.max(1, ...data.map(r => r.total_post21));

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {[14, 30, 60].map(d => (
            <button key={d} onClick={() => setDias(d)}
              className={cn("text-[11px] px-2.5 py-1 rounded border transition-colors",
                dias === d ? "bg-slate-700 text-white border-slate-700" : "border-border text-muted-foreground hover:bg-muted")}>
              {d} días
            </button>
          ))}
        </div>
        <button onClick={() => cargar(dias, cliente)} disabled={cargando}
          className="p-1.5 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", cargando && "animate-spin")} />
        </button>
        {/* Filtro por cliente */}
        <select value={cliente} onChange={e => setCliente(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 bg-background max-w-56">
          <option value="">Todos los clientes</option>
          {clientes.map(c => (
            <option key={c.cliente} value={c.cliente}>{c.cliente} ({c.total})</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {data.length} recorridos · <b className="text-foreground">{totalGeneral.toLocaleString("es-AR")}</b> paquetes post-21hs
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        <span>
          Paquetes sin entregar después de las 21hs, acumulados por recorrido en los últimos {dias} días, de mayor a menor.
          {cliente ? <> Filtrado por <b>{cliente}</b>: qué recorridos le dejan más post-21hs.</> : null}
          {" "}El código sale de cruzar el chofer con Carga del Día; si no coincide, aparece "—".
        </span>
      </p>

      {data.length === 0 && !cargando ? (
        <EmptyState icon={Clock} title="Sin datos de post-21hs"
          description="Cargá los reportes de Análisis del Día (Análisis Tarde) para ver este ranking." />
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-8">#</th>
                <th className="text-left px-3 py-2 font-medium">Código</th>
                <th className="text-left px-3 py-2 font-medium">Chofer</th>
                <th className="text-left px-2 py-2 font-medium">Zona</th>
                <th className="text-right px-3 py-2 font-medium">Post-21hs</th>
                <th className="text-right px-2 py-2 font-medium">Días</th>
                <th className="text-right px-2 py-2 font-medium">Prom/día</th>
                <th className="text-right px-2 py-2 font-medium">Pico</th>
                <th className="text-right px-3 py-2 font-medium">Último</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r, i) => (
                <tr key={`${r.chofer}-${r.codigo}`} className="hover:bg-accent/20">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 font-mono font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">{r.codigo}</td>
                  <td className="px-3 py-2 font-medium">{r.chofer}</td>
                  <td className="px-2 py-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", ZONA_COLOR[r.zona?.toUpperCase()] ?? "bg-muted text-muted-foreground")}>
                      {r.zona}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                        <div className="h-full bg-amber-500" style={{ width: `${r.total_post21 / maxTotal * 100}%` }} />
                      </div>
                      <span className="font-bold tabular-nums text-amber-700 dark:text-amber-300 w-10">{r.total_post21.toLocaleString("es-AR")}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.dias}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.prom_x_dia}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.max_dia}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {new Date(r.ultimo_dia + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
