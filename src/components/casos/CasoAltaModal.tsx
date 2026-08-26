"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buscarSimilares, crearCaso, getNombresClientes, type CasoSimilar, type EstadoCaso,
} from "@/app/actions/casos";
import { ESTADO_INFO, TIPOS_INCIDENCIA, fechaHoraCorta } from "./comun";

const VACIO = {
  cliente: "", tipoIncidencia: "", tracking: "",
  direccion: "", observaciones: "", ejecutivo: "",
};

/**
 * Alta de caso.
 *
 * Lo importante acá no es el formulario sino el control de repetidos, que es la
 * razón por la que el Excel se ensuciaba: dos personas cargaban el mismo
 * problema y quedaban dos filas que después nadie sabía cuál cerrar.
 *
 * Hay dos niveles. Cuando el paquete tiene número de seguimiento, la base
 * directamente no deja crear un segundo caso vivo con el mismo tracking. Cuando
 * no lo tiene —que es la mitad de los casos— se buscan parecidos por cliente y
 * por dirección y se muestran antes de guardar, pero no se bloquea: puede ser
 * de verdad otro paquete del mismo cliente.
 */
export function CasoAltaModal({
  abierto, onCerrar, onCreado, ejecutivoSugerido,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (id: string) => void;
  ejecutivoSugerido: string;
}) {
  const [f, setF] = useState({ ...VACIO });
  const [similares, setSimilares] = useState<CasoSimilar[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [clientes, setClientes] = useState<string[]>([]);

  useEffect(() => {
    if (abierto) { setF({ ...VACIO, ejecutivo: ejecutivoSugerido }); setSimilares([]); }
  }, [abierto, ejecutivoSugerido]);

  // Cartera del Depósito: así el cliente se elige de una lista en vez de
  // tipearse distinto cada vez.
  useEffect(() => {
    if (abierto && clientes.length === 0) {
      getNombresClientes().then(r => { if (r.ok) setClientes(r.data); });
    }
  }, [abierto, clientes.length]);

  // Búsqueda de parecidos mientras se escribe, con un respiro para no consultar
  // en cada tecla.
  useEffect(() => {
    if (!abierto) return;
    const tr = f.tracking.trim(), cl = f.cliente.trim(), di = f.direccion.trim();
    if (tr.length < 4 && cl.length < 3 && di.length < 6) { setSimilares([]); return; }
    const t = setTimeout(() => {
      buscarSimilares(tr, cl, di).then(r => setSimilares(r.ok ? r.data : []));
    }, 450);
    return () => clearTimeout(t);
  }, [abierto, f.tracking, f.cliente, f.direccion]);

  async function guardar() {
    if (!f.cliente.trim()) return toast.error("Falta el cliente");
    if (!f.tipoIncidencia) return toast.error("Elegí el tipo de incidencia");
    setGuardando(true);
    const r = await crearCaso(f);
    setGuardando(false);
    if (!r.ok) return toast.error(r.error);
    if (r.data.duplicado) {
      toast.warning(`Ese seguimiento ya tiene el caso ${r.data.caso.numero} abierto`);
      onCreado(r.data.caso.id);
      return;
    }
    toast.success(`Caso ${r.data.caso.numero} creado`);
    onCreado(r.data.caso.id);
  }

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle>Nuevo caso</DialogTitle>
        <DialogDescription>
          Queda registrado a tu nombre y el aviso le llega al área que tiene que responder.
        </DialogDescription>

        <div className="space-y-3 mt-3">
          <div>
            <Label htmlFor="c-cliente">Cliente *</Label>
            <Input id="c-cliente" value={f.cliente} autoFocus list="c-cliente-lista"
              placeholder="Buscar en la cartera o escribir uno nuevo…"
              onChange={e => setF({ ...f, cliente: e.target.value })} />
            <datalist id="c-cliente-lista">
              {clientes.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <Label htmlFor="c-tipo">Tipo de incidencia *</Label>
            <select id="c-tipo" value={f.tipoIncidencia}
              onChange={e => setF({ ...f, tipoIncidencia: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Elegir…</option>
              {TIPOS_INCIDENCIA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-track">Seguimiento</Label>
              <Input id="c-track" value={f.tracking}
                onChange={e => setF({ ...f, tracking: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="c-ejec">Ejecutivo</Label>
              <Input id="c-ejec" value={f.ejecutivo}
                onChange={e => setF({ ...f, ejecutivo: e.target.value })} />
            </div>
          </div>

          <div>
            <Label htmlFor="c-dir">Dirección</Label>
            <Input id="c-dir" value={f.direccion}
              onChange={e => setF({ ...f, direccion: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="c-obs">Observaciones</Label>
            <textarea id="c-obs" rows={3} value={f.observaciones}
              onChange={e => setF({ ...f, observaciones: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          {similares.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                Puede que ya esté cargado
              </p>
              <ul className="mt-2 space-y-1.5">
                {similares.map(s => (
                  <li key={s.id} className="text-xs leading-tight">
                    <span className="font-semibold">{s.numero}</span> · {s.cliente}
                    {s.direccion && <> · {s.direccion}</>}
                    <span className="text-muted-foreground">
                      {" "}· {ESTADO_INFO[s.estado as EstadoCaso]?.label ?? s.estado}
                      {" "}· {fechaHoraCorta(s.created_at)} · {s.motivo}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-300/70">
                Si es otro paquete del mismo cliente, seguí adelante.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear caso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
