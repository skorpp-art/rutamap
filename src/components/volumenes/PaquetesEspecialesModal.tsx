"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Package, X, Plus, Trash2, User, Barcode, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  getPaquetesEspeciales, crearPaqueteEspecial, eliminarPaqueteEspecial,
  type PaqueteEspecial,
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

export function PaquetesEspecialesModal({ fecha, recorrido, clientes, puedeEditar = true, onClose }: Props) {
  const [paquetes, setPaquetes] = useState<PaqueteEspecial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Form
  const [cliente, setCliente] = useState("");
  const [tracking, setTracking] = useState("");
  const [alto, setAlto] = useState("");
  const [ancho, setAncho] = useState("");
  const [largo, setLargo] = useState("");
  const [peso, setPeso] = useState("");
  const [observacion, setObservacion] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]); // paths en el bucket
  const [subiendo, setSubiendo] = useState(false);
  const [confirmacion, setConfirmacion] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getPaquetesEspeciales(fecha);
      if (res.ok) setPaquetes((res.data ?? []).filter(p => p.recorrido_id === recorrido.recorrido_id));
    } finally { setCargando(false); }
  }, [fecha, recorrido.recorrido_id]);

  useEffect(() => { cargar(); }, [cargar]);

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

  function num(s: string): number | null {
    const v = parseFloat(s.replace(",", "."));
    return isNaN(v) ? null : v;
  }

  async function agregar() {
    if (!cliente.trim() && !observacion.trim() && !tracking.trim()) {
      toast.error("Cargá al menos el cliente, el tracking o una observación");
      return;
    }
    setGuardando(true);
    try {
      const res = await crearPaqueteEspecial(fecha, recorrido.recorrido_id, {
        cliente: cliente.trim() || null,
        tracking: tracking.trim() || null,
        alto_cm: num(alto), ancho_cm: num(ancho), largo_cm: num(largo), peso_kg: num(peso),
        observacion: observacion.trim() || null,
        imagenes,
      });
      if (!res.ok) {
        console.error("crearPaqueteEspecial falló:", res.error);
        toast.error("No se pudo guardar el paquete especial", { description: res.error ?? "Error desconocido", duration: 8000 });
        return;
      }
      setCliente(""); setTracking(""); setAlto(""); setAncho(""); setLargo(""); setPeso("");
      setObservacion(""); setImagenes([]);
      setConfirmacion(true);
      setTimeout(() => setConfirmacion(false), 1800);
      await cargar();
    } catch (e) {
      console.error("Excepción al guardar paquete especial:", e);
      toast.error("Error inesperado al guardar", { description: String(e), duration: 8000 });
    } finally { setGuardando(false); }
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => onClose(paquetes.length)}>
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
          <button onClick={() => onClose(paquetes.length)} className="text-muted-foreground hover:text-foreground">
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
                {fmtMedidas(p) && <p className="text-muted-foreground tabular-nums">{fmtMedidas(p)}</p>}
                {p.observacion && <p className="text-muted-foreground italic">"{p.observacion}"</p>}
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

        {/* Alta */}
        {puedeEditar && (
          <div className="border border-dashed border-amber-300 dark:border-amber-800 rounded-xl p-4 space-y-2.5 bg-amber-50/30 dark:bg-amber-950/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nuevo paquete</p>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input list="clientes-especiales" value={cliente} onChange={e => setCliente(e.target.value)}
                placeholder="Seleccionar cliente…"
                className="w-full text-sm pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-amber-400" />
              <datalist id="clientes-especiales">
                {clientes.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="relative">
              <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking (LD…)"
                className="w-full text-sm pl-8 pr-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([["Alto", alto, setAlto], ["Ancho", ancho, setAncho], ["Largo", largo, setLargo], ["Peso", peso, setPeso]] as const).map(([ph, val, set]) => (
                <input key={ph} value={val} onChange={e => set(e.target.value)} placeholder={ph} inputMode="decimal"
                  className="w-full text-sm px-2 py-2 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-amber-400 text-center" />
              ))}
            </div>
            <textarea value={observacion} onChange={e => setObservacion(e.target.value)} rows={2}
              placeholder='Observación — ej: "caja grande, va en el techo", "frágil"…'
              className="w-full text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none" />

            {/* Fotos */}
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

            <button onClick={agregar} disabled={guardando || subiendo}
              className={cn("w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors",
                "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60",
                (guardando || subiendo) && "opacity-60 pointer-events-none")}>
              <Plus className="h-4 w-4" /> {guardando ? "Agregando…" : "Agregar paquete"}
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => onClose(paquetes.length)}>
            ✓ Listo
          </Button>
        </div>
      </div>
    </div>
  );
}
