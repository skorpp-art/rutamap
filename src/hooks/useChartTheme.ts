"use client";

import { useTheme } from "next-themes";

/**
 * Colores de grilla y ejes para recharts, adaptados al tema activo.
 * Evita los grises fijos que quedan con bajo contraste en modo oscuro.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    dark,
    grid: dark ? "#1e293b" : "#f0f0f0",          // slate-800 / gris claro
    axis: dark ? "#94a3b8" : "#64748b",          // slate-400 / slate-500 (texto ejes)
    axisLine: dark ? "#334155" : "#e2e8f0",      // slate-700 / slate-200
    // Estilos para el <Tooltip> por defecto de recharts (sin content custom)
    tooltip: {
      contentStyle: {
        background: dark ? "#0f172a" : "#ffffff",
        border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
        borderRadius: 10,
        fontSize: 12,
        boxShadow: dark
          ? "0 8px 24px -8px rgb(0 0 0 / 0.5)"
          : "0 8px 24px -8px rgb(16 24 40 / 0.15)",
      },
      labelStyle: { color: dark ? "#e2e8f0" : "#0f172a", fontWeight: 600 },
      itemStyle: { color: dark ? "#cbd5e1" : "#334155" },
    },
  };
}
