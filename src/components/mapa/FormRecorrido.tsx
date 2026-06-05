"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  COLORES_RECORRIDO,
  ZONAS,
  type Zona,
  type TipoRecorrido,
  type RecorridoGeo,
} from "@/types/database.types";
import {
  crearRecorrido,
  actualizarCamposRecorrido,
} from "@/app/actions/recorridos";

// ─── Schema Zod ───────────────────────────────────────────────────────────────
const schema = z.object({
  codigo: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[A-Z0-9\-]+$/, "Solo letras mayúsculas, números y guiones"),
  nombre: z.string().min(3, "Mínimo 3 caracteres").max(80, "Máximo 80 caracteres"),
  zona: z.enum(["CABA", "Norte", "Sur", "Oeste"] as const),
  tipo: z.enum(["fijo", "suplencia", "corte", "pre_turno"] as const),
  color: z.string().min(1, "Seleccioná un color"),
  descripcion: z.string().max(200, "Máximo 200 caracteres").optional(),
});

export type FormValues = z.infer<typeof schema>;

const TIPOS: { valor: TipoRecorrido; label: string }[] = [
  { valor: "fijo", label: "Fijo" },
  { valor: "suplencia", label: "Suplencia" },
  { valor: "corte", label: "Corte" },
  { valor: "pre_turno", label: "Pre-turno" },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface FormRecorridoProps {
  /** Si se pasa, es modo edición. Si no, modo creación. */
  recorrido?: RecorridoGeo;
  onExito: () => void;
  onCancelar: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function FormRecorrido({ recorrido, onExito, onCancelar }: FormRecorridoProps) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const modoEdicion = !!recorrido;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: recorrido
      ? {
          codigo: recorrido.codigo,
          nombre: recorrido.nombre,
          zona: recorrido.zona,
          tipo: recorrido.tipo,
          color: recorrido.color,
          descripcion: recorrido.descripcion ?? "",
        }
      : {
          color: COLORES_RECORRIDO[0].valor,
          zona: "Oeste" as Zona,
          tipo: "fijo" as TipoRecorrido,
        },
  });

  const colorActual = watch("color");

  async function onSubmit(values: FormValues) {
    setGuardando(true);
    try {
      const datos = {
        ...values,
        descripcion: values.descripcion || null,
      };

      const result = modoEdicion
        ? await actualizarCamposRecorrido(recorrido!.id, datos)
        : await crearRecorrido(datos);

      if (!result.ok) {
        toast.error(modoEdicion ? "Error al actualizar" : "Error al crear recorrido", {
          description: result.error,
        });
        return;
      }

      toast.success(
        modoEdicion ? "Recorrido actualizado" : `Recorrido ${values.codigo} creado`
      );
      router.refresh();
      onExito();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Código + Nombre */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="codigo" className="text-xs">
            Código *
          </Label>
          <Input
            id="codigo"
            {...register("codigo")}
            placeholder="MON-010"
            className="h-8 text-sm uppercase"
            onInput={(e) => {
              const upper = e.currentTarget.value.toUpperCase();
              e.currentTarget.value = upper;
              setValue("codigo", upper, { shouldValidate: true });
            }}
          />
          {errors.codigo && (
            <p className="text-[10px] text-destructive">{errors.codigo.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipo" className="text-xs">
            Tipo *
          </Label>
          <select
            id="tipo"
            {...register("tipo")}
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.tipo && (
            <p className="text-[10px] text-destructive">{errors.tipo.message}</p>
          )}
        </div>
      </div>

      {/* Nombre */}
      <div className="space-y-1.5">
        <Label htmlFor="nombre" className="text-xs">
          Nombre *
        </Label>
        <Input
          id="nombre"
          {...register("nombre")}
          placeholder="Cobertura Haedo Norte"
          className="h-8 text-sm"
        />
        {errors.nombre && (
          <p className="text-[10px] text-destructive">{errors.nombre.message}</p>
        )}
      </div>

      {/* Zona */}
      <div className="space-y-1.5">
        <Label htmlFor="zona" className="text-xs">
          Zona *
        </Label>
        <select
          id="zona"
          {...register("zona")}
          className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm"
        >
          {ZONAS.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        {errors.zona && (
          <p className="text-[10px] text-destructive">{errors.zona.message}</p>
        )}
      </div>

      {/* Color */}
      <div className="space-y-1.5">
        <Label className="text-xs">Color *</Label>
        <div className="flex gap-2 flex-wrap">
          {COLORES_RECORRIDO.map((c) => (
            <button
              key={c.valor}
              type="button"
              title={c.nombre}
              onClick={() => setValue("color", c.valor)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-all",
                colorActual === c.valor
                  ? "border-foreground scale-110 shadow"
                  : "border-transparent hover:border-muted-foreground/50"
              )}
              style={{ backgroundColor: c.valor }}
            />
          ))}
        </div>
        {errors.color && (
          <p className="text-[10px] text-destructive">{errors.color.message}</p>
        )}
      </div>

      {/* Descripción */}
      <div className="space-y-1.5">
        <Label htmlFor="descripcion" className="text-xs">
          Descripción{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <textarea
          id="descripcion"
          {...register("descripcion")}
          rows={2}
          placeholder="Descripción del recorrido…"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {errors.descripcion && (
          <p className="text-[10px] text-destructive">{errors.descripcion.message}</p>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-2 justify-end pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {guardando
            ? "Guardando…"
            : modoEdicion
            ? "Guardar cambios"
            : "Crear recorrido"}
        </Button>
      </div>
    </form>
  );
}
