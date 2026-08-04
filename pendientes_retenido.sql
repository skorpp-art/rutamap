-- ============================================================
-- Pendientes — estado "retenido"
-- ============================================================
-- Control y Gestion retiene paquetes para que no salgan a la calle.
-- Un paquete retenido sigue en el deposito, asi que NO cuenta como
-- pendiente: al dia siguiente el Excel lo vuelve a traer, pero la
-- importacion conserva la marca en vez de resetearla a "pendiente".
--
-- Cambios: check del estado, marcar_pendiente / _lote / _cadete,
-- importar_pendientes (conserva la retencion en los reingresos) y los
-- resumenes por fecha/mes (nueva columna retenidos).
-- Idempotente.
-- ============================================================

begin;

alter table pendientes drop constraint if exists pendientes_estado_recepcion_check;
alter table pendientes add constraint pendientes_estado_recepcion_check
  check (estado_recepcion in ('pendiente','recibido','entregado','no_recibido','retenido'));

-- ── Marcado individual ──────────────────────────────────────
create or replace function public.marcar_pendiente(
  p_id uuid, p_estado text, p_motivo text default null, p_observacion text default null
) returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not es_editor() then raise exception 'No autorizado: se requiere rol editor'; end if;
  if p_estado not in ('pendiente','recibido','entregado','no_recibido','retenido') then
    raise exception 'Estado inválido: %', p_estado;
  end if;
  update pendientes set
    estado_recepcion = p_estado,
    motivo_no_recibido = case when p_estado = 'no_recibido' then p_motivo else null end,
    observacion = case when p_estado in ('no_recibido','retenido') then p_observacion else null end,
    recibido_en = case when p_estado <> 'pendiente' then now() else null end,
    recibido_por = case when p_estado <> 'pendiente' then auth.uid() else null end
  where id = p_id;
end; $function$;

-- ── Marcado por lote de ids ─────────────────────────────────
create or replace function public.marcar_pendientes_lote(
  p_ids uuid[], p_estado text, p_motivo text default null, p_observacion text default null
) returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int;
begin
  if not es_editor() then raise exception 'No autorizado: se requiere rol editor'; end if;
  if p_estado not in ('pendiente','recibido','entregado','no_recibido','retenido') then
    raise exception 'Estado inválido: %', p_estado;
  end if;
  update pendientes set
    estado_recepcion = p_estado,
    motivo_no_recibido = case when p_estado = 'no_recibido' then p_motivo else null end,
    observacion = case when p_estado in ('no_recibido','retenido') then p_observacion else null end,
    recibido_en = case when p_estado <> 'pendiente' then now() else null end,
    recibido_por = case when p_estado <> 'pendiente' then auth.uid() else null end
  where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end; $function$;

-- ── Marcado por conductor ───────────────────────────────────
create or replace function public.marcar_pendientes_cadete(
  p_fecha date, p_cadete text, p_estado text, p_motivo text default null, p_observacion text default null
) returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int;
begin
  if not es_editor() then raise exception 'No autorizado: se requiere rol editor'; end if;
  if p_estado not in ('pendiente','recibido','no_recibido','retenido') then
    raise exception 'Estado inválido: %', p_estado;
  end if;
  update pendientes set
    estado_recepcion = p_estado,
    motivo_no_recibido = case when p_estado = 'no_recibido' then p_motivo else null end,
    observacion = case when p_estado in ('no_recibido','retenido') then p_observacion else null end,
    recibido_en = case when p_estado <> 'pendiente' then now() else null end,
    recibido_por = case when p_estado <> 'pendiente' then auth.uid() else null end
  where fecha = p_fecha and cadete is not distinct from p_cadete;
  get diagnostics n = row_count;
  return n;
end; $function$;

-- ── Resumenes: los retenidos salen de "pendientes" y tienen columna propia ──
-- (cambia la firma de retorno: hay que soltarlas antes de recrearlas)
drop function if exists public.get_pendientes_fechas();
drop function if exists public.get_pendientes_resumen_mes(date, date);

create or replace function public.get_pendientes_fechas()
returns table(fecha date, total bigint, recibidos bigint, no_recibidos bigint, retenidos bigint)
language sql security definer set search_path to 'public' as $function$
  select fecha_ultima_vista, count(*)::bigint,
    count(*) filter (where estado_recepcion in ('recibido','entregado'))::bigint,
    count(*) filter (where estado_recepcion = 'no_recibido')::bigint,
    count(*) filter (where estado_recepcion = 'retenido')::bigint
  from pendientes group by fecha_ultima_vista order by fecha_ultima_vista desc;
$function$;

create or replace function public.get_pendientes_resumen_mes(p_desde date, p_hasta date)
returns table(fecha date, total bigint, recibidos bigint, no_recibidos bigint, pendientes bigint, retenidos bigint)
language sql security definer set search_path to 'public' as $function$
  select fecha_ultima_vista, count(*)::bigint,
    count(*) filter (where estado_recepcion in ('recibido','entregado'))::bigint,
    count(*) filter (where estado_recepcion = 'no_recibido')::bigint,
    count(*) filter (where estado_recepcion = 'pendiente')::bigint,
    count(*) filter (where estado_recepcion = 'retenido')::bigint
  from pendientes where fecha_ultima_vista between p_desde and p_hasta
  group by fecha_ultima_vista order by fecha_ultima_vista;
$function$;

-- ── Importacion: el reingreso conserva la retencion ─────────
create or replace function public.importar_pendientes(
  p_fecha date, p_filas jsonb, p_forzar boolean default false
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  fila record;
  v_existente pendientes%rowtype;
  v_nuevos int := 0; v_reingresos int := 0; v_actualizados int := 0;
  k record; v_hoy int; v_faltan int; v_reset int; i int;
begin
  if not es_editor() then raise exception 'No autorizado: se requiere rol editor'; end if;

  create temp table _imp on commit drop as
  select
    case when length(coalesce(nullif(trim(f->>'tracking'),''),'')) >= 6 then trim(f->>'tracking') end as tracking,
    nullif(f->>'fecha_hogareno','')::timestamptz as fecha_hogareno,
    coalesce(f->>'macrozona','SIN ZONA') as macrozona,
    nullif(f->>'zona','') as zona,
    nullif(f->>'urgencia','') as urgencia,
    nullif(f->>'direccion','') as direccion,
    nullif(f->>'estado','') as estado,
    nullif(f->>'cadete','') as cadete,
    nullif(f->>'cliente','') as cliente
  from jsonb_array_elements(p_filas) f
  -- Excluir "A Retirar" y "Retirado": el cliente los retira (no vuelven al
  -- depósito), así que no entran al control de pendientes.
  where coalesce(lower(trim(f->>'estado')), '') not in ('a retirar', 'retirado');

  for fila in select * from _imp where tracking is not null loop
    v_existente := null;
    select * into v_existente from pendientes where tracking = fila.tracking order by creado_en asc limit 1;

    if v_existente.id is not null and v_existente.fecha_ultima_vista < p_fecha then
      -- Reingreso. Si Control y Gestión lo tenía retenido, sigue retenido:
      -- no vuelve a la cola de pendientes ni escala a urgente.
      update pendientes set
        fecha_hogareno = fila.fecha_hogareno, macrozona = fila.macrozona, zona = fila.zona,
        direccion = fila.direccion, estado = fila.estado, cadete = fila.cadete, cliente = fila.cliente,
        urgencia = case
          when v_existente.estado_recepcion = 'retenido' then v_existente.urgencia
          when p_fecha > v_existente.fecha then 'urgente'
          else fila.urgencia end,
        estado_recepcion = case when v_existente.estado_recepcion = 'retenido' then 'retenido' else 'pendiente' end,
        motivo_no_recibido = null,
        observacion = case when v_existente.estado_recepcion = 'retenido' then v_existente.observacion end,
        recibido_en = case when v_existente.estado_recepcion = 'retenido' then v_existente.recibido_en end,
        recibido_por = case when v_existente.estado_recepcion = 'retenido' then v_existente.recibido_por end,
        fecha_ultima_vista = p_fecha, nro_ciclo = v_existente.nro_ciclo + 1, reincidencia = true
      where id = v_existente.id;
      v_reingresos := v_reingresos + 1;
    elsif v_existente.id is not null then
      update pendientes set
        fecha_hogareno = fila.fecha_hogareno, macrozona = fila.macrozona, zona = fila.zona,
        direccion = fila.direccion, estado = fila.estado, cadete = fila.cadete, cliente = fila.cliente,
        urgencia = coalesce(fila.urgencia, v_existente.urgencia)
      where id = v_existente.id;
      v_actualizados := v_actualizados + 1;
    else
      insert into pendientes (fecha, fecha_hogareno, macrozona, zona, urgencia, tracking, direccion, estado, cadete, cliente,
        fecha_ultima_vista, reincidencia, nro_ciclo, creado_por)
      values (p_fecha, fila.fecha_hogareno, fila.macrozona, fila.zona, fila.urgencia, fila.tracking,
        fila.direccion, fila.estado, fila.cadete, fila.cliente, p_fecha, false, 1, auth.uid());
      v_nuevos := v_nuevos + 1;
    end if;
  end loop;

  for k in
    select direccion, cliente, count(*)::int as n,
      max(macrozona) as macrozona, max(zona) as zona, max(cadete) as cadete,
      max(estado) as estado, max(fecha_hogareno) as fecha_hogareno, max(urgencia) as urgencia
    from _imp where tracking is null
    group by direccion, cliente
  loop
    select count(*)::int into v_hoy from pendientes p
    where (p.tracking is null or length(trim(p.tracking)) < 6)
      and p.direccion is not distinct from k.direccion
      and p.cliente is not distinct from k.cliente
      and p.fecha_ultima_vista = p_fecha;

    v_actualizados := v_actualizados + least(v_hoy, k.n);
    v_faltan := k.n - v_hoy;
    if v_faltan <= 0 then continue; end if;

    with candidatas as (
      select id, fecha, nro_ciclo, estado_recepcion, urgencia, observacion, recibido_en, recibido_por
      from pendientes p
      where (p.tracking is null or length(trim(p.tracking)) < 6)
        and p.direccion is not distinct from k.direccion
        and p.cliente is not distinct from k.cliente
        and p.fecha_ultima_vista < p_fecha
      order by p.fecha asc limit v_faltan
    )
    update pendientes p set
      fecha_hogareno = k.fecha_hogareno, macrozona = k.macrozona, zona = k.zona,
      estado = k.estado, cadete = k.cadete,
      urgencia = case
        when c.estado_recepcion = 'retenido' then c.urgencia
        when p_fecha > c.fecha then 'urgente'
        else k.urgencia end,
      estado_recepcion = case when c.estado_recepcion = 'retenido' then 'retenido' else 'pendiente' end,
      motivo_no_recibido = null,
      observacion = case when c.estado_recepcion = 'retenido' then c.observacion end,
      recibido_en = case when c.estado_recepcion = 'retenido' then c.recibido_en end,
      recibido_por = case when c.estado_recepcion = 'retenido' then c.recibido_por end,
      fecha_ultima_vista = p_fecha, nro_ciclo = c.nro_ciclo + 1, reincidencia = true
    from candidatas c where p.id = c.id;
    get diagnostics v_reset = row_count;
    v_reingresos := v_reingresos + v_reset;
    v_faltan := v_faltan - v_reset;

    for i in 1..v_faltan loop
      insert into pendientes (fecha, fecha_hogareno, macrozona, zona, urgencia, tracking, direccion, estado, cadete, cliente,
        fecha_ultima_vista, reincidencia, nro_ciclo, creado_por)
      values (p_fecha, k.fecha_hogareno, k.macrozona, k.zona, k.urgencia, null,
        k.direccion, k.estado, k.cadete, k.cliente, p_fecha, false, 1, auth.uid());
      v_nuevos := v_nuevos + 1;
    end loop;
  end loop;

  drop table _imp;

  return jsonb_build_object(
    'nuevos', v_nuevos, 'reingresos', v_reingresos, 'actualizados', v_actualizados,
    'total', v_nuevos + v_reingresos + v_actualizados
  );
end; $function$;

commit;
