// Generado manualmente basado en schema.sql
// Para regenerar automáticamente:
//   npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/database.types.ts

export type Zona = "CABA" | "Norte" | "Sur" | "Oeste";
export type TipoRecorrido = "fijo" | "suplencia" | "corte" | "pre_turno" | "unificado";
export type Rol = "maestro" | "gerencia" | "supervisor" | "coordinador" | "asesor";
export type AccionHistorial =
  | "edicion"
  | "corte"
  | "union"
  | "diferencia"
  | "creacion"
  | "archivo";

export type Database = {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          nombre: string;
          rol: Rol;
          creado_en: string;
          solapas: string[] | null;
          puede_editar: boolean | null;
        };
        Insert: {
          id: string;
          nombre: string;
          rol: Rol;
          creado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          rol?: Rol;
          creado_en?: string;
        };
      };
      recorridos: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          zona: Zona;
          tipo: TipoRecorrido;
          color: string;
          // PostGIS geometries — se manejan como GeoJSON en el cliente
          area: unknown | null;
          traza: unknown | null;
          activo: boolean;
          creado_por: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          descripcion?: string | null;
          zona: Zona;
          tipo: TipoRecorrido;
          color?: string;
          area?: unknown | null;
          traza?: unknown | null;
          activo?: boolean;
          creado_por?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          nombre?: string;
          descripcion?: string | null;
          zona?: Zona;
          tipo?: TipoRecorrido;
          color?: string;
          area?: unknown | null;
          traza?: unknown | null;
          activo?: boolean;
          creado_por?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
      };
      recorridos_historial: {
        Row: {
          id: string;
          recorrido_id: string | null;
          area_anterior: unknown | null;
          traza_anterior: unknown | null;
          accion: AccionHistorial;
          realizado_por: string | null;
          realizado_en: string;
        };
        Insert: {
          id?: string;
          recorrido_id?: string | null;
          area_anterior?: unknown | null;
          traza_anterior?: unknown | null;
          accion: AccionHistorial;
          realizado_por?: string | null;
          realizado_en?: string;
        };
        Update: {
          id?: string;
          recorrido_id?: string | null;
          area_anterior?: unknown | null;
          traza_anterior?: unknown | null;
          accion?: AccionHistorial;
          realizado_por?: string | null;
          realizado_en?: string;
        };
      };
      // ── Depósito (guarda de bultos) ──────────────────────────────────────
      // Nombres en inglés, como en la app de origen, para que el traspaso de
      // las pantallas sea mecánico.
      clients: {
        Row: {
          id: string;
          name: string;
          nombre_fantasia: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          nombre_fantasia?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          nombre_fantasia?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      bultos: {
        Row: {
          id: string;
          client_id: string;
          description: string | null;
          barcode: string | null;
          tracking_id: string | null;
          status: string;
          entry_date: string;
          scheduled_return_date: string | null;
          actual_return_date: string | null;
          destination_address: string | null;
          destination_locality: string | null;
          remito_number: number | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          description?: string | null;
          barcode?: string | null;
          tracking_id?: string | null;
          status?: string;
          entry_date?: string;
          scheduled_return_date?: string | null;
          actual_return_date?: string | null;
          destination_address?: string | null;
          destination_locality?: string | null;
          remito_number?: number | null;
          deleted_at?: string | null;
        };
        Update: {
          client_id?: string;
          description?: string | null;
          barcode?: string | null;
          tracking_id?: string | null;
          status?: string;
          entry_date?: string;
          scheduled_return_date?: string | null;
          actual_return_date?: string | null;
          destination_address?: string | null;
          destination_locality?: string | null;
          remito_number?: number | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      doc_counter: {
        Row: { id: number; last_number: number };
        Insert: { id?: number; last_number?: number };
        Update: { last_number?: number };
      };
    };
    Functions: {
      recorridos_geojson: {
        Args: { p_zona?: string; p_activo?: boolean };
        Returns: unknown;
      };
      get_recorridos_con_geojson: {
        Args: { p_zona?: string; p_activo?: boolean };
        Returns: unknown;
      };
      actualizar_area_recorrido: {
        Args: { p_id: string; p_area_geojson: string };
        Returns: undefined;
      };
      actualizar_traza_recorrido: {
        Args: { p_id: string; p_traza_geojson: string };
        Returns: undefined;
      };
      crear_recorrido: {
        Args: {
          p_codigo: string;
          p_nombre: string;
          p_zona: string;
          p_tipo: string;
          p_color: string;
          p_descripcion?: string | null;
        };
        Returns: string;
      };
      actualizar_campos_recorrido: {
        Args: {
          p_id: string;
          p_codigo: string;
          p_nombre: string;
          p_zona: string;
          p_tipo: string;
          p_color: string;
          p_descripcion?: string | null;
        };
        Returns: undefined;
      };
      toggle_activo_recorrido: {
        Args: { p_id: string; p_activo: boolean };
        Returns: undefined;
      };
    };
  };
};

// Tipos de fila convenientes
export type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
export type Recorrido = Database["public"]["Tables"]["recorridos"]["Row"];
export type RecorridoHistorial =
  Database["public"]["Tables"]["recorridos_historial"]["Row"];

// Tipo de inserción sin campos auto-generados
export type NuevoRecorrido = Omit<
  Database["public"]["Tables"]["recorridos"]["Insert"],
  "id" | "creado_en" | "actualizado_en"
>;

// Paleta de colores inicial de recorridos
export const COLORES_RECORRIDO = [
  { nombre: "Celeste", valor: "#7dd3fc" },
  { nombre: "Azul", valor: "#2563eb" },
  { nombre: "Verde", valor: "#16a34a" },
  { nombre: "Naranja", valor: "#ea580c" },
  { nombre: "Rojo", valor: "#dc2626" },
  { nombre: "Violeta", valor: "#9333ea" },
  { nombre: "Amarillo", valor: "#eab308" },
  { nombre: "Rosa", valor: "#ec4899" },
] as const;

export const ZONAS: Zona[] = ["CABA", "Norte", "Sur", "Oeste"];

// Tipo de recorrido con geometría convertida a GeoJSON string (via get_recorridos_con_geojson RPC)
export type RecorridoGeo = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  zona: Zona;
  tipo: TipoRecorrido;
  color: string;
  activo: boolean;
  area_geojson: string | null;   // JSON string — MultiPolygon GeoJSON geometry
  traza_geojson: string | null;  // JSON string — LineString GeoJSON geometry
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
};
