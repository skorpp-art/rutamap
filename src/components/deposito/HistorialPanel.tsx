"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  History, Search, FileText, Calendar, Printer, ChevronDown, ChevronRight,
  RefreshCw, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { imprimirRemito } from "@/lib/deposito/remito";
import { ESTADO_BULTO_LABEL, type EstadoBulto } from "@/types/deposito.types";

const SELECT =
  "id, client_id, description, tracking_id, barcode, entry_date, actual_return_date, " +
  "status, remito_number, destination_address, destination_locality, clients(name, nombre_fantasia)";

interface BultoDevuelto {
  id: string;
  client_id: string;
  description: string | null;
  tracking_id: string | null;
  barcode: string | null;
  entry_date: string;
  actual_return_date: string | null;
  status: EstadoBulto;
  remito_number: number | null;
  destination_address: string | null;
  destination_locality: string | null;
  clients: { name: string; nombre_fantasia: string | null } | null;
}

// Un remito es una devolución: el grupo de bultos que salió junto. Los remitos
// viejos no tienen número, así que ahí se agrupa por cliente + fecha de salida.
interface Remito {
  key: string;
  clientId: string;
  cliente: string;
  fecha: string;
  numero: number | null;
  bultos: BultoDevuelto[];
}

function fmt(d: string | null): string {
  if (!d) return "—";
  const [a, m, dd] = d.split("-");
  return dd ? `${dd}/${m}/${a}` : d;
}

function agrupar(bultos: BultoDevuelto[]): Remito[] {
  const m = new Map<string, Remito>();
  for (const b of bultos) {
    const fecha = b.actual_return_date ?? "";
    const key = b.remito_number != null ? `r${b.remito_number}` : `${b.client_id}-${fecha}`;
    const cliente = b.clients?.nombre_fantasia
      ? `${b.clients.nombre_fantasia} (${b.clients.name})`
      : b.clients?.name ?? "Sin cliente";
    if (!m.has(key)) {
      m.set(key, { key, clientId: b.client_id, cliente, fecha, numero: b.remito_number, bultos: [] });
    }
    m.get(key)!.bultos.push(b);
  }
  return [...m.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function HistorialPanel() {
  const [recientes, setRecientes] = useState<BultoDevuelto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  // Búsqueda de devoluciones anteriores
  const [nombre, setNombre] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [resultados, setResultados] = useState<BultoDevuelto[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      const desde30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase.from("bultos").select(SELECT)
        .eq("status", "returned")
        .gte("actual_return_date", desde30)
        .order("actual_return_date", { ascending: false });
      setRecientes((data ?? []) as unknown as BultoDevuelto[]);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Remitos del último mes, agrupados por cliente
  const porCliente = useMemo(() => {
    const m = new Map<string, { cliente: string; remitos: Remito[] }>();
    for (const r of agrupar(recientes)) {
      if (!m.has(r.clientId)) m.set(r.clientId, { cliente: r.cliente, remitos: [] });
      m.get(r.clientId)!.remitos.push(r);
    }
    return [...m.values()].sort((a, b) => b.remitos[0].fecha.localeCompare(a.remitos[0].fecha));
  }, [recientes]);

  const remitosBuscados = useMemo(
    () => (resultados ? agrupar(resultados) : []), [resultados]);

  async function buscar() {
    if (!nombre.trim() && !desde && !hasta) { setResultados(null); return; }
    setBuscando(true);
    try {
      const supabase = depositoClient();
      let q = supabase.from("bultos").select(SELECT).eq("status", "returned");
      if (desde) q = q.gte("actual_return_date", desde);
      if (hasta) q = q.lte("actual_return_date", hasta);
      const { data } = await q.order("actual_return_date", { ascending: false }).limit(1000);

      let filas = (data ?? []) as unknown as BultoDevuelto[];
      if (nombre.trim()) {
        // El filtro por nombre se hace acá porque abarca razón social y nombre
        // de fantasía, que viven en la tabla relacionada.
        const q2 = nombre.trim().toLowerCase();
        filas = filas.filter(b =>
          `${b.clients?.name ?? ""} ${b.clients?.nombre_fantasia ?? ""}`.toLowerCase().includes(q2));
      }
      setResultados(filas);
    } finally { setBuscando(false); }
  }

  function limpiarBusqueda() {
    setNombre(""); setDesde(""); setHasta(""); setResultados(null);
  }

  function TarjetaRemito({ r }: { r: Remito }) {
    const exp = abierto === r.key;
    return (
      <div className="border rounded-lg overflow-hidden bg-background">
        <div onClick={() => setAbierto(exp ? null : r.key)}
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
          {exp ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
               : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {r.numero != null ? `Remito N° ${String(r.numero).padStart(4, "0")}` : "Devolución sin número"}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {fmt(r.fecha)}
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 shrink-0">
            {r.bultos.length} bulto{r.bultos.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={e => {
              e.stopPropagation();
              imprimirRemito({ cliente: r.cliente, fecha: r.fecha, numero: r.numero, bultos: r.bultos });
            }}
            title="Reimprimir el remito"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors shrink-0">
            <Printer className="h-4 w-4" />
          </button>
        </div>
        {exp && (
          <div className="border-t bg-muted/10 divide-y">
            {r.bultos.map(b => (
              <div key={b.id} className="px-3 py-2 text-xs flex items-start gap-2">
                <span className="font-mono text-muted-foreground/80 shrink-0">
                  {b.tracking_id || b.barcode || "—"}
                </span>
                <span className="flex-1 min-w-0 truncate">{b.description || "Sin descripción"}</span>
                {b.destination_address && (
                  <span className="text-muted-foreground truncate max-w-[40%]">
                    {b.destination_address}
                    {b.destination_locality ? ` · ${b.destination_locality}` : ""}
                  </span>
                )}
                <span className="text-muted-foreground shrink-0">
                  {ESTADO_BULTO_LABEL[b.status] ?? b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1200px] mx-auto p-5 space-y-4">
        <PageHeader
          titulo="Historial de devoluciones"
          desc="Los remitos del último mes, y buscador para cualquier devolución anterior."
          meta={recientes.length > 0 ? `${recientes.length} bultos en 30 días` : undefined}
        />

        {/* ── Buscador ── */}
        <div className="border rounded-lg bg-card p-3 flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-48">
            <p className="text-xs font-medium mb-1">Cliente</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") buscar(); }}
                placeholder="Razón social o nombre de fantasía…"
                className="w-full text-xs pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-1">Desde</p>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="text-xs border rounded-lg px-2 py-2 bg-background" />
          </div>
          <div>
            <p className="text-xs font-medium mb-1">Hasta</p>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="text-xs border rounded-lg px-2 py-2 bg-background" />
          </div>
          <button onClick={buscar} disabled={buscando}
            className="h-9 px-3 rounded-lg text-xs font-medium bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-60">
            {buscando ? "Buscando…" : "Buscar"}
          </button>
          {resultados && (
            <button onClick={limpiarBusqueda}
              className="h-9 px-3 rounded-lg text-xs font-medium border hover:bg-muted transition-colors">
              Volver al último mes
            </button>
          )}
          <button onClick={cargar} disabled={cargando}
            className="h-9 w-9 grid place-items-center rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
        </div>

        {/* ── Resultados de búsqueda ── */}
        {resultados ? (
          remitosBuscados.length === 0 ? (
            <EmptyState icon={Search} title="Sin devoluciones para esa búsqueda"
              description="Probá con otro nombre de cliente o ampliá el rango de fechas." />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {remitosBuscados.length} remito{remitosBuscados.length !== 1 ? "s" : ""} · {resultados.length} bultos
              </p>
              {remitosBuscados.map(r => (
                <div key={r.key} className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {r.cliente}
                  </p>
                  <TarjetaRemito r={r} />
                </div>
              ))}
            </div>
          )
        ) : porCliente.length === 0 && !cargando ? (
          <EmptyState icon={History} title="Sin devoluciones en el último mes"
            description="Cuando se retiren bultos del depósito, sus remitos van a aparecer acá." />
        ) : (
          <div className="space-y-4">
            {porCliente.map(c => (
              <div key={c.cliente} className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold truncate">{c.cliente}</p>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {c.remitos.length} devolucion{c.remitos.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="p-2 space-y-2">
                  {c.remitos.map(r => <TarjetaRemito key={r.key} r={r} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
