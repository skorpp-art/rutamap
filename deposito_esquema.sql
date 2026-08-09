-- ============================================================
-- Deposito: guarda de bultos
-- ============================================================
-- Viene de la app "logistica-hogareno", que se integra a RutaMap para
-- dejar de mantener dos apps, dos bases y dos logins.
--
-- Se traen solo las tablas con uso real: clients, bultos y doc_counter
-- (numerador de remitos). Quedan afuera, por no tener ninguna fila en
-- un ano de operacion: agenda_events, weekly_schedules,
-- damaged_packages y stock_alerts. Tambien queda afuera el modulo de
-- planificacion de esa app (registros_diarios, desglose_*, horneado_*,
-- recorridos, zonas, operaciones_dia, cortes_emergencia), que RutaMap
-- ya reemplazo y no se usa desde mayo.
--
-- Se conservan los nombres originales de tablas y columnas, en ingles,
-- para que el port de las pantallas sea mecanico. No chocan con nada de
-- RutaMap.
--
-- Diferencia importante con el origen: alla las politicas daban acceso
-- total a anon, o sea que la clave publica del frontend alcanzaba para
-- leer y escribir clientes (telefonos, mails, direcciones) y bultos.
-- Aca se aplica el criterio del resto de RutaMap: lectura con sesion
-- iniciada, escritura solo para editores, anon sin ningun acceso.
--
-- Idempotente.
-- ============================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nombre_fantasia text,
  phone text,
  email text,
  address text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bultos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  description text,
  barcode text,
  tracking_id text,
  status text not null default 'stored'
    check (status in ('stored','scheduled_return','returned','deleted','cancelled','duplicate','cambio','devolucion','rechazado','ficha')),
  entry_date date not null default current_date,
  scheduled_return_date date,
  actual_return_date date,
  destination_address text,
  destination_locality text,
  remito_number integer,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.doc_counter (
  id integer primary key default 1,
  last_number integer not null default 0
);
insert into public.doc_counter (id, last_number) values (1, 0) on conflict (id) do nothing;

create index if not exists bultos_client_idx on public.bultos(client_id);
create index if not exists bultos_status_idx on public.bultos(status) where deleted_at is null;
create index if not exists bultos_entry_idx on public.bultos(entry_date desc);
create index if not exists bultos_tracking_idx on public.bultos(tracking_id);
create index if not exists clients_name_idx on public.clients(name);

alter table public.clients enable row level security;
alter table public.bultos enable row level security;
alter table public.doc_counter enable row level security;

drop policy if exists clients_select on public.clients;
drop policy if exists clients_write on public.clients;
create policy clients_select on public.clients for select to authenticated using (true);
create policy clients_write  on public.clients for all    to authenticated using (es_editor()) with check (es_editor());

drop policy if exists bultos_select on public.bultos;
drop policy if exists bultos_write on public.bultos;
create policy bultos_select on public.bultos for select to authenticated using (true);
create policy bultos_write  on public.bultos for all    to authenticated using (es_editor()) with check (es_editor());

drop policy if exists doc_counter_select on public.doc_counter;
drop policy if exists doc_counter_update on public.doc_counter;
create policy doc_counter_select on public.doc_counter for select to authenticated using (true);
create policy doc_counter_update on public.doc_counter for update to authenticated using (es_editor()) with check (es_editor());

revoke all on public.clients, public.bultos, public.doc_counter from anon;
grant select on public.clients, public.bultos, public.doc_counter to authenticated;
grant insert, update, delete on public.clients, public.bultos to authenticated;
grant update on public.doc_counter to authenticated;

-- ── Funciones del panel ─────────────────────────────────────
-- Stock mas antiguo. Correccion respecto del origen: alla la consulta
-- miraba todos los bultos, incluidos los ya retirados, asi que el "mas
-- antiguo en stock" no era stock. Ademas se descartan las fechas
-- imposibles cargadas por error (0001-01-01, 0026-05-05, 22026-04-17).
create or replace function public.get_oldest_stock(limit_count integer default 5)
returns table(id uuid, client_name text, entry_date date)
language sql stable security definer set search_path to 'public' as $function$
  select b.id, c.name, b.entry_date
  from bultos b join clients c on c.id = b.client_id
  where b.deleted_at is null
    and b.status in ('stored','scheduled_return')
    and b.entry_date between '2020-01-01' and current_date
  order by b.entry_date asc
  limit limit_count;
$function$;

create or replace function public.get_top_clients(limit_count integer default 5)
returns table(id uuid, name text, notes text, bultos_count bigint)
language sql stable security definer set search_path to 'public' as $function$
  select c.id, c.name, c.notes, count(b.id)
  from clients c
  left join bultos b on b.client_id = c.id and b.deleted_at is null
  where c.deleted_at is null
  group by c.id, c.name, c.notes
  having count(b.id) > 0
  order by count(b.id) desc
  limit limit_count;
$function$;

revoke execute on function public.get_oldest_stock(integer), public.get_top_clients(integer) from anon, public;
grant execute on function public.get_oldest_stock(integer), public.get_top_clients(integer) to authenticated;

-- ============================================================
-- Remitos: se guarda el documento, no los paquetes
-- ============================================================
-- Al retirar bultos del deposito se emite un remito y los bultos salen de
-- la tabla: lo que queda registrado es el documento, con sus lineas
-- congeladas adentro. Asi "bultos" representa solo lo que hay
-- fisicamente en el galpon.
--
-- El nombre del cliente se guarda copiado dentro del remito porque el
-- documento tiene que poder reimprimirse igual aunque despues se
-- renombre o se elimine el cliente.
create table if not exists public.remitos (
  id uuid primary key default gen_random_uuid(),
  numero integer,
  client_id uuid references public.clients(id) on delete set null,
  cliente_nombre text not null,
  fecha date not null,
  cantidad integer not null default 0,
  -- [{tracking, descripcion, ingreso, destino, localidad, estado}]
  lineas jsonb not null default '[]'::jsonb,
  creado_por uuid,
  creado_en timestamptz default now()
);

create index if not exists remitos_fecha_idx on public.remitos(fecha desc);
create index if not exists remitos_client_idx on public.remitos(client_id);
create unique index if not exists remitos_numero_idx on public.remitos(numero) where numero is not null;
create index if not exists remitos_lineas_idx on public.remitos using gin (lineas jsonb_path_ops);

alter table public.remitos enable row level security;

drop policy if exists remitos_select on public.remitos;
drop policy if exists remitos_write on public.remitos;
create policy remitos_select on public.remitos for select to authenticated using (true);
create policy remitos_write  on public.remitos for all    to authenticated using (es_editor()) with check (es_editor());

revoke all on public.remitos from anon;
grant select, insert, update, delete on public.remitos to authenticated;
