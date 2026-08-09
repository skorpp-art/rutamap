"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search, Download, Upload, X, RefreshCw, FolderOpen, Mail, Phone,
  MapPin, Package, ArrowRight, StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { ClienteDeposito } from "@/types/deposito.types";

type ClienteDirectorio = ClienteDeposito & {
  en_stock: number;
  retiros_30d: number;
};

interface RetiroReciente {
  id: string;
  numero: number | null;
  fecha: string;
  cantidad: number;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function fmt(d: string | null): string {
  if (!d) return "—";
  const [a, m, dd] = d.split("-");
  return dd ? `${dd}/${m}/${a}` : d;
}

interface FilaImport {
  name: string;
  nombre_fantasia?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export function DirectorioPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const [clientes, setClientes] = useState<ClienteDirectorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<ClienteDirectorio | null>(null);
  const [retiros, setRetiros] = useState<RetiroReciente[]>([]);
  const [previa, setPrevia] = useState<FilaImport[] | null>(null);
  const [importando, setImportando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

      const [{ data: cs }, { data: enStock }, { data: devueltos }] = await Promise.all([
        supabase.from("clients").select("*").is("deleted_at", null).order("name"),
        supabase.from("bultos").select("client_id")
          .is("deleted_at", null).neq("status", "returned"),
        // Los retiros salen de los remitos emitidos, que es el registro que
        // queda: los bultos retirados ya no viven en la tabla.
        supabase.from("remitos").select("client_id, cantidad").gte("fecha", hace30),
      ]);

      const contar = (filas: { client_id: string }[] | null) => {
        const m: Record<string, number> = {};
        for (const f of filas ?? []) m[f.client_id] = (m[f.client_id] ?? 0) + 1;
        return m;
      };
      const stock = contar(enStock as { client_id: string }[] | null);
      const salidas: Record<string, number> = {};
      for (const r of (devueltos ?? []) as { client_id: string | null; cantidad: number }[]) {
        if (r.client_id) salidas[r.client_id] = (salidas[r.client_id] ?? 0) + r.cantidad;
      }

      setClientes(((cs ?? []) as ClienteDeposito[]).map(c => ({
        ...c,
        en_stock: stock[c.id] ?? 0,
        retiros_30d: salidas[c.id] ?? 0,
      })));
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = norm(busqueda);
    if (!q) return clientes;
    return clientes.filter(c =>
      norm(c.name).includes(q)
      || (c.nombre_fantasia ? norm(c.nombre_fantasia).includes(q) : false)
      || (c.address ? norm(c.address).includes(q) : false)
      || (c.phone ? norm(c.phone).includes(q) : false)
      || (c.email ? norm(c.email).includes(q) : false));
  }, [clientes, busqueda]);

  async function abrirDetalle(c: ClienteDirectorio) {
    setDetalle(c);
    setRetiros([]);
    const supabase = depositoClient();
    const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const { data } = await supabase.from("remitos")
      .select("id, numero, fecha, cantidad")
      .eq("client_id", c.id).gte("fecha", hace30)
      .order("fecha", { ascending: false });
    setRetiros((data ?? []) as RetiroReciente[]);
  }

  async function exportar() {
    const XLSX = await import("xlsx");
    const filas = clientes.map((c, i) => ({
      "N°": i + 1,
      "Nombre de fantasía": c.nombre_fantasia ?? "",
      "Razón social": c.name,
      "Dirección": c.address ?? "",
      "Teléfono": c.phone ?? "",
      "Email": c.email ?? "",
      "Notas": c.notes ?? "",
      "En depósito": c.en_stock,
      "Bultos retirados (30 días)": c.retiros_30d,
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 32 },
                   { wch: 16 }, { wch: 26 }, { wch: 30 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes_deposito_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filas.length} clientes exportados`);
  }

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });

    // El encabezado puede no estar en la primera fila (títulos, logos, etc.).
    let idx = -1;
    const cols: Record<string, number> = {};
    for (let i = 0; i < Math.min(15, filas.length); i++) {
      const fila = filas[i] as string[];
      if (fila.some(c => {
        const v = String(c).toLowerCase();
        return v.includes("nombre") || v.includes("razon") || v.includes("razón") || v.includes("fantas");
      })) {
        idx = i;
        fila.forEach((c, j) => { const v = String(c).toLowerCase().trim(); if (v) cols[v] = j; });
        break;
      }
    }
    if (idx === -1) { toast.error("No encontré la fila de encabezados"); return; }

    const col = (...nombres: string[]) => {
      for (const n of nombres) {
        const l = n.toLowerCase();
        for (const [k, j] of Object.entries(cols)) if (k === l || k.includes(l) || l.includes(k)) return j;
      }
      return -1;
    };
    const cNom = col("nombre principal", "razon social", "razón social", "nombre", "cliente");
    const cFant = col("nombre fantasía", "nombre fantasia", "fantasia");
    const cDir = col("dirección", "direccion", "domicilio", "localidad");
    const cTel = col("teléfono", "telefono", "celular", "tel");
    const cMail = col("email", "e-mail", "correo");
    const cNotas = col("notas", "observaciones");

    if (cNom === -1) { toast.error("No encontré la columna del nombre del cliente"); return; }

    const texto = (r: unknown[], j: number) => j >= 0 ? String(r[j] ?? "").trim() : "";
    const nuevas: FilaImport[] = [];
    for (const f of filas.slice(idx + 1)) {
      const r = f as unknown[];
      const name = texto(r, cNom);
      if (!name || ["nombre", "nombre principal", "razon social"].includes(name.toLowerCase())) continue;
      nuevas.push({
        name,
        nombre_fantasia: texto(r, cFant) || undefined,
        address: texto(r, cDir) || undefined,
        phone: texto(r, cTel) || undefined,
        email: texto(r, cMail) || undefined,
        notes: texto(r, cNotas) || undefined,
      });
    }
    if (nuevas.length === 0) { toast.error("El archivo no tiene clientes"); return; }
    setPrevia(nuevas);
  }

  async function confirmarImport() {
    if (!previa) return;
    setImportando(true);
    try {
      const supabase = depositoClient();
      // Los que ya existen (mismo nombre o misma fantasía) no se duplican: el
      // original insertaba todo y dejaba la lista llena de repetidos.
      const existentes = new Set(clientes.flatMap(c =>
        [norm(c.name), c.nombre_fantasia ? norm(c.nombre_fantasia) : ""].filter(Boolean)));
      const aInsertar = previa.filter(f =>
        !existentes.has(norm(f.name)) && !(f.nombre_fantasia && existentes.has(norm(f.nombre_fantasia))));
      const repetidos = previa.length - aInsertar.length;

      if (aInsertar.length === 0) {
        toast.info("Todos los clientes del archivo ya existían");
        setPrevia(null);
        return;
      }
      const { error } = await supabase.from("clients").insert(aInsertar.map(f => ({
        name: f.name,
        nombre_fantasia: f.nombre_fantasia ?? null,
        phone: f.phone ?? null,
        email: f.email ?? null,
        address: f.address ?? null,
        notes: f.notes ?? null,
      })));
      if (error) { toast.error("No se pudo importar", { description: error.message }); return; }
      toast.success(`${aInsertar.length} clientes importados`, {
        description: repetidos > 0 ? `${repetidos} ya existían y se omitieron` : undefined,
      });
      setPrevia(null);
      cargar();
    } finally { setImportando(false); }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-5 space-y-4">
        <PageHeader
          titulo="Directorio"
          desc="Datos de contacto de los clientes del depósito, con su actividad del último mes."
          meta={`${clientes.length} clientes`}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, dirección, teléfono o email…"
              className="w-full text-xs pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <button onClick={cargar} disabled={cargando}
            className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
          <button onClick={exportar}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Exportar
          </button>
          {puedeEditar && (
            <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border cursor-pointer hover:bg-muted transition-colors">
              <Upload className="h-4 w-4" /> Importar
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onArchivo} />
            </label>
          )}
        </div>

        {visibles.length === 0 && !cargando ? (
          <EmptyState icon={FolderOpen}
            title={clientes.length === 0 ? "El directorio está vacío" : "Ningún cliente coincide"}
            description={clientes.length === 0
              ? "Importá tu planilla de clientes o cargalos desde la pantalla de Clientes."
              : "Probá con otro texto."} />
        ) : (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Contacto</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Dirección</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground text-right">En depósito</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground text-right">Retirados 30d</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibles.map(c => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => abrirDetalle(c)}>
                      <td className="px-3 py-2">
                        <p className="font-semibold truncate max-w-[220px]">{c.nombre_fantasia || c.name}</p>
                        {c.nombre_fantasia && (
                          <p className="text-muted-foreground truncate max-w-[220px]">{c.name}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.phone && <p className="truncate max-w-[160px]">{c.phone}</p>}
                        {c.email && <p className="truncate max-w-[160px]">{c.email}</p>}
                        {!c.phone && !c.email && "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="truncate block max-w-[260px]">{c.address || "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {c.en_stock > 0 ? c.en_stock : <span className="text-muted-foreground/50">0</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{c.retiros_30d}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/deposito/clientes/${c.id}`} onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-300 hover:underline">
                          Bultos <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Ficha de contacto ── */}
      {detalle && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setDetalle(null)}>
          <div className="bg-background border rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-2 p-5 border-b">
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{detalle.nombre_fantasia || detalle.name}</p>
                {detalle.nombre_fantasia && (
                  <p className="text-xs text-muted-foreground truncate">{detalle.name}</p>
                )}
              </div>
              <button onClick={() => setDetalle(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">En depósito</p>
                  <p className="text-2xl font-bold tabular-nums">{detalle.en_stock}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Retiros (30 días)</p>
                  <p className="text-2xl font-bold tabular-nums">{detalle.retiros_30d}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                {detalle.phone && (
                  <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{detalle.phone}</p>
                )}
                {detalle.email && (
                  <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{detalle.email}</p>
                )}
                {detalle.address && (
                  <p className="flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />{detalle.address}</p>
                )}
                {detalle.notes && (
                  <p className="flex items-start gap-1.5"><StickyNote className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />{detalle.notes}</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold mb-1.5">Remitos del último mes</p>
                {retiros.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin salidas en los últimos 30 días.</p>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {retiros.map(r => (
                      <div key={r.id} className="px-3 py-2 text-xs flex items-center gap-2">
                        <span className="font-semibold shrink-0">
                          {r.numero != null ? `N° ${String(r.numero).padStart(4, "0")}` : "Sin número"}
                        </span>
                        <span className="text-muted-foreground flex-1">
                          {r.cantidad} bulto{r.cantidad !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground shrink-0 tabular-nums">{fmt(r.fecha)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t">
              <Link href={`/deposito/clientes/${detalle.id}`}
                className="inline-flex items-center justify-center gap-1.5 w-full h-9 rounded-lg text-sm font-medium bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors">
                <Package className="h-4 w-4" /> Ver sus bultos
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Revisión de importación ── */}
      {previa && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background border rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-2 p-5 border-b">
              <Upload className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <p className="font-bold">Importar clientes</p>
                <p className="text-xs text-muted-foreground">
                  {previa.length} filas leídas. Los que ya existan se omiten.
                </p>
              </div>
              <button onClick={() => setPrevia(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {previa.slice(0, 100).map((f, i) => (
                <div key={i} className="px-5 py-2 text-xs">
                  <p className="font-medium truncate">{f.nombre_fantasia || f.name}</p>
                  <p className="text-muted-foreground truncate">
                    {[f.name !== (f.nombre_fantasia ?? f.name) ? f.name : null, f.address, f.phone]
                      .filter(Boolean).join(" · ") || "sin datos de contacto"}
                  </p>
                </div>
              ))}
              {previa.length > 100 && (
                <p className="px-5 py-2 text-xs text-muted-foreground">
                  …y {previa.length - 100} más.
                </p>
              )}
            </div>
            <div className="p-5 border-t flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPrevia(null)}>Cancelar</Button>
              <Button onClick={confirmarImport} disabled={importando}
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white">
                {importando ? "Importando…" : "Importar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
