-- ============================================================
-- Demo · 3 de 3: resultados, pendientes, alternativas y deposito
-- ============================================================
-- Completa las pantallas que muestran el resultado de la operacion y el
-- modulo de deposito.
--
-- Los destinatarios son inventados y las direcciones se arman con calles
-- reales del AMBA mas una altura al azar: son creibles para mostrar pero
-- no corresponden a ninguna persona. Los telefonos usan el prefijo
-- 11-0000-xxxx, que no existe, para que no haya forma de llamar a nadie.
--
-- Se corre despues de 02_operacion.sql. Idempotente.
-- ============================================================

begin;

select setseed(0.42);

-- ── Diccionarios para armar datos creibles ──────────────────
create temp table _calles(nombre text) on commit drop;
insert into _calles values
  ('Av. Rivadavia'),('Av. Corrientes'),('Av. Cabildo'),('Av. Santa Fe'),
  ('Av. Mitre'),('Av. Belgrano'),('San Martin'),('Belgrano'),('Sarmiento'),
  ('Alsina'),('Moreno'),('Lavalle'),('Chacabuco'),('Bolivar'),('Peru'),
  ('Uruguay'),('Paraguay'),('Chile'),('Brasil'),('Colombia'),('Salta'),
  ('Jujuy'),('Catamarca'),('La Rioja'),('Mendoza'),('San Juan'),('Entre Rios'),
  ('Misiones'),('Formosa'),('Chubut'),('Neuquen'),('Rio Negro'),('Tucuman'),
  ('Los Aromos'),('Las Heras'),('Las Camelias'),('Los Alamos'),('El Ceibo');

create temp table _nombres(nombre text) on commit drop;
insert into _nombres values
  ('Ana Ferrero'),('Beatriz Lombardi'),('Carla Sosa'),('Diana Pucheta'),
  ('Elena Varela'),('Florencia Nardi'),('Gabriela Ruiz Diaz'),('Helena Cortes'),
  ('Irene Bazan'),('Julieta Ocanto'),('Karina Solari'),('Lorena Pintos'),
  ('Marina Estevez'),('Natalia Corvalan'),('Olga Barreto'),('Paula Zabala'),
  ('Romina Tissera'),('Sofia Aranda'),('Tamara Rivero'),('Valeria Quinteros'),
  ('Agustin Petrone'),('Bruno Cardozo'),('Ciro Maldonado'),('Dante Ferrari'),
  ('Elias Navarro'),('Facundo Bermudez'),('Gaston Reinoso'),('Hugo Alvarenga'),
  ('Ismael Cuellar'),('Joaquin Miranda'),('Lautaro Paez'),('Manuel Frias'),
  ('Nicolas Bogado'),('Octavio Sanabria'),('Pedro Cattaneo'),('Ramiro Uriarte'),
  ('Santiago Molina'),('Tobias Leguizamon'),('Ulises Franco'),('Vicente Salvo');

create temp table _localidades(nombre text, zona text) on commit drop;
insert into _localidades values
  ('Caballito','CABA'),('Flores','CABA'),('Palermo','CABA'),('Belgrano','CABA'),
  ('Almagro','CABA'),('Villa Devoto','CABA'),('Liniers','CABA'),('Barracas','CABA'),
  ('San Isidro','Norte'),('Vicente Lopez','Norte'),('Tigre','Norte'),('Pilar','Norte'),
  ('Escobar','Norte'),('San Fernando','Norte'),('San Martin','Norte'),
  ('Moron','Oeste'),('Ituzaingo','Oeste'),('Ramos Mejia','Oeste'),('San Justo','Oeste'),
  ('Merlo','Oeste'),('Moreno','Oeste'),('Hurlingham','Oeste'),
  ('Avellaneda','Sur'),('Lanus','Sur'),('Lomas de Zamora','Sur'),('Quilmes','Sur'),
  ('Berazategui','Sur'),('Florencio Varela','Sur'),('La Plata','Sur');

-- Estados posibles de un paquete al cierre del dia, con su peso.
create temp table _estados(estado text, peso numeric) on commit drop;
insert into _estados values
  ('Entregado', 0.930),
  ('En camino al destinatario', 0.030),
  ('Nadie en el domicilio', 0.020),
  ('Direccion incorrecta', 0.008),
  ('Rechazado por el destinatario', 0.005),
  ('Cancelado', 0.004);

-- ── Analisis diario de los ultimos 30 dias ──────────────────
do $$
declare
  d date;
  total int;
  entregados int;
  en_camino int;
  post21 int;
  post21_ok int;
  r record;
begin
  for d in
    select distinct fecha from clientes_diarios
    where fecha >= current_date - 30 order by 1
  loop
    select sum(paquetes) into total from clientes_diarios where fecha = d;

    -- Efectividad: entre 91% y 97%, con los lunes un poco peor porque el
    -- volumen alto satura la calle.
    entregados := round(total * (
      case when extract(isodow from d) = 1 then 0.915 else 0.945 end
      + random() * 0.025))::int;
    en_camino := round((total - entregados) * (0.35 + random() * 0.3))::int;

    -- Post 21hs: lo que se sigue intentando entregar de noche.
    post21 := round(total * (0.02 + random() * 0.06))::int;
    post21_ok := round(post21 * (0.75 + random() * 0.2))::int;

    insert into analisis_diario (
      fecha, total_paquetes, entregados, pct_exito,
      post21_total, post21_entregados, post21_pct_exito, post21_pct_del_dia,
      en_camino_destinatario, en_camino_destinatario_pct)
    values (
      d, total, entregados, round(entregados::numeric / total * 100, 2),
      post21, post21_ok,
      round(post21_ok::numeric / nullif(post21, 0) * 100, 2),
      round(post21::numeric / total * 100, 2),
      en_camino, round(en_camino::numeric / total * 100, 2));

    -- Desglose por estado: entregados reales y el resto repartido.
    insert into analisis_diario_estado (fecha, estado, cantidad, pct)
    select d, 'Entregado', entregados, round(entregados::numeric / total * 100, 2)
    union all
    select d, e.estado,
           greatest(1, round((total - entregados) * (e.peso / 0.067))::int),
           round((total - entregados) * (e.peso / 0.067) / total * 100, 2)
    from _estados e where e.estado <> 'Entregado';

    -- Desglose por cliente.
    insert into analisis_diario_cliente (fecha, cliente, cantidad, pct_del_dia,
                                         en_camino_destinatario, en_camino_destinatario_pct)
    select d, cd.cliente, cd.paquetes,
           round(cd.paquetes::numeric / total * 100, 2),
           round(cd.paquetes * (random() * 0.05))::int,
           round(random() * 5, 2)
    from clientes_diarios cd where cd.fecha = d;

    -- Tardanzas por zona.
    insert into analisis_diario_tarde_zona (fecha, zona, cantidad, entregados, pct_efectividad)
    select d, z.zona,
           greatest(1, round(post21 * z.parte)::int),
           greatest(0, round(post21 * z.parte * (0.7 + random() * 0.25))::int),
           round((70 + random() * 25)::numeric, 1)
    from (values ('CABA', 0.22), ('Norte', 0.26), ('Oeste', 0.30), ('Sur', 0.22)) z(zona, parte);

    -- Tardanzas por chofer: los que llevaron mas paquetes ese dia.
    insert into analisis_diario_tarde_chofer (fecha, chofer, cantidad, entregados, pct_efectividad)
    select d, cg.chofer,
           greatest(1, round(post21 / 8.0 * (0.5 + random()))::int),
           greatest(0, round(post21 / 8.0 * (0.4 + random() * 0.5))::int),
           round((65 + random() * 30)::numeric, 1)
    from (select distinct chofer from carga_dia where fecha = d and chofer is not null
          order by chofer limit 8) cg;
  end loop;
end $$;

-- Detalle por paquete de los no entregados (lo que se abre en pantalla).
insert into analisis_diario_detalle (fecha, tracking, hora, estado, zona, localidad, chofer, cliente, destinatario, direccion)
select
  a.fecha,
  'DM' || lpad((random() * 99999999)::bigint::text, 8, '0'),
  ((time '18:00' + (random() * interval '5 hours'))::time)::text,
  (array['En camino al destinatario','Nadie en el domicilio','Direccion incorrecta','Rechazado por el destinatario'])[1 + floor(random() * 4)],
  l.zona, l.nombre,
  (select chofer from carga_dia c where c.fecha = a.fecha and c.chofer is not null
   order by random() limit 1),
  (select cliente from clientes_diarios cd where cd.fecha = a.fecha order by random() limit 1),
  n.nombre,
  cl.nombre || ' ' || (100 + floor(random() * 4900))::int
from analisis_diario a
cross join lateral (select nombre, zona from _localidades order by random() limit 1) l
cross join lateral (select nombre from _nombres order by random() limit 1) n
cross join lateral (select nombre from _calles order by random() limit 1) cl
cross join lateral generate_series(1, 12) g
where a.fecha >= current_date - 14;

-- Detalle de los post-21hs sin entregar.
insert into analisis_diario_tarde_detalle (fecha, tracking, hora, estado, zona, localidad, chofer, cliente, destinatario, direccion)
select fecha, tracking, hora, estado, zona, localidad, chofer, cliente, destinatario, direccion
from analisis_diario_detalle
where fecha >= current_date - 7 and estado <> 'Direccion incorrecta';

-- ── Pendientes de los ultimos dias ──────────────────────────
insert into pendientes (
  fecha, fecha_hogareno, macrozona, zona, urgencia, tracking, direccion,
  estado, cadete, cliente, fecha_ultima_vista, reincidencia, nro_ciclo, estado_recepcion)
select
  f.fecha, f.fecha - interval '1 day',
  upper(l.zona), l.nombre,
  case when random() < 0.15 then 'urgente' when random() < 0.3 then 'prioridad' else null end,
  'DM' || lpad((random() * 99999999)::bigint::text, 8, '0'),
  cl.nombre || ' ' || (100 + floor(random() * 4900))::int,
  (array['Nadie en el domicilio','En camino al destinatario','Direccion incorrecta'])[1 + floor(random() * 3)],
  (select nombre from conductores order by random() limit 1),
  (select cliente from clientes_diarios cd where cd.fecha = f.fecha order by random() limit 1),
  f.fecha,
  random() < 0.2,
  case when random() < 0.2 then 2 else 1 end,
  case when f.fecha < current_date then
         (array['recibido','recibido','recibido','entregado','no_recibido','retenido'])[1 + floor(random() * 6)]
       else 'pendiente' end
from (select distinct fecha from clientes_diarios where fecha >= current_date - 3) f
cross join lateral (select nombre, zona from _localidades order by random() limit 1) l
cross join lateral (select nombre from _calles order by random() limit 1) cl
cross join lateral generate_series(1, 30) g;

-- Motivo para los que quedaron sin recibir.
update pendientes
set motivo_no_recibido = (array['Extraviado','No vino el conductor','Conductor no lo trajo','Entregado'])[1 + floor(random() * 4)]
where estado_recepcion = 'no_recibido';

update pendientes
set observacion = 'Frenado por Control y Gestion hasta confirmar la direccion'
where estado_recepcion = 'retenido';

-- ── Alternativas de entrega ─────────────────────────────────
insert into alternativas_entrega (fecha, tipo, cliente, telefono, direccion, chofer, estado)
select
  f.fecha,
  case when random() < 0.5 then 'demora' else 'alternativa' end,
  n.nombre,
  '11-0000-' || lpad((random() * 9999)::int::text, 4, '0'),
  cl.nombre || ' ' || (100 + floor(random() * 4900))::int || ', ' || l.nombre,
  (select nombre from conductores order by random() limit 1),
  (array['pendiente','enviado','alternativa','impreso','cerrado'])[1 + floor(random() * 5)]
from (select distinct fecha from clientes_diarios where fecha >= current_date - 2) f
cross join lateral (select nombre from _nombres order by random() limit 1) n
cross join lateral (select nombre from _calles order by random() limit 1) cl
cross join lateral (select nombre from _localidades order by random() limit 1) l
cross join lateral generate_series(1, 14) g;

-- ── Paquetes especiales ─────────────────────────────────────
insert into paquetes_especiales (fecha, recorrido_id, cliente, tracking, alto_cm, ancho_cm, largo_cm, peso_kg, observacion, direccion)
select
  current_date - (floor(random() * 5))::int,
  (select id from recorridos where tipo = 'fijo' order by random() limit 1),
  (array['Muebles Delta','MegaHogar','ElectroSur','Blanco Hogar'])[1 + floor(random() * 4)],
  'DM' || lpad((random() * 99999999)::bigint::text, 8, '0'),
  (40 + random() * 120)::numeric(6,1),
  (40 + random() * 90)::numeric(6,1),
  (60 + random() * 140)::numeric(6,1),
  (8 + random() * 45)::numeric(6,1),
  (array['Bulto voluminoso, entra solo en utilitario','Fragil: no apilar','Requiere dos personas para bajarlo','Sobredimensionado'])[1 + floor(random() * 4)],
  cl.nombre || ' ' || (100 + floor(random() * 4900))::int
from generate_series(1, 12) g
cross join lateral (select nombre from _calles order by random() limit 1) cl;

commit;

-- ============================================================
-- Deposito ficticio
-- ============================================================
begin;

select setseed(0.42);

create temp table _calles2(nombre text) on commit drop;
insert into _calles2 select nombre from (values
  ('Av. Rivadavia'),('Av. Mitre'),('San Martin'),('Belgrano'),('Sarmiento'),
  ('Las Heras'),('Los Aromos'),('Alsina'),('Moreno'),('Chacabuco')) v(nombre);

-- Clientes que dejan mercaderia guardada.
insert into clients (name, nombre_fantasia, phone, email, address, notes)
values
  ('Distribuidora Pampa SRL','Tienda Pampa','11-0000-1001','contacto@tiendapampa.demo','Av. Rivadavia 8450, Floresta',null),
  ('Comercial Hogar SA','MegaHogar','11-0000-1002','ventas@megahogar.demo','Av. Mitre 2300, Avellaneda','Retira los martes'),
  ('Bazar Trenque SRL','Bazar Trenque','11-0000-1003','info@bazartrenque.demo','San Martin 1250, Moron','El local abre de 9 a 13'),
  ('Electro Sur SA','ElectroSur','11-0000-1004','logistica@electrosur.demo','Belgrano 780, Quilmes',null),
  ('Indumentaria Litoral SRL','Moda Litoral','11-0000-1005','deposito@modalitoral.demo','Sarmiento 455, San Isidro',null),
  ('Farmaceutica Sur SA','Farmacia Sur','11-0000-1006','recepcion@farmaciasur.demo','Las Heras 1120, Lanus','No dejar en porteria'),
  ('Mascotas y Mas SRL','Mundo Mascotas','11-0000-1007','hola@mundomascotas.demo','Los Aromos 340, Ituzaingo','Llamar antes de llegar'),
  ('Deportes Andes SA','Deportes Andes','11-0000-1008','stock@deportesandes.demo','Alsina 2075, Ramos Mejia',null),
  ('Papelera Pilar SRL','Libreria Pilar','11-0000-1009','pedidos@libreriapilar.demo','Moreno 640, Pilar',null),
  ('Optica Central SA','Optica Central','11-0000-1010','admin@opticacentral.demo','Chacabuco 190, CABA','Producto fragil'),
  ('Juguetes Colon SRL','Juguetes Colon','11-0000-1011','ventas@juguetescolon.demo','Av. Rivadavia 12300, Liniers',null),
  ('Muebles Delta SA','Muebles Delta','11-0000-1012','deposito@mueblesdelta.demo','San Martin 3400, Tigre','Bultos grandes');

-- Bultos que estan hoy en el galpon.
insert into bultos (client_id, description, barcode, tracking_id, status, entry_date, destination_address, destination_locality)
select
  c.id,
  (array['Caja x6 unidades','Bulto sin abrir','Paquete chico','Caja grande','Sobre','Bolsa cerrada'])[1 + floor(random() * 6)],
  'BLT' || lpad((random() * 999999)::int::text, 6, '0'),
  'DM' || lpad((random() * 99999999)::bigint::text, 8, '0'),
  case when random() < 0.72 then 'stored'
       when random() < 0.85 then 'scheduled_return'
       when random() < 0.93 then 'cambio'
       else 'devolucion' end,
  current_date - (floor(random() * 24))::int,
  cl.nombre || ' ' || (100 + floor(random() * 4900))::int,
  l.nombre
from clients c
cross join lateral generate_series(1, 6 + floor(random() * 10)::int) g
cross join lateral (select nombre from _calles2 order by random() limit 1) cl
cross join lateral (select nombre from (values ('Moron'),('Quilmes'),('Tigre'),('CABA'),('Lanus'),('Pilar')) v(nombre) order by random() limit 1) l;

-- Retiro agendado para hoy en algunos de los que estaban esperando.
update bultos set scheduled_return_date = current_date
where status = 'scheduled_return' and random() < 0.5;

-- Remitos ya emitidos: el historial de salidas de los ultimos 3 meses.
--
-- Se arma en dos pasos a proposito. Poner el jsonb_agg de las lineas
-- dentro de la misma consulta no funciona: como las lineas usan datos de
-- la fila de afuera (la fecha del remito), Postgres considera que el
-- agregado pertenece a la consulta externa y rechaza la sentencia.
create temp table _rem(
  id serial primary key, numero int, client_id uuid,
  cliente_nombre text, fecha date, cantidad int) on commit drop;
create temp table _lin(rem int, linea jsonb) on commit drop;

insert into _rem (numero, client_id, cliente_nombre, fecha, cantidad)
select
  row_number() over (order by f.fecha, c.id)::int,
  c.id, coalesce(c.nombre_fantasia, c.name), f.fecha, cant.n
from (select generate_series(current_date - 90, current_date - 1, '1 day'::interval)::date as fecha) f
cross join lateral (select id, name, nombre_fantasia from clients order by random() limit 1 + floor(random() * 2)::int) c
cross join lateral (select 1 + floor(random() * 9)::int as n) cant
where extract(isodow from f.fecha) < 6;

insert into _lin (rem, linea)
select r.id, jsonb_build_object(
  'tracking', 'DM' || lpad((random() * 99999999)::bigint::text, 8, '0'),
  'descripcion', (array['Caja x6 unidades','Bulto sin abrir','Paquete chico','Caja grande'])[1 + floor(random() * 4)],
  'ingreso', (r.fecha - (5 + floor(random() * 20))::int)::text,
  'destino', cl.nombre || ' ' || (100 + floor(random() * 4900))::int,
  'localidad', (array['Moron','Quilmes','Tigre','CABA','Lanus'])[1 + floor(random() * 5)],
  'estado', 'returned')
from _rem r
cross join lateral generate_series(1, r.cantidad) g
cross join lateral (select nombre from _calles2 order by random() limit 1) cl;

insert into remitos (numero, client_id, cliente_nombre, fecha, cantidad, lineas)
select r.numero, r.client_id, r.cliente_nombre, r.fecha, r.cantidad,
       coalesce(l.lineas, '[]'::jsonb)
from _rem r
left join lateral (select jsonb_agg(linea) as lineas from _lin where rem = r.id) l on true;

-- El numerador sigue donde quedo el ultimo remito. Se inserta la fila
-- porque doc_counter viene vacia: el esquema trae la tabla, no sus datos.
insert into doc_counter (id, last_number)
values (1, coalesce((select max(numero) from remitos), 0))
on conflict (id) do update set last_number = excluded.last_number;

commit;

select
  (select count(*) from analisis_diario) as dias_analizados,
  (select count(*) from analisis_diario_detalle) as detalle_no_entregados,
  (select count(*) from pendientes) as pendientes,
  (select count(*) from alternativas_entrega) as alternativas,
  (select count(*) from paquetes_especiales) as especiales,
  (select count(*) from clients) as clientes_deposito,
  (select count(*) from bultos) as bultos_en_deposito,
  (select count(*) from remitos) as remitos;
