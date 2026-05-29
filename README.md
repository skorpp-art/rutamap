# RutaMap

Aplicación web para gestión visual de recorridos de reparto de **Logística Hogareño** (Mercado Envíos Flex — Morón, GBA Oeste).

## Objetivo

Visualizar, dibujar, editar y exportar ~70 zonas de reparto (CABA y GBA Norte/Sur/Oeste) sobre un mapa real, con soporte para operaciones geométricas (corte, unión, diferencia) y exportación en PDF/JPG para el equipo de coordinación.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Hosting | Vercel |
| Base de datos + Auth | Supabase (Postgres + PostGIS) |
| Mapa base | Leaflet + react-leaflet (OpenStreetMap) |
| Edición geométrica | @geoman-io/leaflet-geoman-free |
| Operaciones geo | @turf/turf |
| Exportación | html-to-image + jspdf |
| Estilos | Tailwind CSS + shadcn/ui |
| Estado global | Zustand |

---

## Arquitectura

```
src/
├── app/
│   ├── (mapa)/               # Rutas protegidas (requieren auth)
│   │   ├── layout.tsx        # Layout con Header
│   │   └── page.tsx          # Mapa principal
│   ├── login/page.tsx        # Login público
│   ├── registro/page.tsx     # Registro público
│   ├── layout.tsx            # Root layout (Toaster, providers)
│   └── globals.css
├── components/
│   ├── ui/                   # Componentes shadcn/ui
│   ├── layout/               # Header, ZoneSelector
│   ├── auth/                 # LoginForm, RegisterForm
│   └── mapa/                 # MapaLeaflet, PanelLateral, etc. (Etapa 2+)
├── lib/
│   └── supabase/
│       ├── client.ts         # Browser client
│       └── server.ts         # Server client (RSC / Server Actions)
├── stores/
│   └── mapStore.ts           # Estado global Zustand
├── middleware.ts              # Protección de rutas + refresco de sesión
└── types/
    └── database.types.ts     # Tipos generados de Supabase
```

### Flujo de autenticación

```
Request → middleware.ts → ¿sesión válida?
  ├─ SÍ + ruta pública (/login, /registro) → redirect /
  ├─ NO + ruta protegida                   → redirect /login
  └─ OK                                    → continúa normalmente
```

### Modelo de datos

- **perfiles**: extiende `auth.users` con nombre y rol (supervisor / coordinador / lector)
- **recorridos**: zona geográfica como `MultiPolygon` PostGIS + traza opcional `LineString`
- **recorridos_historial**: snapshots previos para deshacer operaciones destructivas

---

## Plan de etapas

### ✅ Etapa 1 — Base del proyecto
- Scaffold Next.js + Tailwind + Supabase
- Autenticación email/password
- Layout base: Header con logo, selector de zona, menú de usuario
- Páginas `/login` y `/registro`

### Etapa 2 — Mapa y visualización
- Mapa Leaflet centrado en Morón (lat -34.65, lng -58.62, zoom 11)
- Carga y render de polígonos desde Supabase
- Panel lateral izquierdo: lista filtrable de recorridos
- Panel lateral derecho: detalle del recorrido seleccionado

### Etapa 3 — Dibujo y edición de polígonos
- Nuevo recorrido con modal + modo dibujo Geoman
- Edición de vértices, selector de color, validación de código único

### Etapa 4 — Trazas internas opcionales
- Dibujo de `LineString` sobre un recorrido seleccionado
- Renderizado independiente del polígono

### Etapa 5 — Operaciones de corte y unión
- Corte tipo cuchillo (split con línea + `turf.lineSplit`)
- Mover sub-área entre recorridos (`turf.difference` + `turf.union`)
- Unir / restar entre recorridos (`turf.union` / `turf.difference`)
- Historial para deshacer

### Etapa 6 — Exportación
- JPG del mapa encuadrado con leyenda
- PDF A4 horizontal por recorrido o varios en un solo PDF

### Etapa 7 — Calidad de vida
- Atajos de teclado (N, E, Esc, Ctrl+Z)
- Indicador de cambios sin guardar
- Vista de solapamientos entre polígonos
- Cálculo automático de superficie en km²

---

## Setup inicial

### 1. Prerequisitos
- Node.js 20+ y npm
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com)

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.local.example .env.local
# Completar con los valores de tu proyecto Supabase
```

### 4. Ejecutar el esquema de base de datos
En el SQL Editor de Supabase, ejecutar el contenido de `schema.sql`.

### 5. (Opcional) Regenerar tipos TypeScript
```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/database.types.ts
```

### 6. Desarrollo local
```bash
npm run dev
# Abre http://localhost:3000
```

### 7. Deploy a Vercel
```bash
vercel --prod
# Configurar las env vars en el dashboard de Vercel
```

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública de Supabase |

---

## Paleta de colores de recorridos

| Nombre | Hex |
|--------|-----|
| Celeste | `#7dd3fc` |
| Azul | `#2563eb` |
| Verde | `#16a34a` |
| Naranja | `#ea580c` |
| Rojo | `#dc2626` |
| Violeta | `#9333ea` |
| Amarillo | `#eab308` |
| Rosa | `#ec4899` |

Los colores corporativos **azul `#2563eb`, negro `#0f172a` y celeste `#7dd3fc`** se usan en el chrome de la app (header, botones primarios).
