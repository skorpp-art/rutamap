"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package, Users, Trash2, Clock, CalendarCheck, Timer, RefreshCw,
  ArrowRight, AlertTriangle, Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { hoyAR } from "@/lib/fechas";
import {
  ESTADO_BULTO_LABEL, fechaVerosimil,
  type EstadoBulto, type TopCliente, type StockAntiguo,
} from "@/types/deposito.types";

// Un bulto que lleva más de esto guardado ya merece que alguien lo mire.
const DIAS_STOCK_VIEJO = 15;

interface Actividad {
  id: string;
  accion: string;
  detalle: string;
  fecha: string;
  esSalida: boolean;
}

interface RetiroHoy {
  id: string;
  cliente: string;
  detalle: string;
}

interface BultoViejo {
  id: string;
  cliente: string;
  detalle: string;
  dias: number;
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86_400_000);
}

// El join de PostgREST llega como objeto o como array según cómo resuelva la
// relación; esto lo normaliza sin romper si viene vacío.
function nombreCliente(rel: unknown): string {
  if (Array.isArray(rel)) return (rel[0] as { name?: string } | undefined)?.name ?? "Sin cliente";
  return (rel as { name?: string } | null)?.name ?? "Sin cliente";
}

export function ControlGeneralPanel() {
  const [cargando, setCargando] = useState(true);
  const [stock, setStock] = useState(0);
  const [clientes, setClientes] = useState(0);
  const [papelera, setPapelera] = useState(0);
  const [viejos, setViejos] = useState(0);
  const [promDias, setPromDias] = useState(0);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [masAntiguos, setMasAntiguos] = useState<StockAntiguo[]>([]);
  const [retirosHoy, setRetirosHoy] = useState<RetiroHoy[]>([]);
  const [bultosViejos, setBultosViejos] = useState<BultoViejo[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      const hoy = hoyAR();
      const limiteViejo = new Date(Date.now() - DIAS_STOCK_VIEJO * 86_400_000)
        .toISOString().slice(0, 10);

      const [
        { count: nStock }, { count: nClientes }, { count: nPapelera },
        { data: top }, { data: antiguos },
      ] = await Promise.all([
        // En depósito = todo lo que no se retiró ni se eliminó. Incluye
        // cancelados, cambios y devoluciones: siguen físicamente en el galpón.
        supabase.from("bultos").select("*", { count: "exact", head: true })
          .is("deleted_at", null).neq("status", "returned"),
        supabase.from("clients").select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase.from("bultos").select("*", { count: "exact", head: true })
          .not("deleted_at", "is", null),
        supabase.rpc("get_top_clients", { limit_count: 5 }),
        supabase.rpc("get_oldest_stock", { limit_count: 5 }),
      ]);

      setStock(nStock ?? 0);
      setClientes(nClientes ?? 0);
      setPapelera(nPapelera ?? 0);
      setTopClientes((top ?? []) as TopCliente[]);
      setMasAntiguos((antiguos ?? []) as StockAntiguo[]);

      // Retiros agendados para hoy
      const { data: retiros } = await supabase
        .from("bultos")
        .select("id, tracking_id, description, clients(name)")
        .eq("scheduled_return_date", hoy)
        .eq("status", "scheduled_return")
        .is("deleted_at", null);
      setRetirosHoy((retiros ?? []).map(b => ({
        id: b.id as string,
        cliente: nombreCliente((b as Record<string, unknown>).clients),
        detalle: (b.tracking_id as string) || (b.description as string) || "Sin identificar",
      })));

      // Stock viejo: lo que lleva más de 15 días sin salir
      const { data: vjs, count: nViejos } = await supabase
        .from("bultos")
        .select("id, entry_date, tracking_id, description, clients(name)", { count: "exact" })
        .is("deleted_at", null).neq("status", "returned")
        .lte("entry_date", limiteViejo)
        .gte("entry_date", "2020-01-01")
        .order("entry_date").limit(6);
      setViejos(nViejos ?? 0);
      setBultosViejos((vjs ?? []).map(b => ({
        id: b.id as string,
        cliente: nombreCliente((b as Record<string, unknown>).clients),
        detalle: (b.tracking_id as string) || (b.description as string) || "Sin identificar",
        dias: diasDesde(b.entry_date as string),
      })));

      // Promedio de días en depósito, solo sobre lo que está en stock y con
      // fecha creíble (hay cargas viejas con fechas imposibles).
      const { data: enStock } = await supabase
        .from("bultos").select("entry_date")
        .is("deleted_at", null).neq("status", "returned");
      const validas = (enStock ?? [])
        .map(b => b.entry_date as string)
        .filter(fechaVerosimil);
      setPromDias(validas.length
        ? Math.round(validas.reduce((a, f) => a + diasDesde(f), 0) / validas.length)
        : 0);

      // Últimos movimientos: ingresos de bultos y salidas con remito, mezclados
      // por fecha. Las salidas ya no viven en la tabla de bultos: viven en el
      // remito que se emitió.
      const [{ data: recientes }, { data: salidas }] = await Promise.all([
        supabase.from("bultos")
          .select("id, tracking_id, description, status, entry_date, updated_at")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false }).limit(6),
        supabase.from("remitos").select("id, numero, cliente_nombre, fecha, cantidad")
          .order("fecha", { ascending: false }).limit(6),
      ]);

      setActividad([
        ...(recientes ?? []).map(b => ({
          id: b.id as string,
          accion: b.status === "stored" ? "Ingresado"
            : ESTADO_BULTO_LABEL[b.status as EstadoBulto] ?? (b.status as string),
          detalle: (b.tracking_id as string) || (b.description as string) || "Sin identificar",
          fecha: b.entry_date as string,
          esSalida: false,
        })),
        ...(salidas ?? []).map(r => ({
          id: r.id as string,
          accion: "Salida",
          detalle: `${r.cliente_nombre as string} · ${r.cantidad} bulto${(r.cantidad as number) !== 1 ? "s" : ""}`
            + (r.numero != null ? ` · remito ${String(r.numero as number).padStart(4, "0")}` : ""),
          fecha: r.fecha as string,
          esSalida: true,
        })),
      ].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8));
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const tarjetas = [
    { label: "En depósito", valor: stock, icon: Package, sub: "sin retirar",
      color: "text-blue-700 dark:text-blue-300", href: "/deposito/control" },
    { label: "Clientes", valor: clientes, icon: Users, sub: "activos",
      color: "text-emerald-700 dark:text-emerald-300", href: "/deposito/clientes" },
    { label: `Más de ${DIAS_STOCK_VIEJO} días`, valor: viejos, icon: Clock, sub: "sin retirar",
      color: viejos > 0 ? "text-amber-700 dark:text-amber-300" : undefined, href: "/deposito/control" },
    { label: "En papelera", valor: papelera, icon: Trash2, sub: "eliminados",
      color: papelera > 0 ? "text-red-600 dark:text-red-300" : undefined, href: "/deposito/papelera" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-5 space-y-4">
        <PageHeader
          titulo="Depósito"
          desc="Resumen de la guarda: qué hay adentro, de quién es y qué tiene que salir."
          meta={new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        />

        <div className="flex items-center gap-2">
          <button onClick={cargar} disabled={cargando}
            className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
          <span className="text-xs text-muted-foreground">
            Promedio de permanencia: <b className="text-foreground">{promDias}</b> días
          </span>
        </div>

        {/* ── Números del depósito ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tarjetas.map(t => (
            <Link key={t.label} href={t.href}
              className="border rounded-lg p-4 bg-card hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-2">
                <t.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{t.label}</p>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums mt-1", t.color)}>{t.valor}</p>
              <p className="text-xs text-muted-foreground">{t.sub}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Para hoy ── */}
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Retiros de hoy</p>
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">{retirosHoy.length}</span>
            </div>
            {retirosHoy.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                No hay retiros agendados para hoy.
              </p>
            ) : (
              <div className="divide-y">
                {retirosHoy.map(r => (
                  <div key={r.id} className="px-4 py-2.5 text-xs flex items-center gap-2">
                    <span className="font-semibold truncate">{r.cliente}</span>
                    <span className="text-muted-foreground truncate">{r.detalle}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Stock viejo ── */}
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Lo que más tiempo lleva guardado</p>
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">{viejos}</span>
            </div>
            {bultosViejos.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                Nada lleva más de {DIAS_STOCK_VIEJO} días en el depósito.
              </p>
            ) : (
              <div className="divide-y">
                {bultosViejos.map(b => (
                  <div key={b.id} className="px-4 py-2.5 text-xs flex items-center gap-2">
                    <span className={cn("font-semibold tabular-nums shrink-0 w-16",
                      b.dias > 30 ? "text-red-600 dark:text-red-300" : "text-amber-700 dark:text-amber-300")}>
                      {b.dias} días
                    </span>
                    <span className="font-medium truncate">{b.cliente}</span>
                    <span className="text-muted-foreground truncate ml-auto">{b.detalle}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Clientes con más bultos ── */}
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Clientes con más bultos</p>
              <Link href="/deposito/clientes"
                className="text-xs text-blue-600 dark:text-blue-300 hover:underline ml-auto inline-flex items-center gap-0.5">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {topClientes.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">Todavía no hay bultos cargados.</p>
            ) : (
              <div className="divide-y">
                {topClientes.map(c => (
                  <Link key={c.id} href={`/deposito/clientes/${c.id}`}
                    className="px-4 py-2.5 text-xs flex items-center gap-2 hover:bg-muted/20 transition-colors">
                    <span className="font-medium truncate flex-1">{c.name}</span>
                    <span className="tabular-nums font-bold">{c.bultos_count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── Movimientos recientes ── */}
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Últimos movimientos</p>
              <Link href="/deposito/historial"
                className="text-xs text-blue-600 dark:text-blue-300 hover:underline ml-auto inline-flex items-center gap-0.5">
                Remitos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {actividad.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">Sin movimientos registrados.</p>
            ) : (
              <div className="divide-y">
                {actividad.map(a => (
                  <div key={a.id} className="px-4 py-2.5 text-xs flex items-center gap-2">
                    <span className={cn("font-semibold px-1.5 py-0.5 rounded shrink-0",
                      a.esSalida ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : a.accion === "Ingresado" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                      : "bg-muted text-muted-foreground")}>
                      {a.accion}
                    </span>
                    <span className="truncate">{a.detalle}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
                      {fechaVerosimil(a.fecha)
                        ? new Date(a.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {masAntiguos.length === 0 && !cargando && stock === 0 && (
          <EmptyState icon={Package} title="El depósito está vacío"
            description="Cuando cargues bultos van a aparecer acá, con su antigüedad y a qué cliente pertenecen." />
        )}

        {viejos > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Hay {viejos} bulto{viejos > 1 ? "s" : ""} con más de {DIAS_STOCK_VIEJO} días sin retirar.
          </p>
        )}
      </div>
    </div>
  );
}
