// ─── Sistema de diseño: estados operativos ─────────────────────────────────────
// Única fuente de verdad para los colores verde/ámbar/rojo que antes estaban
// repetidos como hex sueltos en VolumenesPanel, KpisMonitoreo y VistaMapaClient.

/** Paleta cruda — usá estos hex en gráficos, mapas y cualquier estilo inline. */
export const PALETA = {
  verde: "#16a34a",
  ambar: "#f59e0b",
  rojo: "#ef4444",
  azul: "#2563eb",
  gris: "#94a3b8",
} as const;

/** Color identitario de cada zona operativa (mismo en mapa, tablas y PDF). */
export const ZONA_COLOR: Record<string, string> = {
  Oeste: "#2563eb", // azul
  Norte: "#f59e0b", // ámbar
  Sur: "#16a34a",   // verde
  CABA: "#dc2626",  // rojo
};

/** Estados de riesgo operativo (coinciden con `zona_riesgo` que devuelve la DB). */
export type EstadoRiesgo =
  | "ok"
  | "alto"
  | "bajo"
  | "peligroso_alto"
  | "peligroso_bajo"
  | "sin";

interface EstadoStyle {
  hex: string;
  label: string;
  /** Clases Tailwind listas para chips/badges. */
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const ESTADO: Record<EstadoRiesgo, EstadoStyle> = {
  ok: {
    hex: PALETA.verde, label: "En rango",
    bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", dot: "bg-emerald-500",
  },
  alto: {
    hex: PALETA.ambar, label: "Sobre objetivo",
    bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", dot: "bg-amber-500",
  },
  bajo: {
    hex: PALETA.ambar, label: "Bajo objetivo",
    bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", dot: "bg-amber-500",
  },
  peligroso_alto: {
    hex: PALETA.rojo, label: "⚠ Sobrecarga",
    bg: "bg-red-50", text: "text-red-700", border: "border-red-300", dot: "bg-red-500",
  },
  peligroso_bajo: {
    hex: PALETA.rojo, label: "⚠ Subutilizado",
    bg: "bg-red-50", text: "text-red-700", border: "border-red-300", dot: "bg-red-500",
  },
  sin: {
    hex: PALETA.gris, label: "Sin datos",
    bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-300",
  },
};

/**
 * Clasifica un promedio de paquetes/ruta respecto del objetivo.
 * Bandas: ±5 = aviso, ±10 = peligroso. Misma lógica que usa la DB.
 */
export function clasificarRiesgo(promPorRuta: number, target: number): EstadoRiesgo {
  if (!promPorRuta || promPorRuta <= 0) return "sin";
  if (promPorRuta >= target + 10) return "peligroso_alto";
  if (promPorRuta >= target + 5) return "alto";
  if (promPorRuta <= target - 10) return "peligroso_bajo";
  if (promPorRuta <= target - 5) return "bajo";
  return "ok";
}
