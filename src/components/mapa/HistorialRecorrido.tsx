"use client";

import { useEffect, useState } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface EntradaHistorial {
  accion: string;
  realizado_en: string;
  nombre_usuario: string;
}

const ACCION_LABELS: Record<string, string> = {
  creacion: "Recorrido creado",
  edicion: "Geometría editada",
  archivo: "Estado cambiado",
  corte: "Área cortada",
  union: "Áreas fusionadas",
  diferencia: "Área recortada",
};

const ACCION_COLOR: Record<string, string> = {
  creacion: "bg-green-500",
  edicion: "bg-blue-500",
  archivo: "bg-slate-400",
  corte: "bg-orange-500",
  union: "bg-purple-500",
  diferencia: "bg-red-400",
};

interface HistorialRecorridoProps {
  recorridoId: string;
}

export function HistorialRecorrido({ recorridoId }: HistorialRecorridoProps) {
  const [abierto, setAbierto] = useState(false);
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    async function cargar() {
      setCargando(true);
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("get_historial_recorrido", {
          p_id: recorridoId,
          p_limite: 8,
        });
        setHistorial((data as EntradaHistorial[]) ?? []);
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, [abierto, recorridoId]);

  return (
    <div className="space-y-1">
      {/* Toggle */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left group"
      >
        <History className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium group-hover:text-foreground transition-colors">
          Historial
        </span>
        {abierto ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
        )}
      </button>

      {/* Contenido */}
      {abierto && (
        <div className="pl-1 space-y-0.5">
          {cargando ? (
            <p className="text-[10px] text-muted-foreground py-1">Cargando…</p>
          ) : historial.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-1">Sin registros</p>
          ) : (
            historial.map((h, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                {/* Dot */}
                <div
                  className={cn(
                    "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                    ACCION_COLOR[h.accion] ?? "bg-slate-400"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-foreground leading-tight">
                    {ACCION_LABELS[h.accion] ?? h.accion}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {new Date(h.realizado_en).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {h.nombre_usuario}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
