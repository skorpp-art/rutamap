"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus, Search, Trash2, Pencil, Package, ArrowRight, X, Upload,
  RefreshCw, Users, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { hoyAR } from "@/lib/fechas";
import { ESTADOS_EN_STOCK, type ClienteDeposito } from "@/types/deposito.types";

type ClienteConStock = ClienteDeposito & { en_stock: number };

type Filtro = "todos" | "con_stock" | "sin_stock";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// ── Importación de Excel ──────────────────────────────────────────────────────
interface FilaImport {
  nombre_fantasia: string;
  tracking: string;
  fecha: string;
  direccion: string;
  localidad: string;
}
interface GrupoImport {
  nombre_fantasia: string;
  clientId: string | null;
  clientName: string | null;
  bultos: FilaImport[];
}

// El Excel viene con la fecha como texto o como número de serie de Excel.
function fechaDeExcel(v: string): string {
  const n = Number(v);
  if (!isNaN(n) && n > 40000) {
    const d = new Date((n - 25569) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
}

export function ClientesPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const [clientes, setClientes] = useState<ClienteConStock[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Alta / edición
  const [modal, setModal] = useState<{ cliente: ClienteDeposito | null } | null>(null);
  const [form, setForm] = useState({ name: "", nombre_fantasia: "", address: "", phone: "", email: "" });
  const [guardando, setGuardando] = useState(false);

  // Importación
  const [grupos, setGrupos] = useState<GrupoImport[] | null>(null);
  const [importando, setImportando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      const [{ data }, { data: enStock }] = await Promise.all([
        supabase.from("clients").select("*").is("deleted_at", null).order("name"),
        // Solo lo que ocupa lugar hoy. En la app de origen se contaban todos los
        // bultos no borrados, así que un cliente sin nada guardado igual figuraba
        // con decenas de bultos (los que ya se había llevado).
        supabase.from("bultos").select("client_id")
          .is("deleted_at", null).in("status", ESTADOS_EN_STOCK),
      ]);

      const conteo: Record<string, number> = {};
      for (const b of enStock ?? []) {
        const k = b.client_id as string;
        conteo[k] = (conteo[k] ?? 0) + 1;
      }

      setClientes(((data ?? []) as ClienteDeposito[])
        .map(c => ({ ...c, en_stock: conteo[c.id] ?? 0 }))
        .sort((a, b) => (a.nombre_fantasia || a.name).localeCompare(b.nombre_fantasia || b.name)));
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = norm(busqueda);
    return clientes
      .filter(c => !q
        || norm(c.name).includes(q)
        || (c.nombre_fantasia ? norm(c.nombre_fantasia).includes(q) : false)
        || (c.address ? norm(c.address).includes(q) : false))
      .filter(c => filtro === "todos" || (filtro === "con_stock" ? c.en_stock > 0 : c.en_stock === 0))
      .sort((a, b) => filtro === "con_stock"
        ? b.en_stock - a.en_stock
        : (a.nombre_fantasia || a.name).localeCompare(b.nombre_fantasia || b.name));
  }, [clientes, busqueda, filtro]);

  const totalEnStock = clientes.reduce((s, c) => s + c.en_stock, 0);

  function abrirNuevo() {
    setForm({ name: "", nombre_fantasia: "", address: "", phone: "", email: "" });
    setModal({ cliente: null });
  }

  function abrirEdicion(c: ClienteDeposito) {
    setForm({
      name: c.name,
      nombre_fantasia: c.nombre_fantasia ?? "",
      address: c.address ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
    });
    setModal({ cliente: c });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("La razón social es obligatoria"); return; }
    setGuardando(true);
    try {
      const supabase = depositoClient();
      const datos = {
        name: form.name.trim(),
        nombre_fantasia: form.nombre_fantasia.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      };
      const { error } = modal?.cliente
        ? await supabase.from("clients")
            .update({ ...datos, updated_at: new Date().toISOString() }).eq("id", modal.cliente.id)
        : await supabase.from("clients").insert(datos);
      if (error) { toast.error("No se pudo guardar", { description: error.message }); return; }
      toast.success(modal?.cliente ? "Cliente actualizado" : "Cliente creado");
      setModal(null);
      cargar();
    } finally { setGuardando(false); }
  }

  async function mandarAPapelera(c: ClienteConStock) {
    if (!confirm(
      `¿Mover a "${c.nombre_fantasia || c.name}" a la papelera?` +
      (c.en_stock > 0 ? `\n\nOjo: tiene ${c.en_stock} bulto${c.en_stock > 1 ? "s" : ""} en el depósito.` : "") +
      "\n\nSe puede restaurar desde la papelera."
    )) return;
    const supabase = depositoClient();
    const { error } = await supabase.from("clients")
      .update({ deleted_at: new Date().toISOString() }).eq("id", c.id);
    if (error) { toast.error("No se pudo eliminar", { description: error.message }); return; }
    toast.success("Cliente movido a la papelera");
    cargar();
  }

  // ── Importar Excel: arma bultos y los asigna por nombre de fantasía ──
  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });

    // El encabezado no siempre está en la primera fila: se busca en las primeras 15.
    let idxHeader = -1;
    const cols: Record<string, number> = {};
    for (let i = 0; i < Math.min(15, filas.length); i++) {
      const fila = filas[i] as string[];
      const tieneClave = fila.some(c => {
        const v = String(c).toLowerCase();
        return v.includes("fantas") || v.includes("tracking") || v.includes("fecha") || v.includes("direcc");
      });
      if (tieneClave) {
        idxHeader = i;
        fila.forEach((c, j) => { const v = String(c).toLowerCase().trim(); if (v) cols[v] = j; });
        break;
      }
    }
    if (idxHeader === -1) { toast.error("No encontré la fila de encabezados en el Excel"); return; }

    const buscarCol = (...nombres: string[]): number => {
      for (const n of nombres) {
        const l = n.toLowerCase();
        for (const [k, j] of Object.entries(cols)) if (k === l || k.includes(l) || l.includes(k)) return j;
      }
      return -1;
    };
    const cFant = buscarCol("nombre fantasía", "nombre fantasia", "fantasia", "fantasía", "cliente");
    const cTrack = buscarCol("tracking", "traking", "trackng", "id tracking", "numero envio", "nro envio", "codigo", "código");
    const cFecha = buscarCol("fecha", "fecha ingreso", "fecha paquete");
    const cDir = buscarCol("direccion", "dirección", "domicilio", "calle");
    const cLoc = buscarCol("localidad", "ciudad", "partido", "zona");

    if (cFant === -1) { toast.error("No encontré la columna de nombre de fantasía"); return; }

    const datos: FilaImport[] = [];
    for (const f of filas.slice(idxHeader + 1)) {
      const r = f as string[];
      const fantasia = String(r[cFant] ?? "").trim();
      if (!fantasia) continue;
      datos.push({
        nombre_fantasia: fantasia,
        tracking: cTrack >= 0 ? String(r[cTrack] ?? "").trim() : "",
        fecha: cFecha >= 0 ? String(r[cFecha] ?? "").trim() : "",
        direccion: cDir >= 0 ? String(r[cDir] ?? "").trim() : "",
        localidad: cLoc >= 0 ? String(r[cLoc] ?? "").trim() : "",
      });
    }
    if (datos.length === 0) { toast.error("El archivo no tiene paquetes"); return; }

    const porFantasia = new Map<string, FilaImport[]>();
    for (const d of datos) {
      const k = norm(d.nombre_fantasia);
      if (!porFantasia.has(k)) porFantasia.set(k, []);
      porFantasia.get(k)!.push(d);
    }

    const grupos: GrupoImport[] = [...porFantasia.values()].map(bultos => {
      const fantasia = bultos[0].nombre_fantasia;
      const k = norm(fantasia);
      const match = clientes.find(c =>
        (c.nombre_fantasia && norm(c.nombre_fantasia) === k) || norm(c.name) === k);
      return {
        nombre_fantasia: fantasia,
        clientId: match?.id ?? null,
        clientName: match ? (match.nombre_fantasia || match.name) : null,
        bultos,
      };
    }).sort((a, b) => Number(!!b.clientId) - Number(!!a.clientId));

    setGrupos(grupos);
  }

  async function confirmarImport() {
    if (!grupos) return;
    setImportando(true);
    try {
      const supabase = depositoClient();
      const nuevos = grupos.filter(g => g.clientId).flatMap(g => g.bultos.map(b => ({
        client_id: g.clientId!,
        tracking_id: b.tracking || null,
        barcode: b.tracking || null,
        destination_address: b.direccion || null,
        destination_locality: b.localidad || null,
        status: "cancelled",
        entry_date: fechaDeExcel(b.fecha) || hoyAR(),
      })));
      const sinCliente = grupos.filter(g => !g.clientId).reduce((s, g) => s + g.bultos.length, 0);

      if (nuevos.length === 0) {
        toast.error("Ningún grupo quedó asociado a un cliente existente");
        return;
      }
      // Una sola inserción en vez de una por bulto: el original hacía un viaje
      // por fila y con archivos grandes tardaba muchísimo.
      const { error } = await supabase.from("bultos").insert(nuevos);
      if (error) { toast.error("No se pudo importar", { description: error.message }); return; }

      toast.success(`${nuevos.length} bultos importados`, {
        description: sinCliente > 0 ? `${sinCliente} quedaron afuera por no encontrar el cliente` : undefined,
      });
      setGrupos(null);
      cargar();
    } finally { setImportando(false); }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-5 space-y-4">
        <PageHeader
          titulo="Clientes del depósito"
          desc="Quién es cada cliente y cuánto tiene guardado hoy."
          meta={`${clientes.length} clientes · ${totalEnStock} bultos en depósito`}
        />

        {/* ── Barra de acciones ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, fantasía o dirección…"
              className="w-full text-xs pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            {([["todos", "Todos"], ["con_stock", "Con bultos"], ["sin_stock", "Sin bultos"]] as [Filtro, string][])
              .map(([k, lbl]) => (
                <button key={k} onClick={() => setFiltro(k)}
                  className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
                    filtro === k ? "bg-background" : "text-muted-foreground hover:text-foreground")}>
                  {lbl}
                </button>
              ))}
          </div>
          <button onClick={cargar} disabled={cargando}
            className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
          {puedeEditar && (
            <>
              <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border cursor-pointer hover:bg-muted transition-colors">
                <Upload className="h-4 w-4" /> Importar Excel
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onArchivo} />
              </label>
              <Button onClick={abrirNuevo} className="h-9 gap-1.5 text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">
                <Plus className="h-4 w-4" /> Nuevo cliente
              </Button>
            </>
          )}
        </div>

        {/* ── Listado ── */}
        {visibles.length === 0 && !cargando ? (
          <EmptyState icon={Users}
            title={clientes.length === 0 ? "Todavía no hay clientes" : "Ningún cliente coincide"}
            description={clientes.length === 0
              ? "Cargá el primer cliente para empezar a registrar bultos en el depósito."
              : "Probá con otro texto o cambiá el filtro."} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibles.map(c => (
              <div key={c.id} className="border rounded-lg bg-card p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.nombre_fantasia || c.name}</p>
                    {c.nombre_fantasia && (
                      <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                    )}
                  </div>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums",
                    c.en_stock > 0
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                      : "bg-muted text-muted-foreground")}>
                    {c.en_stock}
                  </span>
                </div>

                {(c.address || c.phone) && (
                  <div className="mt-2 space-y-0.5">
                    {c.address && (
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </p>
                    )}
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </div>
                )}

                <div className="flex items-center gap-1.5 mt-3">
                  <Link href={`/deposito/clientes/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors">
                    <Package className="h-3 w-3" /> Ver bultos <ArrowRight className="h-3 w-3" />
                  </Link>
                  {puedeEditar && (
                    <>
                      <button onClick={() => abrirEdicion(c)} title="Editar cliente"
                        className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => mandarAPapelera(c)} title="Mover a la papelera"
                        className="p-1.5 rounded-lg border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: alta / edición ── */}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={guardar} className="bg-background border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <p className="font-bold flex-1">{modal.cliente ? "Editar cliente" : "Nuevo cliente"}</p>
              <button type="button" onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {([
              ["name", "Razón social *", "Nombre legal del cliente"],
              ["nombre_fantasia", "Nombre de fantasía", "Con el que se lo conoce"],
              ["address", "Dirección", ""],
              ["phone", "Teléfono", ""],
              ["email", "Email", ""],
            ] as [keyof typeof form, string, string][]).map(([campo, label, ph]) => (
              <div key={campo}>
                <p className="text-xs font-medium mb-1">{label}</p>
                <input value={form[campo]} placeholder={ph}
                  onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))}
                  className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white">
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: revisión de la importación ── */}
      {grupos && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-2 p-5 border-b">
              <Upload className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <p className="font-bold">Revisar importación</p>
                <p className="text-xs text-muted-foreground">
                  Los grupos sin cliente asociado no se importan: creá el cliente o corregí el nombre de fantasía.
                </p>
              </div>
              <button onClick={() => setGrupos(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {grupos.map(g => (
                <div key={g.nombre_fantasia} className="px-5 py-2.5 flex items-center gap-2 text-xs">
                  <span className={cn("font-semibold px-1.5 py-0.5 rounded shrink-0",
                    g.clientId ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                               : "bg-red-500/15 text-red-600 dark:text-red-300")}>
                    {g.clientId ? "Asociado" : "Sin cliente"}
                  </span>
                  <span className="font-medium truncate">{g.nombre_fantasia}</span>
                  {g.clientName && g.clientName !== g.nombre_fantasia && (
                    <span className="text-muted-foreground truncate">→ {g.clientName}</span>
                  )}
                  <span className="ml-auto tabular-nums text-muted-foreground shrink-0">
                    {g.bultos.length} bulto{g.bultos.length !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-5 border-t flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setGrupos(null)}>Cancelar</Button>
              <Button onClick={confirmarImport} disabled={importando}
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white">
                {importando ? "Importando…" : `Importar ${grupos.filter(g => g.clientId).reduce((s, g) => s + g.bultos.length, 0)} bultos`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
