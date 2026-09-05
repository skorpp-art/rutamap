"use client";

import { create } from "zustand";

export interface VolumenesKpis {
  hoyTotal: number | null;
  choferesHoy: number;
  semanaTotal: number | null;
  semanaDias: number;
  vsAnteriorPct: number;
  anteriorTotal: number | null;
  proyectadoTotal: number | null;
  confianza: string | null;
  precisionPct: number | null;
  precisionN: number | null;
  rutasFijas: number;
  targetPkg: number;
  cargando: boolean;
}

export type VolumenesTab = "proyeccion" | "operacion" | "analisis" | "herramientas";

interface VolumenesStore {
  kpis: VolumenesKpis | null;
  setKpis: (kpis: VolumenesKpis | null) => void;
  onRefrescar: (() => void) | null;
  setOnRefrescar: (fn: (() => void) | null) => void;
  /** Solapa activa de Planificación — se muestra en la barra superior. */
  tab: VolumenesTab;
  setTab: (tab: VolumenesTab) => void;
}

export const useVolumenesStore = create<VolumenesStore>((set) => ({
  kpis: null,
  setKpis: (kpis) => set({ kpis }),
  onRefrescar: null,
  setOnRefrescar: (onRefrescar) => set({ onRefrescar }),
  tab: "proyeccion",
  setTab: (tab) => set({ tab }),
}));
