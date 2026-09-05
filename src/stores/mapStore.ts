"use client";

import { create } from "zustand";
import type { Zona, TipoRecorrido } from "@/types/database.types";

type ModoEdicion =
  | "ninguno"
  | "dibujo"
  | "edicion"
  | "corte"
  | "union"
  | "diferencia"
  | "traza";

interface FiltrosRecorridos {
  zona: Zona | null;
  tipo: TipoRecorrido | null;
  busqueda: string;
}

interface MapStore {
  // Filtros del panel lateral
  filtros: FiltrosRecorridos;
  setFiltroZona: (zona: Zona | null) => void;
  setFiltroTipo: (tipo: TipoRecorrido | null) => void;
  setFiltroBusqueda: (busqueda: string) => void;

  // Recorrido activo en el mapa
  recorridoActivoId: string | null;
  setRecorridoActivo: (id: string | null) => void;

  // Modo de edición geométrica (Etapa 3+)
  modoEdicion: ModoEdicion;
  setModoEdicion: (modo: ModoEdicion) => void;

  // Cambios pendientes de guardar
  tieneCambiosSinGuardar: boolean;
  setTieneCambiosSinGuardar: (valor: boolean) => void;

  // Panel lateral derecho visible
  panelDerechoAbierto: boolean;
  setPanelDerechoAbierto: (abierto: boolean) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  filtros: {
    zona: null,
    tipo: null,
    busqueda: "",
  },
  setFiltroZona: (zona) =>
    set((state) => ({ filtros: { ...state.filtros, zona } })),
  setFiltroTipo: (tipo) =>
    set((state) => ({ filtros: { ...state.filtros, tipo } })),
  setFiltroBusqueda: (busqueda) =>
    set((state) => ({ filtros: { ...state.filtros, busqueda } })),

  recorridoActivoId: null,
  setRecorridoActivo: (id) => set({ recorridoActivoId: id }),

  modoEdicion: "ninguno",
  setModoEdicion: (modo) => set({ modoEdicion: modo }),

  tieneCambiosSinGuardar: false,
  setTieneCambiosSinGuardar: (valor) =>
    set({ tieneCambiosSinGuardar: valor }),

  panelDerechoAbierto: false,
  setPanelDerechoAbierto: (abierto) => set({ panelDerechoAbierto: abierto }),
}));
