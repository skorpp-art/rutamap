"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  History, Search, FileText, Calendar, Printer, ChevronDown, ChevronRight,
  RefreshCw, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { imprimirRemito } from "@/lib/deposito/remito";
import type { Remito } from "@/types/deposito.types";

function fmt(d: string | null): string {
  if (!d) return "—";
  const [a, m, dd] = d.split("-");
  return dd ? `${dd}/${m}/${a}` : d;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function HistorialPanel() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [enBusqueda, setEnBusqueda] = useState(false);

  // Por defecto se muestra el último mes; el buscador va contra todo el archivo.
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase.from("remitos").select("*")
        .gte("fecha", hace30).order("fecha", { ascending: false });
      setRemitos((data ?? []) as Remito[]);
      setEnBusqueda(false);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function buscar() {
    if (!nombre.trim() && !desde && !hasta) { cargar(); return; }
    setBuscando(true);
    try {
      const supabase = depositoClient();
      let q = supabase.from("remitos").select("*");
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      if (nombre.trim()) q = q.ilike("cliente_nombre", `%${nombre.trim()}%`);
      const { data } = await q.order("fecha", { ascending: false }).limit(1000);
      setRemitos((data ?? []) as Remito[]);
      setEnBusqueda(true);
    } finally { setBuscando(false); }
  }

  function limpiar() {
    setNombre(""); setDesde(""); setHasta("");
    cargar();
  }

  const porCliente = useMemo(() => {
    const m = new Map<string, { cliente: string; remitos: Remito[] }>();
    for (const r of remitos) {
      const k = norm(r.cliente_nombre);
      if (!m.has(k)) m.set(k, { cliente: r.cliente_nombre, remitos: [] });
      m.get(k)!.remitos.push(r);
    }
    return [...m.values()].sort((a, b) => b.remitos[0].fecha.localeCompare(a.remitos[0].fecha));
  }, [remitos]);

  const totalBultos = remitos.reduce((s, r) => s + r.cantidad, 0);

  function reimprimir(r: Remito) {
    imprimirRemito({
      cliente: r.cliente_nombre,
      fecha: r.fecha,
      numero: r.numero,
      bultos: r.lineas.map(l => ({
        tracking_id: l.tracking,
        barcode: null,
        description: l.descripcion,
        entry_date: l.ingreso ?? "",
        destination_address: l.destino,
        destination_locality: l.localidad,
        status: l.estado ?? "returned",
      })),
    });
  }

  function Tarjeta({ r }: { r: Remito }) {
    const exp = abierto === r.id;
    return (
      <div className="border rounded-lg overflow-hidden bg-background">
        <div onClick={() => setAbierto(exp ? null : r.id)}
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
          {exp ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
               : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {r.numero != null ? `Remito N° ${String(r.numero).padStart(4, "0")}` : "Salida sin número"}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {fmt(r.fecha)}
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 shrink-0">
            {r.cantidad} bulto{r.cantidad !== 1 ? "s" : ""}
          </span>
          <button onClick={e => { e.stopPropagation(); reimprimir(r); }}
            title="Reimprimir el remito"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors shrink-0">
            <Printer className="h-4 w-4" />
          </button>
        </div>
        {exp && (
          <div className="border-t bg-muted/10 divide-y">
            {r.lineas.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Este remito no guardó el detalle de las líneas.
              </p>
            ) : r.lineas.map((l, i) => (
              <div key={i} className="px-3 py-2 text-xs flex items-start gap-2">
                <span className="font-mono text-muted-foreground/80 shrink-0">{l.tracking || "—"}</span>
                <span className="flex-1 min-w-0 truncate">{l.descripcion || "Sin descripción"}</span>
                {l.destino && (
                  <span className="text-muted-foreground truncate max-w-[40%]">
                    {l.destino}{l.localidad ? ` · ${l.localidad}` : ""}
                  </span>
                )}
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
          titulo="Remitos emitidos"
          desc="Cada salida del depósito, con su documento listo para reimprimir."
          meta={remitos.length > 0
            ? `${remitos.length} remitos · ${totalBultos} bultos`
            : undefined}
        />

        <div className="border rounded-lg bg-card p-3 flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-48">
            <p className="text-xs font-medium mb-1">Cliente</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") buscar(); }}
                placeholder="Nombre del cliente…"
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
          {enBusqueda && (
            <button onClick={limpiar}
              className="h-9 px-3 rounded-lg text-xs font-medium border hover:bg-muted transition-colors">
              Volver al último mes
            </button>
          )}
          <button onClick={cargar} disabled={cargando}
            className="h-9 w-9 grid place-items-center rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
        </div>

        {remitos.length === 0 && !cargando ? (
          <EmptyState icon={History}
            title={enBusqueda ? "Sin remitos para esa búsqueda" : "Sin remitos en el último mes"}
            description={enBusqueda
              ? "Probá con otro nombre o ampliá el rango de fechas."
              : "Cuando registres una salida desde la ficha de un cliente, el remito va a aparecer acá."} />
        ) : (
          <div className="space-y-4">
            {porCliente.map(c => (
              <div key={c.cliente} className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold truncate">{c.cliente}</p>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {c.remitos.length} remito{c.remitos.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="p-2 space-y-2">
                  {c.remitos.map(r => <Tarjeta key={r.id} r={r} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          El remito guarda el detalle de lo que salió, así que los bultos ya no ocupan lugar en el
          depósito ni en los listados. Para ver lo que hay adentro hoy, andá a{" "}
          <Link href="/deposito/control" className="text-blue-600 dark:text-blue-300 hover:underline">
            Control operativo
          </Link>.
        </p>
      </div>
    </div>
  );
}
