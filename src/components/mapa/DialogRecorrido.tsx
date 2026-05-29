"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormRecorrido } from "./FormRecorrido";
import type { RecorridoGeo } from "@/types/database.types";

interface DialogRecorridoProps {
  /** Trigger que abre el dialog */
  children: React.ReactNode;
  /** Si se pasa, modo edición; si no, modo creación */
  recorrido?: RecorridoGeo;
  /** Controlled: abierto desde afuera */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DialogRecorrido({
  children,
  recorrido,
  open,
  onOpenChange,
}: DialogRecorridoProps) {
  const modoEdicion = !!recorrido;
  const titulo = modoEdicion ? "Editar recorrido" : "Nuevo recorrido";
  const subtitulo = modoEdicion
    ? `Editando ${recorrido.codigo} — ${recorrido.nombre}`
    : "Completá los campos para crear un recorrido";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Contenido */}
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[1001] -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-md bg-background rounded-xl shadow-xl border p-5",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "duration-200"
          )}
        >
          {/* Cabecera */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{titulo}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                {subtitulo}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Dialog.Close>
          </div>

          {/* Formulario */}
          <FormRecorrido
            recorrido={recorrido}
            onExito={() => onOpenChange?.(false)}
            onCancelar={() => onOpenChange?.(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
