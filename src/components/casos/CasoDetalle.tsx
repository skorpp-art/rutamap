"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X, Loader2, Send, ClipboardList, MessageSquare, RefreshCw, Flag, PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  agregarEvento, cambiarEstado, getCaso,
  type Caso, type EstadoCaso, type EventoCaso,
} from "@/app/actions/casos";
import {
  AREA_LABEL, ESTADOS, ESTADO_INFO, PLANES_ACCION, antesDelCorte, fechaHoraCorta,
} from "./comun";

const ICONO_EVENTO = {
  apertura: PlusCircle,
  plan_accion: ClipboardList,
  cambio_estado: Flag,
  observacion: MessageSquare,
  reintento: RefreshCw,
} as const;

/** Texto legible de un evento: el contenido se guarda como jsonb. */
function describir(e: EventoCaso): { titulo: string; cuerpo?: string } {
  const c = e.contenido as Record<string, string | null>;
  switch (e.tipo_evento) {
    case "apertura":
      return { titulo: `Caso abierto por ${AREA_LABEL[c.area_origen ?? ""] ?? "—"}`, cuerpo: c.observaciones ?? undefined };
    case "plan_accion":
      return { titulo: "Plan de acción", cuerpo: c.texto ?? undefined };
    case "observacion":
      return { titulo: "Observación", cuerpo: c.texto ?? undefined };
    case "reintento":
      return { titulo: "Reintento", cuerpo: c.texto ?? undefined };
    case "cambio_estado":
      return {
        titulo: `${ESTADO_INFO[c.desde as EstadoCaso]?.label ?? c.desde} → ${ESTADO_INFO[c.hasta as EstadoCaso]?.label ?? c.hasta}`,
        cuerpo: c.comentario ?? undefined,
      };
    default:
      return { titulo: e.tipo_evento };
  }
}

/**
 * Ficha del caso: los datos arriba y debajo la línea de tiempo completa.
 *
 * Nada se edita ni se pisa. Un cambio de estado, un plan de acción o una
 * observación son entradas nuevas, así que siempre se puede reconstruir qué
 * pasó y quién lo hizo — que es justo lo que el Excel no permitía.
 */
export function CasoDetalle({
  casoId, puedeGestionar, onCerrar, onCambio,
}: {
  casoId: string;
  puedeGestionar: boolean;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [caso, setCaso] = useState<Caso | null>(null);
  const [eventos, setEventos] = useState<EventoCaso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [tipoNota, setTipoNota] = useState<"observacion" | "plan_accion" | "reintento">("observacion");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const r = await getCaso(casoId);
    if (r.ok) { setCaso(r.data.caso); setEventos(r.data.eventos); }
    else toast.error(r.error);
    setCargando(false);
  }, [casoId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function enviarNota() {
    if (!texto.trim()) return;
    setEnviando(true);
    const r = await agregarEvento(casoId, tipoNota, texto.trim());
    setEnviando(false);
    if (!r.ok) return toast.error(r.error);
    setTexto("");
    await cargar();
    onCambio();
  }

  function agregarEtiqueta(etiqueta: string) {
    setTexto(t => (t.trim() ? `${t.trim()}; ${etiqueta}` : etiqueta));
  }

  async function mover(estado: EstadoCaso) {
    const r = await cambiarEstado(casoId, estado, texto.trim());
    if (!r.ok) return toast.error(r.error);
    setTexto("");
    toast.success(`Pasó a ${ESTADO_INFO[estado].label}`);
    await cargar();
    onCambio();
  }

  return (
    <aside className="w-full sm:w-[26rem] shrink-0 border-l bg-card flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="min-w-0">
          <p className="font-black tracking-tight leading-none truncate">
            {caso?.numero ?? "…"}
          </p>
          <p className="text-xs text-muted-foreground truncate">{caso?.cliente}</p>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {cargando || !caso ? (
        <div className="flex-1 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b space-y-2 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", ESTADO_INFO[caso.estado].clase)}>
                {ESTADO_INFO[caso.estado].label}
              </span>
              {caso.area_responsable !== "cerrado" && (
                <span className="text-xs text-muted-foreground">
                  Responde {AREA_LABEL[caso.area_responsable]}
                </span>
              )}
            </div>
            <Dato k="Incidencia" v={caso.tipo_incidencia} />
            <Dato k="Seguimiento" v={caso.tracking} />
            <Dato k="Dirección" v={caso.direccion} />
            <Dato k="Ejecutivo" v={caso.ejecutivo} />
            <Dato k="Abrió" v={`${AREA_LABEL[caso.area_origen]} · ${fechaHoraCorta(caso.created_at)}`} />
            {!antesDelCorte(caso.created_at) && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Entró después de las 10: no se pudo tocar el recorrido de ese día.
              </p>
            )}
          </div>

          {/* Línea de tiempo */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {eventos.map(e => {
              const { titulo, cuerpo } = describir(e);
              const Icon = ICONO_EVENTO[e.tipo_evento] ?? MessageSquare;
              return (
                <div key={e.id} className="flex gap-2.5">
                  <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-muted grid place-items-center">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{titulo}</p>
                    {cuerpo && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cuerpo}</p>}
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {e.autor ?? "—"} · {fechaHoraCorta(e.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {puedeGestionar && (
            <div className="border-t p-3 space-y-2">
              <div className="flex gap-1">
                {([
                  ["observacion", "Observación"],
                  ["plan_accion", "Plan de acción"],
                  ["reintento", "Reintento"],
                ] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTipoNota(k)}
                    className={cn("px-2 py-1 rounded text-xs font-medium transition-colors",
                      tipoNota === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)}
                  placeholder="Qué pasó o qué se va a hacer…"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button size="icon" onClick={enviarNota} disabled={enviando || !texto.trim()}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {/* Etiquetas del Excel: un clic las suma al texto, no lo pisan. */}
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {PLANES_ACCION.map(p => (
                  <button key={p} type="button" onClick={() => agregarEtiqueta(p)}
                    className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    {p}
                  </button>
                ))}
              </div>
              {/* El comentario escrito arriba viaja con el cambio de estado: así
                  no hay que anotarlo dos veces. */}
              <div className="flex flex-wrap gap-1 pt-1">
                {ESTADOS.filter(e => e !== caso.estado).map(e => (
                  <button key={e} onClick={() => mover(e)} title={ESTADO_INFO[e].desc}
                    className={cn("px-2 py-1 rounded text-xs font-medium", ESTADO_INFO[e].clase)}>
                    {ESTADO_INFO[e].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function Dato({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return (
    <p className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 w-24">{k}</span>
      <span className="min-w-0 break-words">{v}</span>
    </p>
  );
}
