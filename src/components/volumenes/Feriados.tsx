"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { getFeriados, marcarFeriado, eliminarFeriado } from "@/app/actions/volumenes";
import type { Feriado } from "@/app/actions/volumenes";
import { hoyAR } from "@/lib/fechas";

const hoy = hoyAR;

export function Feriados() {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fecha, setFecha] = useState(hoy());
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await getFeriados();
      if (res.ok && res.data) setFeriados(res.data);
    } finally { setCargando(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function agregar() {
    if (!fecha) return;
    setGuardando(true);
    try {
      const res = await marcarFeriado(fecha, descripcion.trim() || undefined);
      if (!res.ok) { toast.error("Error al marcar feriado", { description: res.error }); return; }
      toast.success("Feriado marcado — la proyección del día siguiente se ajustará automáticamente");
      setDescripcion("");
      await cargar();
    } finally { setGuardando(false); }
  }

  async function quitar(f: string) {
    const res = await eliminarFeriado(f);
    if (!res.ok) { toast.error("Error al quitar feriado", { description: res.error }); return; }
    setFeriados(prev => prev.filter(x => x.fecha !== f));
  }

  const proximos = feriados.filter(f => f.fecha >= hoy());
  const pasados = feriados.filter(f => f.fecha < hoy());

  return (
    <div className="p-5 space-y-4 max-w-xl">
      <div className="flex items-start gap-2">
        <CalendarOff className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Marcá los días que la logística está cerrada (feriados). Esos días la proyección queda en 0,
          y el día siguiente se ajusta automáticamente (+25%) para reflejar el acumulado de paquetes.
        </p>
      </div>

      <div className="border rounded-xl p-4 bg-background flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm h-9 bg-background block mt-1" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Motivo (opcional)</label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="ej: Feriado nacional" maxLength={60}
            className="w-full border rounded-lg px-3 py-1.5 text-sm h-9 bg-background block mt-1" />
        </div>
        <Button onClick={agregar} disabled={guardando || !fecha} className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Marcar feriado
        </Button>
      </div>

      {cargando ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : feriados.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay feriados marcados.</p>
      ) : (
        <div className="space-y-3">
          {proximos.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximos</p>
              {proximos.map(f => <FilaFeriado key={f.fecha} f={f} onQuitar={quitar} />)}
            </div>
          )}
          {pasados.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pasados</p>
              {pasados.map(f => <FilaFeriado key={f.fecha} f={f} onQuitar={quitar} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilaFeriado({ f, onQuitar }: { f: Feriado; onQuitar: (fecha: string) => void }) {
  return (
    <div className={cn("flex items-center gap-3 border rounded-lg px-3 py-2 text-xs",
      f.fecha < hoy() && "opacity-60")}>
      <span className="font-semibold tabular-nums w-24">
        {new Date(f.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
      </span>
      <span className="flex-1 text-muted-foreground truncate">{f.descripcion || "—"}</span>
      <button onClick={() => onQuitar(f.fecha)} className="text-muted-foreground/50 hover:text-red-600 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
