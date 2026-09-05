"use client";

import { useCountUp } from "@/lib/useCountUp";

/** Número que cuenta suavemente hasta su valor (para métricas grandes). */
export function NumeroAnimado({
  value,
  className,
  format,
  duration,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
  duration?: number;
}) {
  const v = useCountUp(value, duration);
  return <span className={className}>{format ? format(v) : v.toLocaleString("es-AR")}</span>;
}
