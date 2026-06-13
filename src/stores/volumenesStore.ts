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

interface VolumenesStore {
  kpis: VolumenesKpis | null;
  setKpis: (kpis: VolumenesKpis | null) => void;
  onRefrescar: (() => void) | null;
  setOnRefrescar: (fn: (() => void) | null) => void;
}

export const useVolumenesStore = create<VolumenesStore>((set) => ({
  kpis: null,
  setKpis: (kpis) => set({ kpis }),
  onRefrescar: null,
  setOnRefrescar: (onRefrescar) => set({ onRefrescar }),
}));
