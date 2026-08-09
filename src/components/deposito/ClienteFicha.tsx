"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, Printer, X, RefreshCw, Package,
  Search, CheckSquare, Square, MapPin, Phone, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { hoyAR } from "@/lib/fechas";
import { imprimirRemito } from "@/lib/deposito/remito";
import {
  ESTADO_BULTO_LABEL, estaEnDeposito, fechaVerosimil,
  type Bulto, type ClienteDeposito, type EstadoBulto,
} from "@/types/deposito.types";

// Estados que se pueden elegir a mano al cargar o editar un bulto. "deleted" no
// está: para eso se usa el botón de papelera.
const ESTADOS_ELEGIBLES: EstadoBulto[] = [
  "stored", "scheduled_return", "returned", "cambio", "devolucion",
  "rechazado", "cancelled", "duplicate", "ficha",
];

const COLOR_ESTADO: Partial<Record<EstadoBulto, string>> = {
  stored: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  scheduled_return: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  returned: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rechazado: "bg-red-500/15 text-red-600 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function fmt(d: string | null): string {
  if (!d || !fechaVerosimil(d)) return "—";
  const [a, m, dd] = d.split("-");
  return `${dd}/${m}/${a}`;
}

const FORM_VACIO = {
  tracking_id: "",
  description: "",
  destination_address: "",
  destination_locality: "",
  entry_date: "",
  status: "stored" as EstadoBulto,
};

export function ClienteFicha({ clienteId, puedeEditar }: { clienteId: string; puedeEditar: boolean }) {
  const [cliente, setCliente] = useState<ClienteDeposito | null>(null);
  const [bultos, setBultos] = useState<Bulto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [soloEnStock, setSoloEnStock] = useState(true);

  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState<Bulto | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      const [{ data: c }, { data: bs }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clienteId).single(),
        supabase.from("bultos").select("*").eq("client_id", clienteId)
          .is("deleted_at", null).order("entry_date", { ascending: false }),
      ]);
      setCliente((c ?? null) as ClienteDeposito | null);
      setBultos((bs ?? []) as Bulto[]);
      setSeleccion(new Set());
    } finally { setCargando(false); }
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = norm(busqueda);
    return bultos
      .filter(b => !soloEnStock || estaEnDeposito(b.status))
      .filter(b => !q
        || norm(b.tracking_id ?? "").includes(q)
        || norm(b.description ?? "").includes(q)
        || norm(b.destination_address ?? "").includes(q));
  }, [bultos, busqueda, soloEnStock]);

  const enStock = bultos.filter(b => estaEnDeposito(b.status)).length;

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...FORM_VACIO, entry_date: hoyAR() });
    setModalAbierto(true);
  }

  function abrirEdicion(b: Bulto) {
    setEditando(b);
    setForm({
      tracking_id: b.tracking_id ?? "",
      description: b.description ?? "",
      destination_address: b.destination_address ?? "",
      destination_locality: b.destination_locality ?? "",
      entry_date: fechaVerosimil(b.entry_date) ? b.entry_date : hoyAR(),
      status: b.status,
    });
    setModalAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const supabase = depositoClient();
      const datos = {
        tracking_id: form.tracking_id.trim() || null,
        barcode: form.tracking_id.trim() || null,
        description: form.description.trim() || null,
        destination_address: form.destination_address.trim() || null,
        destination_locality: form.destination_locality.trim() || null,
        entry_date: form.entry_date || hoyAR(),
        status: form.status,
      };
      const { error } = editando
        ? await supabase.from("bultos")
            .update({ ...datos, updated_at: new Date().toISOString() }).eq("id", editando.id)
        : await supabase.from("bultos").insert({ ...datos, client_id: clienteId });
      if (error) { toast.error("No se pudo guardar", { description: error.message }); return; }
      toast.success(editando ? "Bulto actualizado" : "Bulto cargado");
      setModalAbierto(false);
      cargar();
    } finally { setGuardando(false); }
  }

  async function cambiarEstado(b: Bulto, status: EstadoBulto) {
    const supabase = depositoClient();
    const cambios: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "returned") cambios.actual_return_date = hoyAR();
    const { error } = await supabase.from("bultos").update(cambios).eq("id", b.id);
    if (error) { toast.error("No se pudo cambiar el estado", { description: error.message }); return; }
    cargar();
  }

  async function aPapelera(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`¿Mover ${ids.length} bulto${ids.length > 1 ? "s" : ""} a la papelera?`)) return;
    setProcesando(true);
    try {
      const supabase = depositoClient();
      const { error } = await supabase.from("bultos")
        .update({ deleted_at: new Date().toISOString(), status: "deleted" }).in("id", ids);
      if (error) { toast.error("No se pudo eliminar", { description: error.message }); return; }
      toast.success(`${ids.length} bulto${ids.length > 1 ? "s" : ""} en la papelera`);
      cargar();
    } finally { setProcesando(false); }
  }

  // ── Devolución con remito ───────────────────────────────────────────────────
  // Marca los bultos como retirados, les pone número de remito y lo imprime.
  // Diferencia con la app de origen: allá esta misma acción además los mandaba
  // a la papelera, así que una devolución normal terminaba pareciendo un
  // borrado (por eso hoy la papelera tiene 2.500 bultos que nadie eliminó).
  async function devolver(ids: string[]) {
    if (ids.length === 0) return;
    const lista = bultos.filter(b => ids.includes(b.id));
    if (!confirm(
      `¿Registrar la salida de ${lista.length} bulto${lista.length > 1 ? "s" : ""} de ${cliente?.nombre_fantasia || cliente?.name}?\n\n` +
      "Se marcan como retirados, se numera el remito y se abre para imprimir."
    )) return;

    setProcesando(true);
    try {
      const supabase = depositoClient();

      // Numerador de remitos. Es un contador de una sola fila: si dos personas
      // cierran una devolución al mismo tiempo podrían leer el mismo número, así
      // que se relee después de escribir para avisar en vez de duplicar en silencio.
      const { data: contador } = await supabase
        .from("doc_counter").select("last_number").eq("id", 1).single();
      const numero = (contador?.last_number ?? 0) + 1;
      const { error: errNum } = await supabase
        .from("doc_counter").update({ last_number: numero }).eq("id", 1);
      if (errNum) { toast.error("No se pudo numerar el remito", { description: errNum.message }); return; }

      const { error } = await supabase.from("bultos").update({
        status: "returned",
        actual_return_date: hoyAR(),
        remito_number: numero,
        updated_at: new Date().toISOString(),
      }).in("id", ids);
      if (error) { toast.error("No se pudo registrar la salida", { description: error.message }); return; }

      imprimirRemito({
        cliente: cliente?.nombre_fantasia
          ? `${cliente.nombre_fantasia} (${cliente.name})`
          : cliente?.name ?? "Cliente",
        fecha: hoyAR(),
        numero,
        bultos: lista,
      });
      toast.success(`Remito N° ${String(numero).padStart(4, "0")} generado`);
      cargar();
    } finally { setProcesando(false); }
  }

  function alternar(id: string) {
    setSeleccion(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const todosSeleccionados = visibles.length > 0 && visibles.every(b => seleccion.has(b.id));

  if (!cargando && !cliente) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[1200px] mx-auto p-5">
          <EmptyState icon={Package} title="No encontramos ese cliente"
            description="Puede que se haya eliminado."
            action={<Link href="/deposito/clientes" className="text-sm text-blue-600 hover:underline">Volver a clientes</Link>} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-5 space-y-4">
        <Link href="/deposito/clientes"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Clientes
        </Link>

        <PageHeader
          titulo={cliente?.nombre_fantasia || cliente?.name || "…"}
          desc={cliente?.nombre_fantasia ? cliente.name : undefined}
          meta={`${enStock} en depósito · ${bultos.length} en total`}
        />

        {(cliente?.address || cliente?.phone || cliente?.email) && (
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            {cliente.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{cliente.address}</span>}
            {cliente.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{cliente.phone}</span>}
            {cliente.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{cliente.email}</span>}
          </div>
        )}

        {/* ── Acciones ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por tracking, descripción o destino…"
              className="w-full text-xs pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <button onClick={() => setSoloEnStock(v => !v)}
            className={cn("text-xs px-3 py-2 rounded-lg border transition-colors",
              soloEnStock ? "bg-brand-blue text-white border-brand-blue" : "border-border text-muted-foreground")}>
            Solo lo que está en depósito
          </button>
          <button onClick={cargar} disabled={cargando}
            className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
          {puedeEditar && (
            <Button onClick={abrirNuevo} className="h-9 gap-1.5 text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">
              <Plus className="h-4 w-4" /> Cargar bulto
            </Button>
          )}
        </div>

        {/* ── Barra de selección ── */}
        {puedeEditar && seleccion.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/50 px-3 py-2">
            <span className="text-xs font-semibold">
              {seleccion.size} seleccionado{seleccion.size > 1 ? "s" : ""}
            </span>
            <button onClick={() => devolver([...seleccion])} disabled={procesando}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-60">
              <Printer className="h-3 w-3" /> Registrar salida y remito
            </button>
            <button onClick={() => aPapelera([...seleccion])} disabled={procesando}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">
              <Trash2 className="h-3 w-3" /> A papelera
            </button>
            <button onClick={() => setSeleccion(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground ml-auto">
              Limpiar selección
            </button>
          </div>
        )}

        {/* ── Listado ── */}
        {visibles.length === 0 && !cargando ? (
          <EmptyState icon={Package}
            title={bultos.length === 0 ? "Este cliente no tiene bultos" : "Nada coincide con el filtro"}
            description={bultos.length === 0
              ? "Cargá el primer bulto para empezar a controlar su stock."
              : "Probá con otro texto o mostrá también los que ya salieron."} />
        ) : (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b">
                  <tr className="text-left">
                    {puedeEditar && (
                      <th className="px-3 py-2 w-8">
                        <button onClick={() => setSeleccion(todosSeleccionados
                          ? new Set()
                          : new Set(visibles.map(b => b.id)))}>
                          {todosSeleccionados
                            ? <CheckSquare className="h-4 w-4 text-blue-600" />
                            : <Square className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </th>
                    )}
                    <th className="px-3 py-2 font-medium text-muted-foreground">Tracking</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Descripción</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Destino</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Ingreso</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Estado</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibles.map(b => (
                    <tr key={b.id} className={cn("hover:bg-muted/20 transition-colors",
                      seleccion.has(b.id) && "bg-blue-50/40 dark:bg-blue-950/20")}>
                      {puedeEditar && (
                        <td className="px-3 py-2">
                          <button onClick={() => alternar(b.id)}>
                            {seleccion.has(b.id)
                              ? <CheckSquare className="h-4 w-4 text-blue-600" />
                              : <Square className="h-4 w-4 text-muted-foreground/50" />}
                          </button>
                        </td>
                      )}
                      <td className="px-3 py-2 font-mono text-muted-foreground/90">{b.tracking_id || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="truncate block max-w-[220px]">{b.description || "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="truncate block max-w-[240px]">
                          {b.destination_address
                            ? b.destination_address + (b.destination_locality ? ` · ${b.destination_locality}` : "")
                            : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmt(b.entry_date)}</td>
                      <td className="px-3 py-2">
                        {puedeEditar ? (
                          <select value={b.status}
                            onChange={e => cambiarEstado(b, e.target.value as EstadoBulto)}
                            className={cn("text-xs rounded px-1.5 py-0.5 border-0 cursor-pointer",
                              COLOR_ESTADO[b.status] ?? "bg-muted text-muted-foreground")}>
                            {ESTADOS_ELEGIBLES.map(s => (
                              <option key={s} value={s}>{ESTADO_BULTO_LABEL[s]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded",
                            COLOR_ESTADO[b.status] ?? "bg-muted text-muted-foreground")}>
                            {ESTADO_BULTO_LABEL[b.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {puedeEditar && (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => abrirEdicion(b)} title="Editar"
                              className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => aPapelera([b.id])} title="Mover a la papelera"
                              className="p-1.5 rounded-lg border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: alta / edición de bulto ── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={guardar} className="bg-background border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <p className="font-bold flex-1">{editando ? "Editar bulto" : "Cargar bulto"}</p>
              <button type="button" onClick={() => setModalAbierto(false)}
                className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="text-xs font-medium mb-1">Tracking o código</p>
              <input value={form.tracking_id} onChange={e => setForm(f => ({ ...f, tracking_id: e.target.value }))}
                placeholder="Número de envío"
                className="w-full text-sm rounded-lg border bg-background px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Descripción</p>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Qué es el bulto"
                className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium mb-1">Dirección de destino</p>
                <input value={form.destination_address}
                  onChange={e => setForm(f => ({ ...f, destination_address: e.target.value }))}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Localidad</p>
                <input value={form.destination_locality}
                  onChange={e => setForm(f => ({ ...f, destination_locality: e.target.value }))}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium mb-1">Fecha de ingreso</p>
                <input type="date" value={form.entry_date}
                  onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Estado</p>
                <select value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as EstadoBulto }))}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {ESTADOS_ELEGIBLES.map(s => (
                    <option key={s} value={s}>{ESTADO_BULTO_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white">
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
