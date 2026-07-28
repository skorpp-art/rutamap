"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Printer, Trash2, Check, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { mensajeDe, formatearTelefono } from "@/lib/whatsapp";
import type { CasoAlternativa, EstadoAlternativa } from "@/app/actions/alternativas";
import { ESTADO_INFO, TIPO_INFO, type RecorridoDia } from "./comun";

interface Props {
  caso: CasoAlternativa;
  puedeEditar: boolean;
  recorridos: RecorridoDia[];
  conductores: string[];
  /** Guarda los datos del caso (cliente, teléfono, dirección, recorrido, chofer). */
  onGuardarDatos: (c: CasoAlternativa) => Promise<void>;
  onGuardarRespuesta: (id: string, alternativa: string, observacion: string) => Promise<void>;
  onEnviar: (c: CasoAlternativa) => void;
  onEstado: (id: string, estado: EstadoAlternativa) => Promise<void>;
  onImprimir: (c: CasoAlternativa) => void;
  onEliminar: (id: string) => Promise<void>;
}

export function AlternativasDrawer({
  caso, puedeEditar, recorridos, conductores,
  onGuardarDatos, onGuardarRespuesta, onEnviar, onEstado, onImprimir, onEliminar,
}: Props) {
  // Copia local editable. Se reinicia al cambiar de caso.
  const [borrador, setBorrador] = useState(caso);
  const [alternativa, setAlternativa] = useState(caso.alternativa ?? "");
  const [observacion, setObservacion] = useState(caso.observacion ?? "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setBorrador(caso);
    setAlternativa(caso.alternativa ?? "");
    setObservacion(caso.observacion ?? "");
  }, [caso]);

  // Guardado automático: en el prototipo, cambiar de fila perdía lo tipeado sin
  // aviso. Acá se guarda solo, con el mismo criterio que la Carga del Día.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef(false);
  function editar(patch: Partial<CasoAlternativa>) {
    const nuevo = { ...borrador, ...patch };
    setBorrador(nuevo);
    pendiente.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setGuardando(true);
      await onGuardarDatos(nuevo);
      pendiente.current = false;
      setGuardando(false);
    }, 700);
  }
  // Si se desmonta (o se cambia de caso) con cambios sin volcar, se guardan ya.
  useEffect(() => {
    const t = timer.current;
    return () => { if (t) clearTimeout(t); };
  }, [caso.id]);

  const tipo = TIPO_INFO[borrador.tipo];
  const estado = ESTADO_INFO[borrador.estado];
  const esAlt = borrador.tipo === "alternativa";
  const mensaje = mensajeDe(borrador.tipo, borrador.estado, {
    cliente: borrador.cliente,
    direccion: borrador.direccion,
    alternativa, observacion,
  });

  async function guardarRespuesta() {
    if (!alternativa.trim()) return;
    setGuardando(true);
    await onGuardarRespuesta(borrador.id, alternativa, observacion);
    setGuardando(false);
  }

  return (
    // flex-1 y no h-full: en pantallas chicas el contenedor no tiene alto fijo,
    // así el panel crece con su contenido en vez de colapsar.
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* Encabezado */}
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="text-base font-black leading-tight truncate">{borrador.cliente || "(sin nombre)"}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {formatearTelefono(borrador.telefono) || "sin teléfono"}<br />
              {borrador.direccion || "sin dirección"}<br />
              {borrador.chofer || "sin conductor"}{borrador.codigo ? ` · ${borrador.codigo}` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", tipo.clase)}>{tipo.label}</span>
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", estado.clase)}>{estado.label}</span>
          </div>
        </div>

        <div className="border-t" />

        {/* Mensaje */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            {borrador.estado === "alternativa" || borrador.estado === "impreso"
              ? "Mensaje de confirmación" : "Mensaje de WhatsApp"}
          </p>
          <div className="rounded-lg rounded-tl-none border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {mensaje}
          </div>
        </div>

        {/* Datos del caso */}
        <div className="border-t" />
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Datos del caso</p>
          <Campo label="Cliente" valor={borrador.cliente}
            onChange={v => editar({ cliente: v })} disabled={!puedeEditar} />
          <Campo label="Teléfono" valor={borrador.telefono ?? ""}
            onChange={v => editar({ telefono: v })} disabled={!puedeEditar} placeholder="1155551234" />
          <Campo label="Dirección original" valor={borrador.direccion ?? ""}
            onChange={v => editar({ direccion: v })} disabled={!puedeEditar} />

          {/* Recorrido del día: al elegirlo se completa el conductor solo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recorrido del día</label>
            <select
              value={borrador.recorrido_id ?? ""}
              disabled={!puedeEditar}
              onChange={e => {
                const r = recorridos.find(x => x.recorrido_id === e.target.value);
                editar({
                  recorrido_id: e.target.value || null,
                  codigo: r?.codigo ?? null,
                  zona: r?.zona ?? null,
                  chofer: r?.chofer ?? borrador.chofer,
                });
              }}
              className="h-10 text-sm border rounded-md px-2.5 bg-background disabled:opacity-60"
            >
              <option value="">— sin asignar —</option>
              {recorridos.map(r => (
                <option key={r.recorrido_id} value={r.recorrido_id}>
                  {r.codigo} · {r.zona}{r.chofer ? ` · ${r.chofer}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Conductor / Móvil</label>
            <input list="rm-conductores" value={borrador.chofer ?? ""} disabled={!puedeEditar}
              onChange={e => editar({ chofer: e.target.value })}
              className="h-10 text-sm border rounded-md px-2.5 bg-background disabled:opacity-60"
              placeholder="Marcelo Fernández / Móvil 3" />
            <datalist id="rm-conductores">
              {conductores.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {/* Respuesta del cliente (sólo para los casos de alternativa) */}
        {esAlt ? (
          <>
            <div className="border-t" />
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Respuesta del cliente</p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dirección alternativa</label>
                <textarea rows={3} value={alternativa} disabled={!puedeEditar}
                  onChange={e => setAlternativa(e.target.value)}
                  className="text-sm border rounded-md px-2.5 py-2 bg-background resize-y disabled:opacity-60 min-h-[72px]"
                  placeholder="Av. Juan de Garay 3450, San Telmo (Portería A)" />
              </div>
              <Campo label="Observación para el chofer" valor={observacion}
                onChange={setObservacion} disabled={!puedeEditar}
                placeholder="Entregar de tarde. Dejar con el encargado." />
              {puedeEditar && (
                <Button size="sm" variant="outline" onClick={guardarRespuesta}
                  disabled={!alternativa.trim() || guardando}
                  className="w-full h-10 gap-1.5 text-sm font-bold">
                  <Save className="h-3.5 w-3.5" />
                  Guardar respuesta y preparar etiqueta
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground bg-muted/60 rounded-md p-2.5 leading-relaxed">
            Los casos de <strong>demora</strong> no generan etiqueta: se avisa al cliente y se cierran.
          </p>
        )}
      </div>

      {/* Acciones */}
      {puedeEditar && (
        <div className="border-t bg-muted/30 p-3 space-y-1.5">
          {guardando && <p className="text-xs text-muted-foreground text-center">Guardando…</p>}

          {borrador.estado === "pendiente" && (
            <>
              <Button size="sm" onClick={() => onEnviar(borrador)}
                className="w-full h-10 gap-1.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp y marcar enviado
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEstado(borrador.id, "enviado")}
                className="w-full h-10 gap-1.5 text-sm font-bold">
                <Check className="h-3.5 w-3.5" /> Marcar enviado sin abrir
              </Button>
            </>
          )}

          {borrador.estado === "enviado" && (
            <>
              {!esAlt && (
                <Button size="sm" onClick={() => onEstado(borrador.id, "cerrado")}
                  className="w-full h-10 gap-1.5 text-sm font-bold">
                  <Check className="h-3.5 w-3.5" /> Cerrar caso
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onEnviar(borrador)}
                className="w-full h-10 gap-1.5 text-sm font-bold">
                <MessageCircle className="h-3.5 w-3.5" /> Re-enviar mensaje
              </Button>
            </>
          )}

          {(borrador.estado === "alternativa" || borrador.estado === "impreso") && (
            <>
              <Button size="sm" onClick={() => onEnviar(borrador)}
                className="w-full h-10 gap-1.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                <MessageCircle className="h-3.5 w-3.5" /> Enviar confirmación al cliente
              </Button>
              <Button size="sm" variant="outline" onClick={() => onImprimir(borrador)}
                className="w-full h-10 gap-1.5 text-sm font-bold">
                <Printer className="h-3.5 w-3.5" /> Imprimir esta etiqueta
              </Button>
            </>
          )}

          {borrador.estado === "cerrado" && (
            <Button size="sm" variant="outline" onClick={() => onEstado(borrador.id, "enviado")}
              className="w-full h-10 gap-1.5 text-sm font-bold">
              <RotateCcw className="h-3.5 w-3.5" /> Reabrir caso
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={() => onEliminar(borrador.id)}
            className="w-full h-9 gap-1.5 text-sm font-bold text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Eliminar caso
          </Button>
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor, onChange, disabled, placeholder }: {
  label: string; valor: string; onChange: (v: string) => void;
  disabled?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      <input value={valor} disabled={disabled} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="h-10 text-sm border rounded-md px-2.5 bg-background disabled:opacity-60" />
    </div>
  );
}
