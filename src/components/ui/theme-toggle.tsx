"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Botón compacto para alternar claro/oscuro. Pensado para el header oscuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const esOscuro = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(esOscuro ? "light" : "dark")}
      title={esOscuro ? "Modo claro" : "Modo oscuro"}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-md bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors",
        className
      )}
    >
      {/* Hasta montar, renderizamos un placeholder neutro para evitar mismatch */}
      {montado ? (
        esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4 opacity-0" />
      )}
    </button>
  );
}
