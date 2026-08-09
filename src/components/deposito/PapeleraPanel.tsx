"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Trash2, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { depositoClient } from "@/lib/supabase/deposito";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DIAS_PAPELERA } from "@/types/deposito.types";

interface ItemBorrado {
  id: string;
  tipo: "cliente" | "bulto";
  nombre: string;
  deleted_at: string;
}

export function PapeleraPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const [items, setItems] = useState<ItemBorrado[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = depositoClient();
      // La papelera es para deshacer un error reciente, no un archivo: se
      // muestra sólo la última ventana de días y lo anterior se puede purgar.
      const limite = new Date(Date.now() - DIAS_PAPELERA * 86_400_000).toISOString();
      const [{ data: clientes }, { data: bultos }] = await Promise.all([
        supabase.from("clients").select("id, name, deleted_at")
          .not("deleted_at", "is", null).gte("deleted_at", limite)
          .order("deleted_at", { ascending: false }),
        supabase.from("bultos").select("id, description, barcode, deleted_at, clients(name)")
          .not("deleted_at", "is", null).gte("deleted_at", limite)
          .order("deleted_at", { ascending: false }),
      ]);

      const todos: ItemBorrado[] = [
        ...(clientes ?? []).map(c => ({
          id: c.id as string,
          tipo: "cliente" as const,
          nombre: c.name as string,
          deleted_at: c.deleted_at as string,
        })),
        ...(bultos ?? []).map(b => {
          // El join puede venir como objeto o como array según la relación.
          const rel = (b as Record<string, unknown>).clients;
          const cliente = Array.isArray(rel)
            ? (rel[0] as { name?: string } | undefined)?.name
            : (rel as { name?: string } | null)?.name;
          return {
            id: b.id as string,
            tipo: "bulto" as const,
            nombre: `${b.description || b.barcode || "Sin descripción"} · ${cliente ?? "cliente eliminado"}`,
            deleted_at: b.deleted_at as string,
          };
        }),
      ].sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

      setItems(todos);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function restaurar(item: ItemBorrado) {
    if (!puedeEditar) return;
    const supabase = depositoClient();
    const tabla = item.tipo === "cliente" ? "clients" : "bultos";
    // Un bulto restaurado vuelve a estar guardado; si no, quedaría en la lista
    // con el estado "eliminado" y sin manera de sacarlo de ahí.
    const cambios: Record<string, unknown> = { deleted_at: null };
    if (item.tipo === "bulto") cambios.status = "stored";
    const { error } = await supabase.from(tabla).update(cambios).eq("id", item.id);
    if (error) { toast.error("No se pudo restaurar", { description: error.message }); return; }
    toast.success(`${item.tipo === "cliente" ? "Cliente" : "Bulto"} restaurado`);
    cargar();
  }

  // Purga lo que ya salió de la ventana: son cosas que nadie va a restaurar y
  // que sólo ocupan lugar.
  async function vaciarViejo() {
    if (!puedeEditar) return;
    if (!confirm(
      `¿Eliminar definitivamente todo lo que se borró hace más de ${DIAS_PAPELERA} días?\n\n` +
      "No se puede deshacer. Lo de la ventana actual queda intacto."
    )) return;
    const supabase = depositoClient();
    const limite = new Date(Date.now() - DIAS_PAPELERA * 86_400_000).toISOString();
    const [rb, rc] = await Promise.all([
      supabase.from("bultos").delete().not("deleted_at", "is", null).lt("deleted_at", limite),
      supabase.from("clients").delete().not("deleted_at", "is", null).lt("deleted_at", limite),
    ]);
    if (rb.error || rc.error) {
      toast.error("No se pudo vaciar", { description: (rb.error ?? rc.error)?.message });
      return;
    }
    toast.success("Papelera vaciada");
    cargar();
  }

  async function borrarDefinitivo(item: ItemBorrado) {
    if (!puedeEditar) return;
    if (!confirm(
      `¿Eliminar definitivamente ${item.tipo === "cliente" ? "el cliente" : "el bulto"} "${item.nombre}"?\n\n` +
      (item.tipo === "cliente"
        ? "Se borran también todos sus bultos. "
        : "") + "Esta acción no se puede deshacer."
    )) return;
    const supabase = depositoClient();
    const tabla = item.tipo === "cliente" ? "clients" : "bultos";
    const { error } = await supabase.from(tabla).delete().eq("id", item.id);
    if (error) { toast.error("No se pudo eliminar", { description: error.message }); return; }
    toast.success("Eliminado definitivamente");
    cargar();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto p-5 space-y-4">
        <PageHeader
          titulo="Papelera"
          desc="Clientes y bultos eliminados. Se pueden restaurar o borrar para siempre."
          meta={items.length > 0 ? `${items.length} elemento${items.length > 1 ? "s" : ""}` : undefined}
        />

        <div className="flex items-center gap-2">
          <button onClick={cargar} disabled={cargando}
            className="p-2 rounded-lg border hover:bg-muted/40 transition-colors" title="Actualizar">
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", cargando && "animate-spin")} />
          </button>
          <span className="text-xs text-muted-foreground">
            Se guardan los últimos {DIAS_PAPELERA} días.
          </span>
          {puedeEditar && (
            <button onClick={vaciarViejo}
              className="text-xs px-2.5 py-1.5 rounded-lg border hover:bg-muted transition-colors ml-auto">
              Vaciar lo anterior a {DIAS_PAPELERA} días
            </button>
          )}
          {!puedeEditar && (
            <span className="text-xs text-muted-foreground">Solo lectura: no podés restaurar ni eliminar.</span>
          )}
        </div>

        {items.length === 0 && !cargando ? (
          <EmptyState icon={Trash2} title="La papelera está vacía"
            description={`Lo que elimines va a aparecer acá y se puede restaurar durante ${DIAS_PAPELERA} días.`} />
        ) : (
          <div className="border rounded-lg bg-card divide-y">
            {items.map(item => (
              <div key={`${item.tipo}-${item.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded shrink-0",
                  item.tipo === "cliente"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                    : "bg-muted text-muted-foreground")}>
                  {item.tipo === "cliente" ? "Cliente" : "Bulto"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    Eliminado el {new Date(item.deleted_at).toLocaleDateString("es-AR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                    })}
                  </p>
                </div>
                {puedeEditar && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => restaurar(item)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border hover:bg-muted transition-colors">
                      <RotateCcw className="h-3 w-3" /> Restaurar
                    </button>
                    <button onClick={() => borrarDefinitivo(item)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">
                      <AlertTriangle className="h-3 w-3" /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
