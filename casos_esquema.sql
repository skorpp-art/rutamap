-- ============================================================
-- Casos logisticos
-- ============================================================
-- Reemplaza el Excel que comparten Asesoria Comercial y Coordinacion.
-- Cada caso es un paquete con un problema; el estado dice de que lado
-- esta la pelota, y nada se sobreescribe: todo movimiento queda en la
-- linea de tiempo.
--
-- DECISIONES QUE VALE LA PENA CONOCER
--
-- 1. No se crearon roles nuevos. La app ya tenia 'asesor' y
--    'coordinador', que son exactamente las dos areas, con 13 personas
--    cargadas. Los mandos (maestro, gerencia, supervisor) ven todo.
--
-- 2. La escritura NO usa es_editor(). Ese permiso deja afuera a los
--    asesores, que son quienes abren la mayoria de los casos: habria
--    hecho falta activarles el flag uno por uno. Se usa
--    puede_gestionar_casos(), que habilita a asesor, coordinador,
--    supervisor y maestro. Gerencia queda como lectura.
--
-- 3. area_responsable es una columna calculada, no un campo que la app
--    escribe: asi el filtro "en mi cancha" no depende de que el codigo
--    interprete los estados igual que la base. Un caso 'abierto' por
--    Coordinacion espera a Asesoria y al reves.
--
-- 4. El tracking es unico solo entre casos vivos. El mismo paquete
--    puede volver a fallar meses despues y ese es un caso nuevo.
--
-- 5. Las notificaciones van al rol del area que tiene que actuar, no a
--    los mandos. Con fanout a supervisores y maestros un solo caso
--    generaba 27 avisos y la bandeja dejaba de servir.
--
-- Idempotente.
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

create or replace function public.area_usuario(uid uuid default auth.uid())
returns text language sql stable security definer set search_path to public as $fn$
  select case p.rol
    when 'asesor' then 'asesoria'
    when 'coordinador' then 'coordinacion'
    else 'ambas'
  end
  from perfiles p where p.id = uid;
$fn$;

create or replace function public.puede_gestionar_casos(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path to public as $fn$
  select exists (
    select 1 from perfiles p
    where p.id = uid and p.rol in ('asesor','coordinador','supervisor','maestro')
  );
$fn$;

create table if not exists public.casos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  tracking text,
  cliente text not null,
  direccion text,
  tipo_incidencia text not null,
  observaciones text,
  ejecutivo text,
  area_origen text not null check (area_origen in ('asesoria','coordinacion')),
  estado text not null default 'abierto'
    check (estado in ('abierto','en_gestion','reintento','entrega_imposible','pendiente_cliente','entregado','cancelado')),
  area_responsable text generated always as (
    case estado
      when 'abierto' then case when area_origen = 'asesoria' then 'coordinacion' else 'asesoria' end
      when 'en_gestion' then 'coordinacion'
      when 'reintento' then 'coordinacion'
      when 'entrega_imposible' then 'asesoria'
      when 'pendiente_cliente' then 'asesoria'
      else 'cerrado'
    end
  ) stored,
  created_by uuid,
  created_at timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cerrado_en timestamptz
);

create unique index if not exists casos_tracking_vivo_idx on public.casos (tracking)
  where tracking is not null and estado not in ('entregado','cancelado');
create index if not exists casos_estado_idx on public.casos(estado);
create index if not exists casos_responsable_idx on public.casos(area_responsable);
create index if not exists casos_created_idx on public.casos(created_at desc);
create index if not exists casos_cliente_idx on public.casos(lower(cliente));

create table if not exists public.eventos_caso (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos(id) on delete cascade,
  tipo_evento text not null
    check (tipo_evento in ('apertura','plan_accion','cambio_estado','observacion','reintento')),
  contenido jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists eventos_caso_idx on public.eventos_caso(caso_id, created_at);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos(id) on delete cascade,
  destino_id uuid not null,
  tipo text not null,
  titulo text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notificaciones_pendientes_idx
  on public.notificaciones(destino_id, created_at desc) where not leida;

alter table public.casos enable row level security;
alter table public.eventos_caso enable row level security;
alter table public.notificaciones enable row level security;

-- Las dos areas ven todos los casos: el sentido del modulo es que dejen
-- de tener planillas separadas. La escritura va por funciones.
drop policy if exists casos_select on public.casos;
create policy casos_select on public.casos for select to authenticated using (true);
drop policy if exists eventos_select on public.eventos_caso;
create policy eventos_select on public.eventos_caso for select to authenticated using (true);
drop policy if exists notif_propias on public.notificaciones;
create policy notif_propias on public.notificaciones for select to authenticated
  using (destino_id = auth.uid());
drop policy if exists notif_marcar on public.notificaciones;
create policy notif_marcar on public.notificaciones for update to authenticated
  using (destino_id = auth.uid()) with check (destino_id = auth.uid());

revoke all on public.casos, public.eventos_caso, public.notificaciones from anon;
grant select on public.casos, public.eventos_caso, public.notificaciones to authenticated;
grant update on public.notificaciones to authenticated;

-- El resto de las funciones (siguiente_numero_caso, notificar_caso,
-- casos_similares, crear_caso, cambiar_estado_caso, agregar_evento_caso)
-- estan aplicadas en la base. notificar_caso y siguiente_numero_caso son
-- auxiliares: no se exponen a authenticated para que nadie pueda generar
-- notificaciones falsas desde el cliente.
