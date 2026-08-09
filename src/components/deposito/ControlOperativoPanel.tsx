"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Package, Search, RefreshCw, ChevronLeft, ChevronRight, Boxes,
  TrendingUp, Calendar, AlertTriangle, Clock, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { hoyAR } from "@/lib/fechas";
import {
  ESTADO_BULTO_LABEL, estaEnDeposito, fechaVerosimil,
  type EstadoBulto, type Remito,
} from "@/types/deposito.types";

const POR_PAGINA = 25;
const DIAS_ANTIGUO = 3;   // ya conviene mirarlo
const DIAS_CRITICO = 7;   // ya hay que llamar al cliente

interface FilaBulto {
  id: string;
  client_id: string;
  description: string | null;
  barcode: string | null;
  tracking_id: string | null;
  status: EstadoBulto;
  entry_date: string;
  scheduled_return_date: string | null;
  actual_return_date: string | null;
  remito_number: number | null;
  deleted_at: string | null;
  clients: { name: string } | null;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function fmt(d: string | null): string {
  if (!d || !fechaVerosimil(d)) return "—";
  const [a, m, dd] = d.split("-");
  return `${dd}/${m}`;
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86_400_000);
}

function primerDiaDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function ControlOperativoPanel() {
  const [bultos, setBultos] = useState<FilaBulto[]>([]);
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"metricas" | "bultos">("metricas");

  const [desde, setDesde] = useState(primerDiaDelMes);
  const [hasta, setHasta] = useState(hoyAR);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "en_deposito" | EstadoBulto>("en_deposito");
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      const [{ data }, { data: rs }] = await Promise.all([
        supabase.from("bultos").select("*, clients(name)")
          .order("entry_date", { ascending: false }),
        supabase.from("remitos").select("id, numero, client_id, cliente_nombre, fecha, cantidad")
          .order("fecha", { ascending: false }),
      ]);
      setBultos((data ?? []) as unknown as FilaBulto[]);
      setRemitos((rs ?? []) as Remito[]);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Métricas del período ────────────────────────────────────────────────────
  const metricas = useMemo(() => {
    // Una "salida" es un remito, no un bulto: si un cliente se lleva 12 bultos
    // juntos, eso es una sola operación.
    const delPeriodo = remitos.filter(r => r.fecha >= desde && r.fecha <= hasta);
    const porFecha = new Map<string, number>();
    for (const r of delPeriodo) porFecha.set(r.fecha, (porFecha.get(r.fecha) ?? 0) + 1);
    const salidasPorFecha = [...porFecha.entries()].map(([fecha, cantidad]) => ({ fecha, cantidad }));
    const totalSalidas = delPeriodo.length;
    const bultosRetirados = delPeriodo.reduce((s, r) => s + r.cantidad, 0);

    // Días hábiles transcurridos del rango (no cuenta el futuro).
    const finEfectivo = hasta > hoyAR() ? hoyAR() : hasta;
    let habiles = 0;
    const cur = new Date(desde + "T12:00:00");
    const fin = new Date(finEfectivo + "T12:00:00");
    while (cur <= fin) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) habiles++;
      cur.setDate(cur.getDate() + 1);
    }

    const pico = salidasPorFecha.reduce<{ fecha: string; cantidad: number }>(
      (max, d) => d.cantidad > max.cantidad ? d : max, { fecha: "—", cantidad: 0 });

    const enDeposito = bultos.filter(b => b.deleted_at === null && estaEnDeposito(b.status));

    const porCliente = new Map<string, { nombre: string; cantidad: number }>();
    for (const b of enDeposito) {
      const nombre = b.clients?.name ?? "Sin cliente";
      const c = porCliente.get(b.client_id) ?? { nombre, cantidad: 0 };
      c.cantidad++;
      porCliente.set(b.client_id, c);
    }

    const conFecha = enDeposito.filter(b => fechaVerosimil(b.entry_date));
    const antiguos = conFecha.filter(b => diasDesde(b.entry_date) > DIAS_ANTIGUO);
    const criticos = conFecha.filter(b => diasDesde(b.entry_date) > DIAS_CRITICO);

    const criticosPorCliente = new Map<string, { nombre: string; cantidad: number }>();
    for (const b of criticos) {
      const nombre = b.clients?.name ?? "Sin cliente";
      const c = criticosPorCliente.get(b.client_id) ?? { nombre, cantidad: 0 };
      c.cantidad++;
      criticosPorCliente.set(b.client_id, c);
    }

    return {
      bultosRetirados,
      totalSalidas,
      promedioDiario: habiles > 0 ? (totalSalidas / habiles).toFixed(1) : "0",
      habiles,
      pico,
      diasActivos: salidasPorFecha.sort((a, b) => b.cantidad - a.cantidad).slice(0, 7),
      enDeposito: enDeposito.length,
      distribucion: [...porCliente.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8),
      antiguos: antiguos.length,
      criticos: criticos.length,
      criticosPorCliente: [...criticosPorCliente.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 6),
    };
  }, [bultos, remitos, desde, hasta]);

  // ── Listado ────────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    const q = norm(busqueda);
    return bultos
      .filter(b => b.deleted_at === null)
      .filter(b => filtroEstado === "todos"
        || (filtroEstado === "en_deposito" ? estaEnDeposito(b.status) : b.status === filtroEstado))
      .filter(b => !q
        || norm(b.tracking_id ?? "").includes(q)
        || norm(b.barcode ?? "").includes(q)
        || norm(b.description ?? "").includes(q)
        || norm(b.clients?.name ?? "").includes(q));
  }, [bultos, busqueda, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado]);

  const maxDia = Math.max(1, ...metricas.diasActivos.map(d => d.cantidad));
  const maxCliente = Math.max(1, ...metricas.distribucion.map(d => d.cantidad));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-5 space-y-4">
        <PageHeader
          titulo="Control operativo"
          desc="Cuánto sale del depósito, a qué ritmo y qué se está quedando adentro."
          meta={`${metricas.enDeposito} bultos en depósito`}
        />

        {/* ── Barra ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            {([["metricas", "Métricas"], ["bultos", "Bultos"]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setVista(k)}
                className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                  vista === k ? "bg-background" : "text-muted-foreground hover:text-foreground")}>
                {lbl}
              </button>
            ))}
          </div>
          {vista === "metricas" ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Desde</span>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 bg-background" />
                <span className="text-xs text-muted-foreground">hasta</span>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 bg-background" />
              </div>
              <span className="text-xs text-muted-foreground">
                {metricas.habiles} día{metricas.habiles !== 1 ? "s" : ""} hábil{metricas.habiles !== 1 ? "es" : ""}
              </span>
            </>
          ) : (
            <>
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por tracking, descripción o cliente…"
                  className="w-full text-xs pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
                className="text-xs border rounded-lg px-2 py-2 bg-background">
                <option value="en_deposito">En depósito</option>
                <option value="todos">Todos</option>
                {(Object.keys(ESTADO_BULTO_LABEL) as EstadoBulto[])
                  .filter(s => s !== "deleted")
                  .map(s => <option key={s} value={s}>{ESTADO_BULTO_LABEL[s]}</option>)}
              </select>
            </>
          )}
          <button onClick={cargar} disabled={cargando}
            className="p-2 rounded-lg border hover:bg-muted/40 transition-colors ml-auto" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
        </div>

        {vista === "metricas" ? (
          <>
            {/* ── Números del período ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Salidas del período", valor: metricas.totalSalidas, icon: TrendingUp,
                  sub: `${metricas.bultosRetirados} bultos retirados` },
                { label: "Promedio diario", valor: metricas.promedioDiario, icon: Calendar,
                  sub: "salidas por día hábil" },
                { label: "Día pico", valor: metricas.pico.cantidad, icon: Boxes,
                  sub: metricas.pico.fecha !== "—" ? fmt(metricas.pico.fecha) : "sin datos" },
                { label: `Más de ${DIAS_CRITICO} días`, valor: metricas.criticos, icon: AlertTriangle,
                  sub: `${metricas.antiguos} con más de ${DIAS_ANTIGUO}`,
                  alerta: metricas.criticos > 0 },
              ].map(m => (
                <div key={m.label} className={cn("border rounded-lg p-4",
                  m.alerta ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/50" : "bg-card")}>
                  <div className="flex items-center gap-2">
                    <m.icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{m.label}</p>
                  </div>
                  <p className={cn("text-2xl font-bold tabular-nums mt-1",
                    m.alerta && "text-amber-700 dark:text-amber-300")}>{m.valor}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ── Días de más movimiento ── */}
              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Días de más salidas</p>
                </div>
                {metricas.diasActivos.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                    No hubo salidas en el período elegido.
                  </p>
                ) : (
                  <div className="p-4 space-y-1.5">
                    {metricas.diasActivos.map(d => (
                      <div key={d.fecha} className="flex items-center gap-2 text-xs">
                        <span className="w-12 shrink-0 text-muted-foreground tabular-nums">{fmt(d.fecha)}</span>
                        <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${d.cantidad / maxDia * 100}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums font-semibold">{d.cantidad}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Quién ocupa el depósito ── */}
              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Quién ocupa el depósito</p>
                </div>
                {metricas.distribucion.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">El depósito está vacío.</p>
                ) : (
                  <div className="p-4 space-y-1.5">
                    {metricas.distribucion.map(c => (
                      <div key={c.nombre} className="flex items-center gap-2 text-xs">
                        <span className="w-32 shrink-0 truncate">{c.nombre}</span>
                        <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${c.cantidad / maxCliente * 100}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums font-semibold">{c.cantidad}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── A quién hay que llamar ── */}
            {metricas.criticosPorCliente.length > 0 && (
              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold">
                    Clientes con bultos de más de {DIAS_CRITICO} días
                  </p>
                </div>
                <div className="divide-y">
                  {metricas.criticosPorCliente.map(c => (
                    <div key={c.nombre} className="px-4 py-2.5 text-xs flex items-center gap-2">
                      <span className="font-medium truncate flex-1">{c.nombre}</span>
                      <span className="font-bold tabular-nums text-amber-700 dark:text-amber-300">
                        {c.cantidad}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Listado de bultos ── */
          visibles.length === 0 && !cargando ? (
            <EmptyState icon={Package} title="Ningún bulto coincide"
              description="Probá con otro texto o cambiá el filtro de estado." />
          ) : (
            <>
              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20 border-b">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium text-muted-foreground">Cliente</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Tracking</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Descripción</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Ingreso</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground text-right">Días</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visibles.map(b => {
                        const dias = fechaVerosimil(b.entry_date) && estaEnDeposito(b.status)
                          ? diasDesde(b.entry_date) : null;
                        return (
                          <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2">
                              <Link href={`/deposito/clientes/${b.client_id}`}
                                className="hover:underline truncate block max-w-[200px]">
                                {b.clients?.name ?? "Sin cliente"}
                              </Link>
                            </td>
                            <td className="px-3 py-2 font-mono text-muted-foreground/90">
                              {b.tracking_id || b.barcode || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span className="truncate block max-w-[240px]">{b.description || "—"}</span>
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmt(b.entry_date)}</td>
                            <td className={cn("px-3 py-2 text-right tabular-nums",
                              dias != null && dias > DIAS_CRITICO ? "text-amber-700 dark:text-amber-300 font-semibold"
                                : "text-muted-foreground")}>
                              {dias ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {ESTADO_BULTO_LABEL[b.status] ?? b.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPaginas > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {paginaActual} de {totalPaginas} · {filtrados.length} bultos
                  </span>
                  <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
