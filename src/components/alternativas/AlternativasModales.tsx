"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Printer, Upload, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { mensajeDe, formatearTelefono } from "@/lib/whatsapp";
import { armarEtiqueta } from "@/lib/etiquetas";
import type { CasoAlternativa, FilaImportada, TipoAlternativa } from "@/app/actions/alternativas";
import { TIPO_INFO } from "./comun";

function Overlay({ children, onClose, ancho = "max-w-lg" }: {
  children: React.ReactNode; onClose: () => void; ancho?: string;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className={cn("bg-background border rounded-2xl shadow-2xl w-full max-h-[88vh] flex flex-col", ancho)}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Cabecera({ titulo, onClose }: { titulo: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b px-5 py-3.5 shrink-0">
      <p className="text-sm font-black">{titulo}</p>
      <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function PillsTipo({ valor, onChange }: { valor: TipoAlternativa; onChange: (t: TipoAlternativa) => void }) {
  return (
    <div className="flex gap-2">
      {(["alternativa", "demora"] as TipoAlternativa[]).map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={cn("px-3 h-9 rounded-md border-2 text-xs font-bold transition-colors",
            valor === t
              ? t === "alternativa"
                ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                : "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-border text-muted-foreground hover:border-muted-foreground")}>
          {t === "alternativa" ? "Pedir alternativa" : "Aviso de demora"}
        </button>
      ))}
    </div>
  );
}

// ═══ Importar desde planilla ═══════════════════════════════════════════════
export function ImportarModal({ onClose, onImportar }: {
  onClose: () => void;
  onImportar: (tipo: TipoAlternativa, filas: FilaImportada[]) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoAlternativa>("alternativa");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Una fila por línea, columnas separadas por tabulaciones: es lo que sale de
  // copiar celdas de Google Sheets o Excel.
  const filas = useMemo<FilaImportada[]>(() => {
    return texto.split("\n").map(linea => {
      const p = linea.split("\t").map(s => s.trim());
      if (!p[0]) return null;
      return { cliente: p[0], telefono: p[1] ?? "", direccion: p[2] ?? "", chofer: p[3] ?? "" };
    }).filter(Boolean) as FilaImportada[];
  }, [texto]);

  return (
    <Overlay onClose={onClose} ancho="max-w-2xl">
      <Cabecera titulo="Importar lista de casos" onClose={onClose} />
      <div className="p-5 space-y-3.5 overflow-y-auto">
        <div className="text-xs leading-relaxed bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-lg p-3">
          <strong>Pegá las celdas desde la planilla.</strong><br />
          Orden de columnas: <code className="font-mono">Cliente · Teléfono · Dirección · Conductor</code><br />
          Los que ya estén cargados hoy con el mismo teléfono se omiten solos.
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo para toda la lista</p>
          <PillsTipo valor={tipo} onChange={setTipo} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Datos</p>
          <textarea rows={9} value={texto} onChange={e => setTexto(e.target.value)}
            className="w-full text-sm border rounded-md px-2.5 py-2 bg-background font-mono resize-y"
            placeholder={"Juan García\t1155551234\tAv. Belgrano 1364, CABA\tMarcelo F / Móvil 3"} />
          {filas.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {filas.length} caso(s) detectado(s) — se cargan como &ldquo;{TIPO_INFO[tipo].label}&rdquo;.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3 shrink-0">
        <Button size="sm" variant="outline" onClick={onClose} className="h-9 text-xs font-bold">Cancelar</Button>
        <Button size="sm" disabled={!filas.length || enviando}
          onClick={async () => { setEnviando(true); await onImportar(tipo, filas); setEnviando(false); }}
          className="h-9 gap-1.5 text-xs font-bold">
          <Upload className="h-3.5 w-3.5" /> Importar
        </Button>
      </div>
    </Overlay>
  );
}

// ═══ Alta manual ═══════════════════════════════════════════════════════════
export function ManualModal({ onClose, onAgregar, conductores }: {
  onClose: () => void;
  onAgregar: (tipo: TipoAlternativa, f: FilaImportada) => Promise<void>;
  conductores: string[];
}) {
  const [tipo, setTipo] = useState<TipoAlternativa>("alternativa");
  const [f, setF] = useState<FilaImportada>({ cliente: "", telefono: "", direccion: "", chofer: "" });
  const [enviando, setEnviando] = useState(false);

  return (
    <Overlay onClose={onClose} ancho="max-w-md">
      <Cabecera titulo="Agregar caso" onClose={onClose} />
      <div className="p-5 space-y-3 overflow-y-auto">
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo de caso</p>
          <PillsTipo valor={tipo} onChange={setTipo} />
        </div>
        {([
          ["Cliente", "cliente", "Juan Manuel García"],
          ["Teléfono", "telefono", "1155551234"],
          ["Dirección original", "direccion", "Av. Belgrano 1364, CABA"],
          ["Conductor / Móvil", "chofer", "Marcelo Fernández / Móvil 3"],
        ] as const).map(([label, key, ph]) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
            <input value={f[key]} placeholder={ph}
              list={key === "chofer" ? "rm-conductores-alta" : undefined}
              onChange={e => setF(prev => ({ ...prev, [key]: e.target.value }))}
              className="h-9 text-sm border rounded-md px-2 bg-background" />
          </div>
        ))}
        <datalist id="rm-conductores-alta">
          {conductores.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3 shrink-0">
        <Button size="sm" variant="outline" onClick={onClose} className="h-9 text-xs font-bold">Cancelar</Button>
        <Button size="sm" disabled={!f.cliente.trim() || enviando}
          onClick={async () => { setEnviando(true); await onAgregar(tipo, f); setEnviando(false); }}
          className="h-9 gap-1.5 text-xs font-bold">
          <UserPlus className="h-3.5 w-3.5" /> Agregar
        </Button>
      </div>
    </Overlay>
  );
}

// ═══ Envío secuencial ══════════════════════════════════════════════════════
export function SecuencialModal({ cola, onClose, onEnviar }: {
  cola: CasoAlternativa[];
  onClose: () => void;
  /** Abre WhatsApp y marca enviado. Devuelve false si el navegador bloqueó la ventana. */
  onEnviar: (c: CasoAlternativa) => boolean;
}) {
  const [i, setI] = useState(0);
  const actual = cola[i];
  const listo = i >= cola.length;

  const enviar = useMemo(() => () => {
    const c = cola[i];
    if (!c) return;
    if (!c.telefono?.replace(/\D/g, "")) return;   // sin teléfono: hay que saltearlo
    if (onEnviar(c)) setI(n => n + 1);
  }, [cola, i, onEnviar]);

  // Enter envía, → saltea. El modal no tiene campos de texto, así que no pisa
  // ninguna escritura del usuario.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") { e.preventDefault(); enviar(); }
      if (e.key === "ArrowRight") { e.preventDefault(); setI(n => n + 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enviar]);

  const pct = cola.length ? Math.round(Math.min(i, cola.length) / cola.length * 100) : 0;

  return (
    <Overlay onClose={onClose} ancho="max-w-lg">
      <Cabecera titulo="Envío secuencial" onClose={onClose} />
      <div className="p-5 space-y-3.5 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-black text-muted-foreground tabular-nums">
            {Math.min(i, cola.length)} / {cola.length}
          </span>
        </div>

        {listo ? (
          <p className="text-center py-8 text-base font-black text-emerald-600 dark:text-emerald-400">
            Todos los mensajes enviados
          </p>
        ) : (
          <>
            <div className="bg-muted/60 rounded-lg p-3.5 border-l-4 border-emerald-500">
              <p className="text-base font-black">{actual.cliente || "(sin nombre)"}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {actual.direccion || "sin dirección"}<br />
                {actual.chofer || "sin conductor"}
              </p>
              <p className={cn("text-sm font-black mt-1.5 font-mono",
                actual.telefono ? "text-blue-700 dark:text-blue-300" : "text-destructive")}>
                {formatearTelefono(actual.telefono) || "sin teléfono — saltealo"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Mensaje</p>
              <div className="rounded-lg border p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900">
                {mensajeDe(actual.tipo, actual.estado, {
                  cliente: actual.cliente, direccion: actual.direccion,
                  alternativa: actual.alternativa, observacion: actual.observacion,
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              <kbd className="border rounded px-1.5 py-0.5 font-mono text-xs">Enter</kbd> enviar ·{" "}
              <kbd className="border rounded px-1.5 py-0.5 font-mono text-xs">→</kbd> saltar
            </p>
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-5 py-3 shrink-0">
        <Button size="sm" variant="outline" onClick={() => setI(n => n + 1)} disabled={listo}
          className="h-9 text-xs font-bold">Saltar →</Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onClose} className="h-9 text-xs font-bold">Cerrar</Button>
          <Button size="sm" onClick={enviar} disabled={listo}
            className="h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
            <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

// ═══ Impresión de etiquetas ════════════════════════════════════════════════
export function ImprimirModal({ casos, onClose, onImprimir }: {
  casos: CasoAlternativa[];
  onClose: () => void;
  onImprimir: (porHoja: 6 | 8, marcar: boolean) => void;
}) {
  const [porHoja, setPorHoja] = useState<6 | 8>(8);
  const hojas = Math.ceil(casos.length / porHoja);

  return (
    <Overlay onClose={onClose} ancho="max-w-3xl">
      <Cabecera titulo="Imprimir etiquetas" onClose={onClose} />
      <div className="p-5 space-y-3.5 overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Por hoja A4:</span>
          {([8, 6] as const).map(n => (
            <button key={n} onClick={() => setPorHoja(n)}
              className={cn("px-3 h-8 rounded-md border text-xs font-bold transition-colors",
                porHoja === n ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:bg-muted")}>
              {n} ({n === 8 ? "2×4" : "2×3"})
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {casos.length} etiqueta(s) · {hojas} hoja(s)
          </span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Vista previa</p>
        <div className="grid grid-cols-2 gap-2 bg-muted/60 p-3 rounded-lg max-h-[340px] overflow-y-auto">
          {casos.map(c => (
            <div key={c.id} style={{ height: porHoja === 8 ? 110 : 135 }}
              dangerouslySetInnerHTML={{
                __html: armarEtiqueta({
                  cliente: c.cliente, direccion: c.direccion, chofer: c.chofer,
                  alternativa: c.alternativa, observacion: c.observacion, zona: c.zona,
                }, porHoja),
              }} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3 shrink-0">
        <Button size="sm" variant="outline" onClick={onClose} className="h-9 text-xs font-bold">Cancelar</Button>
        <Button size="sm" variant="outline" onClick={() => onImprimir(porHoja, false)}
          className="h-9 text-xs font-bold">Imprimir sin marcar</Button>
        <Button size="sm" onClick={() => onImprimir(porHoja, true)} className="h-9 gap-1.5 text-xs font-bold">
          <Printer className="h-3.5 w-3.5" /> Imprimir y marcar
        </Button>
      </div>
    </Overlay>
  );
}
