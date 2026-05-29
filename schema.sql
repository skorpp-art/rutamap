-- ============================================================
-- RutaMap — Esquema de base de datos Supabase
-- Ejecutar en el SQL Editor de Supabase (en orden)
-- ============================================================

-- 1. Habilitar PostGIS
create extension if not exists postgis;

-- ============================================================
-- 2. Tabla de perfiles (extiende auth.users)
-- ============================================================
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('supervisor', 'coordinador', 'lector')),
  creado_en timestamptz default now()
);

-- ============================================================
-- 3. Tabla de recorridos
-- ============================================================
create table if not exists recorridos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  zona text not null check (zona in ('CABA', 'Norte', 'Sur', 'Oeste')),
  tipo text not null check (tipo in ('fijo', 'suplencia')),
  color text not null default '#3b82f6',
  area geometry(MultiPolygon, 4326),
  traza geometry(LineString, 4326),
  activo boolean default true,
  creado_por uuid references perfiles(id),
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists recorridos_area_gix on recorridos using gist (area);
create index if not exists recorridos_traza_gix on recorridos using gist (traza);

-- ============================================================
-- 4. Historial de cambios (para deshacer operaciones)
-- ============================================================
create table if not exists recorridos_historial (
  id uuid primary key default gen_random_uuid(),
  recorrido_id uuid references recorridos(id) on delete cascade,
  area_anterior geometry(MultiPolygon, 4326),
  traza_anterior geometry(LineString, 4326),
  accion text not null check (accion in ('edicion', 'corte', 'union', 'diferencia', 'creacion', 'archivo')),
  realizado_por uuid references perfiles(id),
  realizado_en timestamptz default now()
);

-- ============================================================
-- 5. Trigger: crear perfil automáticamente al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'coordinador')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 6. Trigger: actualizar `actualizado_en` en recorridos
-- ============================================================
create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists set_recorridos_actualizado_en on recorridos;
create trigger set_recorridos_actualizado_en
  before update on recorridos
  for each row execute procedure public.set_actualizado_en();

-- ============================================================
-- 7. Row Level Security (RLS)
-- ============================================================
alter table perfiles enable row level security;
alter table recorridos enable row level security;
alter table recorridos_historial enable row level security;

-- Perfiles: cada usuario ve/edita su propio perfil
-- Supervisores y coordinadores ven todos los perfiles
create policy "perfiles_select" on perfiles
  for select using (
    auth.uid() = id
    or exists (
      select 1 from perfiles p
      where p.id = auth.uid()
      and p.rol in ('supervisor', 'coordinador')
    )
  );

create policy "perfiles_update_own" on perfiles
  for update using (auth.uid() = id);

-- Recorridos: supervisores y coordinadores leen y escriben todo; lectores solo leen
create policy "recorridos_select" on recorridos
  for select using (
    exists (
      select 1 from perfiles
      where id = auth.uid()
      and rol in ('supervisor', 'coordinador', 'lector')
    )
  );

create policy "recorridos_insert" on recorridos
  for insert with check (
    exists (
      select 1 from perfiles
      where id = auth.uid()
      and rol in ('supervisor', 'coordinador')
    )
  );

create policy "recorridos_update" on recorridos
  for update using (
    exists (
      select 1 from perfiles
      where id = auth.uid()
      and rol in ('supervisor', 'coordinador')
    )
  );

create policy "recorridos_delete" on recorridos
  for delete using (
    exists (
      select 1 from perfiles
      where id = auth.uid()
      and rol = 'supervisor'
    )
  );

-- Historial: mismas reglas que recorridos
create policy "historial_select" on recorridos_historial
  for select using (
    exists (
      select 1 from perfiles
      where id = auth.uid()
      and rol in ('supervisor', 'coordinador', 'lector')
    )
  );

create policy "historial_insert" on recorridos_historial
  for insert with check (
    exists (
      select 1 from perfiles
      where id = auth.uid()
      and rol in ('supervisor', 'coordinador')
    )
  );

-- ============================================================
-- 8. Función auxiliar: obtener recorridos como GeoJSON
--    (útil para exportar sin conversión en el cliente)
-- ============================================================
create or replace function public.recorridos_geojson(p_zona text default null, p_activo boolean default true)
returns json
language sql
security definer
as $$
  select json_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', r.id,
        'geometry', ST_AsGeoJSON(r.area)::json,
        'properties', json_build_object(
          'id', r.id,
          'codigo', r.codigo,
          'nombre', r.nombre,
          'descripcion', r.descripcion,
          'zona', r.zona,
          'tipo', r.tipo,
          'color', r.color,
          'activo', r.activo
        )
      )
    ), '[]'::json)
  )
  from recorridos r
  where (p_zona is null or r.zona = p_zona)
    and r.activo = p_activo
    and r.area is not null;
$$;

-- ============================================================
-- FIN DEL ESQUEMA
-- Próximos pasos:
--   1. Ejecutar este script en Supabase SQL Editor
--   2. Copiar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
--      desde Settings > API
--   3. Pegar en .env.local
-- ============================================================
