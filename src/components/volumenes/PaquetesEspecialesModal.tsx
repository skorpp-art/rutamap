"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Package, X, Plus, Trash2, User, Barcode, Camera, Loader2, CheckCircle2, MapPin,
  ArrowRight, ArrowLeft, ClipboardList, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  getPaquetesEspeciales, crearPaqueteEspecial, eliminarPaqueteEspecial, getCondicionesEspeciales,
  type PaqueteEspecial, type CondicionEspecial,
} from "@/app/actions/paquetes-especiales";

const BUCKET = "paquetes-especiales";

export function urlImagen(path: string): string {
  const supabase = createClient();
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

interface Props {
  fecha: string;
  recorrido: { recorrido_id: string; codigo: string; nombre: string; zona: string };
  clientes: string[];
  puedeEditar?: boolean;
  onClose: (cantidad: number) => void;
}

type Paso = 1 | 2 | 3;

export function PaquetesEspecialesModal({ fecha, recorrido, clientes, puedeEditar = true, onClose }: Props) {
  const [paquetes, setPaquetes] = useState<PaqueteEspecial[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionEspecial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [paso, setPaso] = useState<Paso>(1);

  // Form — paso a paso: 1) dirección/tracking/fotos · 2) cliente · 3) condición especial
  const [tracking, setTracking] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cliente, setCliente] = useState("");
  const [condicionElegida, setCondicionElegida] = useState<string | null>(null);
  const [imagenes, setImagenes] = useState<string[]>([]); // paths en el bucket
  const [subiendo, setSubiendo] = useState(false);
  const [confirmacion, setConfirmacion] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resPaq, resCond] = await Promise.all([getPaquetesEspeciales(fecha), getCondicionesEspeciales()]);
      if (resPaq.ok) setPaquetes((resPaq.data ?? []).filter(p => p.recorrido_id === recorrido.recorrido_id));
      if (resCond.ok) setCondiciones(resCond.data ?? []);
    } finally { setCargando(false); }
  }, [fecha, recorrido.recorrido_id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Clientes que tienen condición especial registrada (para el desplegable del paso 2)
  const clientesConCondicion = useMemo(
    () => [...new Set(condiciones.map(c => c.cliente))].sort((a, b) => a.localeCompare(b)),
    [condiciones]
  );
  const todosLosClientes = useMemo(
    () => [...new Set([...clientesConCondicion, ...clientes])].sort((a, b) => a.localeCompare(b)),
    [clientesConCondicion, clientes]
  );
  // Condiciones del cliente elegido
  const condicionesDelCliente = useMemo(
    () => condiciones.filter(c => c.cliente.toLowerCase() === cliente.trim().toLowerCase()),
    [condiciones, cliente]
  );

  function resetForm() {
    setTracking(""); setDireccion("");
    setCliente(""); setCondicionElegida(null); setImagenes([]); setPaso(1); setMostrarForm(false);
  }

  async function subirImagenes(files: FileList) {
    setSubiendo(true);
    try {
      const supabase = createClient();
      const nuevos: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${fecha}/${recorrido.codigo}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (error) { toast.error("No se pudo subir la imagen", { description: error.message }); continue; }
        nuevos.push(path);
      }
      if (nuevos.length > 0) setImagenes(prev => [...prev, ...nuevos]);
    } finally { setSubiendo(false); }
  }

  async function quitarImagen(path: string) {
    setImagenes(prev => prev.filter(p => p !== path));
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]);
  }

  async function guardarPaquete() {
    setGuardando(true);
    try {
      const res = await crearPaqueteEspecial(fecha, recorrido.recorrido_id, {
        cliente: cliente.trim() || null,
        tracking: tracking.trim() || null,
        direccion: direccion.trim() || null,
        alto_cm: null, ancho_cm: null, largo_cm: null, peso_kg: null,
        condicionEspecial: condicionElegida,
        imagenes,
      });
      if (!res.ok) {
        console.error("crearPaqueteEspecial falló:", res.error);
        toast.error("No se pudo guardar el paquete especial", { description: res.error ?? "Error desconocido", duration: 8000 });
        return;
      }
      resetForm();
      setConfirmacion(true);
      setTimeout(() => setConfirmacion(false), 1800);
      await cargar();
    } catch (e) {
      console.error("Excepción al guardar paquete especial:", e);
      toast.error("Error inesperado al guardar", { description: String(e), duration: 8000 });
    } finally { setGuardando(false); }
  }

  function siguientePaso() {
    if (paso === 1) {
      if (!direccion.trim() && !tracking.trim()) {
        toast.error("Cargá al menos la dirección o el tracking");
        return;
      }
      setPaso(2);
    } else if (paso === 2) {
      if (!cliente.trim()) { toast.error("Elegí un cliente"); return; }
      setPaso(3);
    }
  }

  async function eliminar(p: PaqueteEspecial) {
    const res = await eliminarPaqueteEspecial(p.id);
    if (!res.ok) { toast.error("No se pudo eliminar", { description: res.error }); return; }
    if (p.imagenes.length > 0) {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove(p.imagenes);
    }
    setPaquetes(prev => prev.filter(x => x.id !== p.id));
  }

  const fmtMedidas = (p: PaqueteEspecial) => {
    const dims = [p.alto_cm, p.ancho_cm, p.largo_cm].filter(v => v != null);
    const parts: string[] = [];
    if (dims.length === 3) parts.push(`${p.alto_cm}×${p.ancho_cm}×${p.largo_cm} cm`);
    else if (dims.length > 0) parts.push(dims.map(d => `${d}`).join("×") + " cm");
    if (p.peso_kg != null) parts.push(`${p.peso_kg} kg`);
    return parts.join(" · ");
  };

  // "Listo" / cerrar: si quedó algo cargado en el wizard, lo guarda antes de
  // cerrar en vez de descartarlo (no hace falta llegar al paso 3 a propósito).
  async function cerrar() {
    const hayDatos = mostrarForm && (direccion.trim() || tracking.trim() || cliente.trim());
    if (!hayDatos) { onClose(paquetes.length); return; }
    setGuardando(true);
    try {
      const res = await crearPaqueteEspecial(fecha, recorrido.recorrido_id, {
        cliente: cliente.trim() || null,
        tracking: tracking.trim() || null,
        direccion: direccion.trim() || null,
        alto_cm: null, ancho_cm: null, largo_cm: null, peso_kg: null,
        condicionEspecial: condicionElegida,
        imagenes,
      });
      if (!res.ok) {
        toast.error("No se pudo guardar el paquete especial", { description: res.error, duration: 8000 });
        return; // no cierra: que no se pierda lo cargado
      }
      toast.success("Paquete cargado");
      onClose(paquetes.length + 1);
    } finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={cerrar}>
      <div className="relative bg-background border rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={e => e.stopPropagation()}>
        {/* Popup de confirmación al cargar un paquete */}
        {confirmacion && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">Paquete cargado</p>
            </div>
          </div>
        )}
        {/* Encabezado */}
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 shrink-0">
            <Package className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold flex items-center gap-1.5">
              Paquetes especiales
              {!cargando && (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
                  {paquetes.length} asignado{paquetes.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {recorrido.nombre} · {recorrido.codigo} · {recorrido.zona} · {fecha}
            </p>
          </div>
          <button onClick={cerrar} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista existente */}
        {cargando ? (
          <p className="text-center text-xs text-muted-foreground py-3">Cargando…</p>
        ) : paquetes.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-3">Todavía no hay paquetes especiales en esta ruta.</p>
        ) : (
          <div className="space-y-2">
            {paquetes.map(p => (
              <div key={p.id} className="border rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold flex-1 truncate">{p.cliente ?? "Sin cliente"}</span>
                  {p.tracking && <span className="font-mono text-muted-foreground">{p.tracking}</span>}
                  {puedeEditar && (
                    <button onClick={() => eliminar(p)} title="Eliminar"
                      className="text-muted-foreground/50 hover:text-red-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {p.direccion && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {p.direccion}
                  </p>
                )}
                {fmtMedidas(p) && <p className="text-muted-foreground tabular-nums">{fmtMedidas(p)}</p>}
                {(p.condicion_especial || p.observacion) && (
                  <p className="flex items-start gap-1 text-amber-700 dark:text-amber-300">
                    <ClipboardList className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line">{p.condicion_especial ?? p.observacion}</span>
                  </p>
                )}
                {p.imagenes.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {p.imagenes.map(img => (
                      <a key={img} href={urlImagen(img)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlImagen(img)} alt="foto del paquete"
                          className="h-14 w-14 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Alta paso a paso */}
        {puedeEditar && (
          !mostrarForm ? (
            <button onClick={() => setMostrarForm(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors">
              <Plus className="h-4 w-4" /> Cargar paquete especial
            </button>
          ) : (
            <div className="border border-amber-300 dark:border-amber-800 rounded-xl p-4 space-y-3 bg-amber-50/30 dark:bg-amber-950/10">
              {/* Indicador de pasos */}
              <div className="flex items-center gap-1.5">
                {([1, 2, 3] as Paso[]).map(n => (
                  <div key={n} className="flex items-center gap-1.5 flex-1">
                    <span className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      n === paso ? "bg-amber-500 text-white"
                        : n < paso ? "bg-amber-200 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                        : "bg-muted text-muted-foreground")}>
                      {n < paso ? <Check className="h-3 w-3" /> : n}
                    </span>
                    <span className={cn("text-[10px] font-medium", n === paso ? "text-foreground" : "text-muted-foreground")}>
                      {n === 1 ? "Paquete" : n === 2 ? "Cliente" : "Condición"}
                    </span>
                    {n < 3 && <div className={cn("h-px flex-1", n < paso ? "bg-amber-400" : "bg-border")} />}
                  </div>
                ))}
              </div>

              {/* Paso 1: dirección, tracking, fotos */}
              {paso === 1 && (
                <div className="space-y-2.5">
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección del paquete…" autoFocus
                      className="w-full text-sm pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  </div>
                  <div className="relative">
                    <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking (LD…)"
                      className="w-full text-sm pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={e => { if (e.target.files?.length) subirImagenes(e.target.files); e.target.value = ""; }} />
                    <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50">
                      {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      {subiendo ? "Subiendo…" : "Adjuntar fotos"}
                    </button>
                    {imagenes.map(img => (
                      <div key={img} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={urlImagen(img)} alt="foto adjunta" className="h-12 w-12 object-cover rounded-lg border" />
                        <button onClick={() => quitarImagen(img)}
                          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-600 text-white flex items-center justify-center">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paso 2: cliente */}
              {paso === 2 && (
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input list="clientes-especiales" value={cliente} onChange={e => { setCliente(e.target.value); setCondicionElegida(null); }}
                      placeholder="Escribí o elegí el cliente…" autoFocus
                      className="w-full text-sm pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    <datalist id="clientes-especiales">
                      {todosLosClientes.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  {clientesConCondicion.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-muted-foreground w-full">Clientes con condición registrada:</span>
                      {clientesConCondicion.slice(0, 12).map(c => (
                        <button key={c} onClick={() => { setCliente(c); setCondicionElegida(null); }}
                          className={cn("text-[11px] px-2 py-1 rounded-lg border transition-colors",
                            cliente === c ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:bg-muted")}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Paso 3: condición especial de ese cliente */}
              {paso === 3 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Condición especial de <span className="font-semibold text-foreground">{cliente}</span>:
                  </p>
                  {condicionesDelCliente.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic border rounded-lg px-3 py-2.5 bg-muted/30">
                      Este cliente no tiene una condición especial registrada. Podés guardar el paquete igual.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {condicionesDelCliente.map(c => (
                        <label key={c.id}
                          className={cn("flex items-start gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors text-xs",
                            condicionElegida === c.condicion ? "border-amber-500 bg-amber-500/10" : "border-border hover:bg-muted/40")}>
                          <input type="radio" name="condicion" className="mt-0.5"
                            checked={condicionElegida === c.condicion}
                            onChange={() => setCondicionElegida(c.condicion)} />
                          <span>
                            <span className="whitespace-pre-line font-medium">{c.condicion}</span>
                            {c.observacion_adicional && (
                              <span className="block text-[11px] text-muted-foreground mt-0.5">{c.observacion_adicional}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navegación */}
              <div className="flex items-center gap-2 pt-1">
                {paso > 1 && (
                  <button onClick={() => setPaso(p => (p - 1) as Paso)}
                    className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Atrás
                  </button>
                )}
                <button onClick={() => { resetForm(); }}
                  className="text-xs px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                {paso < 3 ? (
                  <button onClick={siguientePaso} disabled={subiendo}
                    className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60">
                    Siguiente <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button onClick={guardarPaquete} disabled={guardando}
                    className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60">
                    {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {guardando ? "Guardando…" : "Agregar paquete"}
                  </button>
                )}
              </div>
            </div>
          )
        )}

        <div className="flex justify-end">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5" onClick={cerrar}>
            <Check className="h-4 w-4" /> Listo
          </Button>
        </div>
      </div>
    </div>
  );
}
