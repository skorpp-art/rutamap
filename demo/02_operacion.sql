-- ============================================================
-- Demo · 2 de 3: 60 dias de operacion
-- ============================================================
-- Arma el historial que hace que el demo se vea vivo: volumen por
-- cliente y por dia, recorridos activos, carga de cada chofer y los
-- indicadores del dia.
--
-- El volumen no es al azar plano: sigue el patron real de una operacion
-- de reparto. El lunes es el dia pesado porque se acumula lo del fin de
-- semana, martes a viernes es parejo, el sabado cae a la mitad y el
-- domingo no se opera. Sobre eso hay una variacion diaria y un par de
-- picos, para que los graficos tengan forma en vez de ser una linea.
--
-- Se corre despues de 01_catalogos.sql. Idempotente.
-- ============================================================

do $$
begin
  if exists (select 1 from analisis_diario) then
    raise exception 'Esta base ya tiene analisis cargado. Corre primero 01_catalogos.sql en el demo.';
  end if;
end $$;

begin;

select setseed(0.42);

-- Clientes ficticios y cuanto pesa cada uno en el volumen del dia.
create temp table _clientes(nombre text, peso numeric) on commit drop;
insert into _clientes values
  ('Tienda Pampa', 0.170), ('MegaHogar', 0.130), ('Bazar Trenque', 0.095),
  ('ElectroSur', 0.080), ('Moda Litoral', 0.070), ('Farmacia Sur', 0.055),
  ('Mundo Mascotas', 0.050), ('Deportes Andes', 0.045), ('Libreria Pilar', 0.040),
  ('Optica Central', 0.035), ('Juguetes Colon', 0.032), ('Ferreteria Norte', 0.030),
  ('Cosmetica Bella', 0.028), ('Muebles Delta', 0.025), ('Vinoteca Cuyo', 0.022),
  ('Tecno Express', 0.020), ('Calzados Rivera', 0.018), ('Blanco Hogar', 0.015),
  ('Perfumeria Luna', 0.013), ('Regalos Ideal', 0.011), ('Kiosco Mayorista', 0.010),
  ('Verduleria Online', 0.009);

do $$
declare
  d date;
  dow int;
  tipo_dia text;
  total_dia int;
  factor numeric;
  r record;
  activos int;
  restante int;
  asignado int;
  i int;
  choferes text[];
  n_choferes int;
begin
  select array_agg(nombre order by nombre) into choferes from conductores;
  n_choferes := array_length(choferes, 1);

  for d in
    select generate_series(current_date - 60, current_date, '1 day'::interval)::date
  loop
    dow := extract(isodow from d);
    if dow = 7 then continue; end if;  -- domingo no se opera

    -- Patron semanal: el lunes arrastra el fin de semana, el sabado es
    -- media jornada.
    factor := case dow
      when 1 then 1.55
      when 6 then 0.62
      else 1.00 end;

    -- Variacion diaria de +-12%, y un empujon en la primera quincena
    -- (cuando cobran, se compra mas).
    factor := factor * (0.88 + random() * 0.24)
                     * (case when extract(day from d) <= 15 then 1.06 else 0.96 end);

    total_dia := round(1700 * factor);

    tipo_dia := case when dow = 1 then 'lun_feriado'
                     when dow = 6 then 'sabado'
                     else 'mar_vie' end;

    -- ── Volumen por cliente ──
    insert into clientes_diarios (fecha, cliente, paquetes, manual)
    select d, c.nombre,
           greatest(1, round(total_dia * c.peso * (0.85 + random() * 0.3))::int),
           false
    from _clientes c;

    -- El total del dia es la suma real de los clientes, no el estimado.
    select coalesce(sum(paquetes), 0) into total_dia
    from clientes_diarios where fecha = d;

    -- ── Recorridos activos del dia ──
    -- Sale el piso del tipo de dia; ademas, uno de cada diez dias entra
    -- un comodin por una ausencia.
    insert into operacion_dia (fecha, recorrido_id, activo)
    select d, r2.id,
           exists (select 1 from plantilla_operacion p
                   where p.tipo_dia = tipo_dia and p.recorrido_id = r2.id)
           or (r2.tipo = 'suplencia' and random() < 0.10)
    from recorridos r2;

    select count(*) into activos from operacion_dia where fecha = d and activo;

    -- ── Reparto del volumen entre los recorridos activos ──
    -- Se reparte parejo y la diferencia queda en el ultimo, para que la
    -- suma cierre exacta con el total del dia.
    restante := total_dia;
    i := 0;
    for r in
      select od.recorrido_id, rc.codigo, rc.zona, rc.tipo
      from operacion_dia od
      join recorridos rc on rc.id = od.recorrido_id
      where od.fecha = d and od.activo
      order by rc.codigo
    loop
      i := i + 1;
      if i = activos then
        asignado := restante;
      else
        asignado := greatest(8, round(total_dia::numeric / activos * (0.75 + random() * 0.5))::int);
        asignado := least(asignado, restante - (activos - i) * 8);
      end if;
      restante := restante - asignado;

      update operacion_dia set paquetes_asignados = asignado
      where fecha = d and recorrido_id = r.recorrido_id;

      -- Lo que efectivamente se despacho: casi todo por sistema y una
      -- fraccion "por fuera" (lo que se suma a mano en el playon).
      insert into operaciones_diarias (fecha, turno, codigo, zona, tipo, sistema, x_fuera, total)
      values (
        d,
        case when r.tipo = 'pre_turno' then 'preturno' else 'tarde' end,
        r.codigo, r.zona, r.tipo,
        round(asignado * (0.93 + random() * 0.06))::int,
        round(asignado * (random() * 0.07))::int,
        asignado
      );

      -- Carga del dia: quien lleva cada recorrido.
      insert into carga_dia (fecha, turno, recorrido_id, chofer, sistema, x_fuera, estado_control)
      values (
        d,
        case when r.tipo = 'pre_turno' then 'preturno' else 'tarde' end,
        r.recorrido_id,
        choferes[1 + ((i * 7 + extract(day from d)::int * 3) % n_choferes)],
        round(asignado * (0.93 + random() * 0.06))::int,
        round(asignado * (random() * 0.07))::int,
        case when random() < 0.85 then 'verde'
             when random() < 0.7 then 'amarillo' else 'azul' end
      );
    end loop;

    -- ── Indicadores del dia ──
    insert into kpis_diarios (fecha, carga_playon_min, pct_en_termino, total_despachado, devoluciones, incidencias)
    values (
      d,
      round(95 + random() * 55)::int,
      round((88 + random() * 10)::numeric, 1),
      total_dia,
      round(total_dia * (0.02 + random() * 0.02))::int,
      round(random() * 4)::int
    );
  end loop;
end $$;

commit;

select
  (select count(distinct fecha) from clientes_diarios) as dias,
  (select sum(paquetes) from clientes_diarios) as paquetes_totales,
  (select round(avg(t)) from (
     select fecha, sum(paquetes) t from clientes_diarios group by fecha) s) as promedio_diario,
  (select count(*) from operaciones_diarias) as filas_operacion,
  (select count(*) from carga_dia) as filas_carga;
