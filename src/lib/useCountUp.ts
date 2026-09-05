"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima un número desde su valor anterior hasta el actual.
 * Devuelve el valor intermedio para renderizar (cuenta hacia arriba/abajo).
 */
export function useCountUp(value: number, duration = 600): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Respetar reduce-motion
    const reduce = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) { setDisplay(to); fromRef.current = to; return; }

    const inicio = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - inicio) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return display;
}
