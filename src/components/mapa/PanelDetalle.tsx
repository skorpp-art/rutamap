"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X, MapPin, Tag, Calendar, Pencil, Route,
  Settings2, PowerOff, Power, Check, Copy, Printer, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DialogRecorrido } from "./DialogRecorrido";
import { HistorialRecorrido } from "./HistorialRecorrido";
import { toggleActivoRecorrido, actualizarCamposRecorrido, duplicarRecorrido, eliminarRecorrido } from "@/app/actions/recorridos";
import type { ModoEdicion } from "./MapaLeaflet";
import type { RecorridoGeo } from "@/types/database.types";

interface PanelDetalleProps {
  recorrido: RecorridoGeo;
  onCerrar: () => void;
  onIniciarEdicionArea?: () => void;
  onIniciarEdicionTraza?: () => void;
  modoEdicion?: ModoEdicion;
  onImprimirRecorrido?: () => void;
  puedeEditar?: boolean;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

// ─── Campo inline editable ────────────────────────────────────────────────────
interface CampoInlineProps {
  valor: string;
  className?: string;
  placeholder?: string;
  mayusculas?: boolean;
  bloqueado?: boolean;
  onGuardar: (nuevoValor: string) => Promise<void>;
}

function CampoInline({
  valor,
  className,
  placeholder,
  mayusculas = false,
  bloqueado = false,
  onGuardar,
}: CampoInlineProps) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync si el recorrido cambia desde afuera (ej: router.refresh)
  useEffect(() => {
    if (!editando) setDraft(valor);
  }, [valor, editando]);

  function iniciar() {
    if (bloqueado) return;
    setDraft(valor);
    setEditando(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function cancelar() {
    setDraft(valor);
    setEditando(false);
  }

  async function guardar() {
    const nuevo = draft.trim();
    if (!nuevo || nuevo === valor) { cancelar(); return; }
    setGuardando(true);
    try {
      await onGuardar(nuevo);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); guardar(); }
    if (e.key === "Escape") cancelar();
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1 -mx-1">
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) =>
            setDraft(mayusculas ? e.target.value.toUpperCase() : e.target.value)
          }
          onKeyDown={handleKeyDown}
          onBlur={guardar}
          placeholder={placeholder}
          disabled={guardando}
          className={cn(
            "flex-1 min-w-0 rounded px-1 bg-accent border border-blue-400 outline-none",
            className
          )}
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); guardar(); }}
          className="text-green-600 dark:text-green-300 hover:text-green-700 shrink-0"
          title="Guardar"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <span
      onClick={iniciar}
      title={bloqueado ? undefined : "Click para editar"}
      className={cn(
        "group flex items-center gap-1 rounded px-1 -mx-1 leading-tight",
        !bloqueado && "cursor-pointer hover:bg-accent/60 transition-colors",
        className
      )}
    >
      <span className="truncate">{valor || <span className="text-muted-foreground italic">{placeholder}</span>}</span>
      {!bloqueado && (
        <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function PanelDetalle({
  recorrido,
  onCerrar,
  onIniciarEdicionArea,
  onIniciarEdicionTraza,
  modoEdicion = null,
  onImprimirRecorrido,
  puedeEditar = true,
}: PanelDetalleProps) {
  const router = useRouter();
  const [dialogEditarOpen, setDialogEditarOpen] = useState(false);
  const [togglando, setTogglando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const [mostrarDuplicar, setMostrarDuplicar] = useState(false);
  const [codigoCopia, setCodigoCopia] = useState("");
  const editandoGeometria = modoEdicion !== null;

  const fechaCreacion = new Date(recorrido.creado_en).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const fechaActualizacion = new Date(recorrido.actualizado_en).toLocaleDateString(
    "es-AR", { day: "2-digit", month: "short", year: "numeric" }
  );

  // Guardar un campo individual manteniendo el resto igual
  async function guardarCampo(campo: "codigo" | "nombre", nuevoValor: string) {
    if (!nuevoValor.trim()) return;
    const result = await actualizarCamposRecorrido(recorrido.id, {
      codigo: campo === "codigo" ? nuevoValor.trim().toUpperCase() : recorrido.codigo,
      nombre: campo === "nombre" ? nuevoValor.trim() : recorrido.nombre,
      zona: recorrido.zona,
      tipo: recorrido.tipo,
      color: recorrido.color,
      descripcion: recorrido.descripcion,
    });
    if (!result.ok) {
      toast.error(`Error al actualizar ${campo}`, { description: result.error });
      throw new Error(result.error);
    }
    toast.success(`${campo === "codigo" ? "Código" : "Nombre"} actualizado`);
    router.refresh();
  }

  async function handleDuplicar() {
    const codigo = codigoCopia.trim().toUpperCase();
    if (codigo.length < 2) {
      toast.error("El código debe tener al menos 2 caracteres");
      return;
    }
    setDuplicando(true);
    try {
      const result = await duplicarRecorrido(recorrido.id, codigo);
      if (!result.ok) {
        toast.error("Error al duplicar", { description: result.error });
      } else {
        toast.success(`Recorrido duplicado como ${codigo} (inactivo)`);
        setMostrarDuplicar(false);
        setCodigoCopia("");
        router.refresh();
      }
    } finally {
      setDuplicando(false);
    }
  }

  function handleImprimir() {
    onImprimirRecorrido?.();
  }

  async function handleEliminar() {
    if (!confirm(`¿Eliminar permanentemente el recorrido ${recorrido.codigo}?\n\nEsta acción NO se puede deshacer.`)) return;
    setEliminando(true);
    try {
      const result = await eliminarRecorrido(recorrido.id);
      if (!result.ok) {
        toast.error("Error al eliminar", { description: result.error });
      } else {
        toast.success(`Recorrido ${recorrido.codigo} eliminado`);
        onCerrar();
        router.refresh();
      }
    } finally {
      setEliminando(false);
    }
  }

  async function handleToggleActivo() {
    const accion = recorrido.activo ? "desactivar" : "activar";
    if (!confirm(`¿Seguro que querés ${accion} el recorrido ${recorrido.codigo}?`)) return;
    setTogglando(true);
    try {
      const result = await toggleActivoRecorrido(recorrido.id, !recorrido.activo);
      if (!result.ok) {
        toast.error(`Error al ${accion}`, { description: result.error });
      } else {
        if (recorrido.activo) {
          toast.success(`Recorrido desactivado. Para reactivarlo: en el panel izquierdo tocá "activos" para ver todos.`, { duration: 8000 });
        } else {
          toast.success(`Recorrido activado correctamente`);
        }
        router.refresh();
      }
    } finally {
      setTogglando(false);
    }
  }

  return (
    <aside className="flex flex-col h-full w-72 shrink-0 border-l bg-background shadow-sm">

      {/* ── Cabecera con edición inline ── */}
      <div className="flex items-start gap-2 px-3 py-3 border-b">
        <div
          className="mt-0.5 h-5 w-5 rounded-full shrink-0 ring-1 ring-black/10"
          style={{ backgroundColor: recorrido.color }}
        />
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Código — editable inline */}
          <CampoInline
            valor={recorrido.codigo}
            className="font-semibold text-sm text-foreground"
            placeholder="Código…"
            mayusculas
            bloqueado={editandoGeometria}
            onGuardar={(v) => guardarCampo("codigo", v)}
          />
          {/* Nombre — editable inline */}
          <CampoInline
            valor={recorrido.nombre}
            className="text-xs text-muted-foreground"
            placeholder="Nombre del recorrido…"
            bloqueado={editandoGeometria}
            onGuardar={(v) => guardarCampo("nombre", v)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 -mr-1 -mt-0.5"
          onClick={onCerrar}
          disabled={editandoGeometria}
          title={editandoGeometria ? "Guardá o cancelá antes de cerrar" : undefined}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Banner modo edición geometría */}
      {editandoGeometria && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            Editando {modoEdicion === "area" ? "área" : "traza"}…
          </span>
        </div>
      )}

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-4">
          {/* Clasificación */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {recorrido.zona}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 text-xs",
                recorrido.tipo === "suplencia" && "border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-300"
              )}
            >
              <Tag className="h-3 w-3" />
              {recorrido.tipo}
            </Badge>
            {!recorrido.activo && (
              <Badge variant="destructive" className="text-xs">Inactivo</Badge>
            )}
          </div>

          <Separator />

          {recorrido.descripcion && (
            <Campo label="Descripción">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {recorrido.descripcion}
              </p>
            </Campo>
          )}

          {/* Geometría */}
          <Campo label="Geometría">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", recorrido.area_geojson ? "bg-green-500" : "bg-slate-300")} />
                <span className="text-xs text-muted-foreground">
                  {recorrido.area_geojson ? "Área cargada" : "Sin área"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", recorrido.traza_geojson ? "bg-green-500" : "bg-slate-300")} />
                <span className="text-xs text-muted-foreground">
                  {recorrido.traza_geojson ? "Traza cargada" : "Sin traza"}
                </span>
              </div>
            </div>
          </Campo>

          <Separator />

          <div className="space-y-3">
            <Campo label="Creado">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {fechaCreacion}
              </div>
            </Campo>
            <Campo label="Última actualización">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {fechaActualizacion}
              </div>
            </Campo>
          </div>

          <Separator />

          <HistorialRecorrido recorridoId={recorrido.id} />

          <Separator />

          <Campo label="ID">
            <span className="text-[10px] font-mono text-muted-foreground break-all">
              {recorrido.id}
            </span>
          </Campo>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="px-3 py-2.5 border-t space-y-1.5">
        {!puedeEditar && (
          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-1">
            👁 Modo invitado — solo lectura. Iniciá sesión para editar recorridos.
          </div>
        )}

        {puedeEditar && (
        <>
        <Button
          variant="outline" size="sm"
          className={cn("w-full text-xs gap-1.5", modoEdicion === "area" && "border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40")}
          onClick={onIniciarEdicionArea}
          disabled={!onIniciarEdicionArea || editandoGeometria}
        >
          <Pencil className="h-3 w-3" />
          {modoEdicion === "area" ? "Editando área…" : "Editar área"}
        </Button>

        <Button
          variant="outline" size="sm"
          className={cn("w-full text-xs gap-1.5", modoEdicion === "traza" && "border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40")}
          onClick={onIniciarEdicionTraza}
          disabled={!onIniciarEdicionTraza || editandoGeometria}
        >
          <Route className="h-3 w-3" />
          {modoEdicion === "traza" ? "Editando traza…" : "Editar traza"}
        </Button>

        <Separator />

        <DialogRecorrido recorrido={recorrido} open={dialogEditarOpen} onOpenChange={setDialogEditarOpen}>
          <Button
            variant="outline" size="sm"
            className="w-full text-xs gap-1.5"
            disabled={editandoGeometria}
          >
            <Settings2 className="h-3 w-3" />
            Editar todos los campos
          </Button>
        </DialogRecorrido>

        <Button
          variant="outline" size="sm"
          className={cn(
            "w-full text-xs gap-1.5",
            recorrido.activo
              ? "text-destructive hover:bg-destructive/10 border-destructive/30"
              : "text-green-600 dark:text-green-300 hover:bg-green-50 border-green-300 dark:border-green-800"
          )}
          onClick={handleToggleActivo}
          disabled={editandoGeometria || togglando}
        >
          {recorrido.activo
            ? <><PowerOff className="h-3 w-3" />{togglando ? "Desactivando…" : "Desactivar"}</>
            : <><Power className="h-3 w-3" />{togglando ? "Activando…" : "Activar recorrido"}</>
          }
        </Button>

        <Separator />

        {/* Duplicar */}
        {!mostrarDuplicar ? (
          <Button
            variant="outline" size="sm"
            className="w-full text-xs gap-1.5"
            disabled={editandoGeometria}
            onClick={() => {
              setCodigoCopia(recorrido.codigo + "-C");
              setMostrarDuplicar(true);
            }}
          >
            <Copy className="h-3 w-3" />
            Duplicar recorrido
          </Button>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground">Código para la copia:</p>
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={codigoCopia}
                onChange={(e) => setCodigoCopia(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDuplicar();
                  if (e.key === "Escape") { setMostrarDuplicar(false); setCodigoCopia(""); }
                }}
                placeholder="Ej: MON-010-C"
                className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs uppercase outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                size="sm"
                className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleDuplicar}
                disabled={duplicando}
              >
                {duplicando ? "…" : "OK"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => { setMostrarDuplicar(false); setCodigoCopia(""); }}
              >
                ✕
              </Button>
            </div>
          </div>
        )}
        </>
        )}

        {/* Imprimir — disponible también para invitados */}
        <Button
          variant="outline" size="sm"
          className="w-full text-xs gap-1.5"
          disabled={editandoGeometria}
          onClick={handleImprimir}
          title="Abre el diálogo de impresión del navegador"
        >
          <Printer className="h-3 w-3" />
          Imprimir / PDF
        </Button>

        {puedeEditar && (
          <>
            <Separator />
            {/* Eliminar */}
            <Button
              variant="outline" size="sm"
              className="w-full text-xs gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/20"
              disabled={editandoGeometria || eliminando}
              onClick={handleEliminar}
              title="Eliminar el recorrido permanentemente"
            >
              <Trash2 className="h-3 w-3" />
              {eliminando ? "Eliminando…" : "Eliminar recorrido"}
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
