-- ============================================================
-- Demo · 1 de 3: catalogos ficticios
-- ============================================================
-- Genera la estructura fija de una operacion inventada: recorridos,
-- choferes, clientes y el piso de cada tipo de dia.
--
-- IMPORTANTE: esto se corre SOLO en el proyecto del demo. Empieza
-- borrando las tablas que llena, asi que en produccion seria un
-- desastre. El chequeo de abajo aborta si detecta datos reales.
--
-- Nada de lo que hay aca existe: los clientes son inventados, los
-- choferes tambien, y los telefonos usan el prefijo 11-0000-xxxx para
-- que no exista ninguna chance de llamar a una persona real. Los
-- barrios si son reales, porque hacen falta para que el mapa y las
-- zonas se vean como una operacion de verdad, y no son dato de nadie.
--
-- Idempotente: se puede correr las veces que haga falta.
-- ============================================================

-- Freno de mano: si la base tiene analisis diario cargado o mas de 150
-- recorridos, no es el demo.
do $$
begin
  if exists (select 1 from analisis_diario)
     or (select count(*) from recorridos) > 150 then
    raise exception 'Esta base parece la de produccion. El seed del demo NO se ejecuta.';
  end if;
end $$;

begin;

-- ── Limpieza de lo que genera el seed ───────────────────────
truncate table
  operacion_dia, operaciones_diarias, carga_dia, clientes_diarios,
  volumenes_diarios, plantilla_operacion, recorridos_historial,
  paquetes_especiales, alternativas_entrega, pendientes,
  analisis_diario_detalle, analisis_diario_tarde_detalle,
  analisis_diario_tarde_chofer, analisis_diario_tarde_zona,
  analisis_diario_cliente, analisis_diario_estado, analisis_diario,
  condiciones_especiales, kpis_diarios, conductores
  restart identity cascade;
delete from recorridos;

-- Semilla fija: dos corridas dan el mismo demo.
select setseed(0.42);

-- ── Recorridos ──────────────────────────────────────────────
-- Misma logica que la operacion real: refuerzos fijos por zona (RF),
-- pre-turnos que salen temprano (PT), cortes que parten una zona
-- grande (CE) y comodines de suplencia (SU).
insert into recorridos (codigo, nombre, zona, tipo, color, activo)
values
  -- CABA
  ('RF-CA-01','Caballito / Flores','CABA','fijo','#dc2626',true),
  ('RF-CA-02','Liniers / Mataderos','CABA','fijo','#dc2626',true),
  ('RF-CA-03','Palermo','CABA','fijo','#dc2626',true),
  ('RF-CA-04','La Boca / Barracas','CABA','fijo','#dc2626',true),
  ('RF-CA-05','Villa Devoto / Saavedra','CABA','fijo','#dc2626',true),
  ('RF-CA-06','Almagro / Boedo','CABA','fijo','#dc2626',true),
  ('RF-CA-07','Nuñez / Belgrano','CABA','fijo','#dc2626',true),
  ('RF-CA-08','Recoleta / Retiro','CABA','fijo','#dc2626',true),
  ('RF-CA-09','[Moto] Microcentro','CABA','fijo','#dc2626',true),
  ('RF-CA-10','[Moto] Palermo / Recoleta','CABA','fijo','#dc2626',true),
  -- Norte
  ('RF-NO-01','Zarate / Campana','Norte','fijo','#d97706',true),
  ('RF-NO-02','Escobar / Garin','Norte','fijo','#d97706',true),
  ('RF-NO-03','Pilar','Norte','fijo','#d97706',true),
  ('RF-NO-04','Tigre / Benavidez','Norte','fijo','#d97706',true),
  ('RF-NO-05','San Isidro / Martinez','Norte','fijo','#d97706',true),
  ('RF-NO-06','Vicente Lopez / Olivos','Norte','fijo','#d97706',true),
  ('RF-NO-07','San Fernando','Norte','fijo','#d97706',true),
  ('RF-NO-08','Jose C. Paz / Malvinas','Norte','fijo','#d97706',true),
  ('RF-NO-09','San Martin','Norte','fijo','#d97706',true),
  -- Oeste
  ('RF-OE-01','San Miguel','Oeste','fijo','#2563eb',true),
  ('RF-OE-02','Hurlingham / El Palomar','Oeste','fijo','#2563eb',true),
  ('RF-OE-03','Tres de Febrero / Ciudadela','Oeste','fijo','#2563eb',true),
  ('RF-OE-04','Moron / Haedo','Oeste','fijo','#2563eb',true),
  ('RF-OE-05','Ituzaingo / Castelar','Oeste','fijo','#2563eb',true),
  ('RF-OE-06','Ramos Mejia / San Justo','Oeste','fijo','#2563eb',true),
  ('RF-OE-07','Matanza Norte','Oeste','fijo','#2563eb',true),
  ('RF-OE-08','Matanza Sur','Oeste','fijo','#2563eb',true),
  ('RF-OE-09','Merlo / Marcos Paz','Oeste','fijo','#2563eb',true),
  ('RF-OE-10','Moreno','Oeste','fijo','#2563eb',true),
  ('RF-OE-11','Lujan / General Rodriguez','Oeste','fijo','#2563eb',true),
  -- Sur
  ('RF-SU-01','Avellaneda','Sur','fijo','#059669',true),
  ('RF-SU-02','Lanus','Sur','fijo','#059669',true),
  ('RF-SU-03','Lomas de Zamora','Sur','fijo','#059669',true),
  ('RF-SU-04','Quilmes','Sur','fijo','#059669',true),
  ('RF-SU-05','Berazategui','Sur','fijo','#059669',true),
  ('RF-SU-06','Florencio Varela','Sur','fijo','#059669',true),
  ('RF-SU-07','Almirante Brown','Sur','fijo','#059669',true),
  ('RF-SU-08','Esteban Echeverria / Ezeiza','Sur','fijo','#059669',true),
  ('RF-SU-09','La Plata Norte','Sur','fijo','#059669',true),
  ('RF-SU-10','La Plata Sur','Sur','fijo','#059669',true),
  ('RF-SU-11','Canuelas / San Vicente','Sur','fijo','#059669',true),
  -- Pre turnos
  ('PT-CA-01','Pre Turno - Microcentro','CABA','pre_turno','#7c3aed',true),
  ('PT-CA-02','Pre Turno - Zona Norte CABA','CABA','pre_turno','#7c3aed',true),
  ('PT-NO-01','Pre Turno - Vicente Lopez','Norte','pre_turno','#7c3aed',true),
  ('PT-NO-02','Pre Turno - San Martin','Norte','pre_turno','#7c3aed',true),
  ('PT-OE-01','Pre Turno - Tres de Febrero','Oeste','pre_turno','#7c3aed',true),
  ('PT-OE-02','Pre Turno - Matanza','Oeste','pre_turno','#7c3aed',true),
  ('PT-SU-01','Pre Turno - Avellaneda','Sur','pre_turno','#7c3aed',true),
  ('PT-SU-02','Pre Turno - Lomas','Sur','pre_turno','#7c3aed',true),
  -- Cortes
  ('CE-CA-01','Corte - Palermo','CABA','corte','#ea580c',true),
  ('CE-NO-01','Corte - Tigre / Nordelta','Norte','corte','#ea580c',true),
  ('CE-OE-01','Corte - Matanza Sur','Oeste','corte','#ea580c',true),
  ('CE-SU-01','Corte - La Plata','Sur','corte','#ea580c',true),
  ('CE-SU-02','Corte - Quilmes / Bernal','Sur','corte','#ea580c',true),
  -- Comodines
  ('SU-CA-01','Comodin CABA','CABA','suplencia','#6b7280',true),
  ('SU-NO-01','Comodin Norte','Norte','suplencia','#6b7280',true),
  ('SU-OE-01','Comodin Oeste','Oeste','suplencia','#6b7280',true),
  ('SU-SU-01','Comodin Sur','Sur','suplencia','#6b7280',true);

-- ── Choferes ────────────────────────────────────────────────
-- Nombres inventados; cualquier coincidencia con alguien real es azar.
insert into conductores (nombre) values
  ('Adrian Robledo'),('Alejo Miranda'),('Ariel Cabezas'),('Bruno Salgado'),
  ('Camilo Ferreyra'),('Cesar Peralta'),('Cristian Bordon'),('Damian Otero'),
  ('Daniel Quiroga'),('Diego Almada'),('Eduardo Lencina'),('Emiliano Prado'),
  ('Enzo Villalba'),('Ezequiel Maidana'),('Fabian Ceballos'),('Federico Anaya'),
  ('Fernando Basualdo'),('Franco Ledesma'),('Gabriel Ocampo'),('German Riquelme'),
  ('Gonzalo Barrios'),('Gustavo Alegre'),('Hernan Palavecino'),('Ignacio Duarte'),
  ('Ivan Sarmiento'),('Javier Coronel'),('Joaquin Bustos'),('Jonathan Vergara'),
  ('Jorge Arrieta'),('Julian Cardozo'),('Kevin Monzon'),('Leandro Zarate'),
  ('Lucas Ibarra'),('Luis Chaparro'),('Marcelo Aguirre'),('Marcos Villagra'),
  ('Mariano Escalante'),('Martin Bogado'),('Matias Farias'),('Maximiliano Rios'),
  ('Nahuel Godoy'),('Nestor Cabral'),('Nicolas Ayala'),('Omar Benitez'),
  ('Pablo Zalazar'),('Patricio Nieva'),('Rafael Ocanto'),('Ramiro Sandoval'),
  ('Raul Encina'),('Ricardo Toledo'),('Roberto Vallejos'),('Rodrigo Amarilla'),
  ('Sebastian Rolon'),('Sergio Lugo'),('Thiago Meza'),('Tomas Bianchi'),
  ('Valentin Ojeda'),('Victor Insaurralde'),('Walter Gimenez'),('Yamil Acosta');

-- ── Piso de recorridos por tipo de dia ──────────────────────
-- Lunes y feriados mueven mas volumen (se acumula el fin de semana),
-- asi que sale la flota completa. El sabado es la mitad.
insert into plantilla_operacion (tipo_dia, recorrido_id)
select 'lun_feriado', id from recorridos where tipo in ('fijo','pre_turno','corte');

insert into plantilla_operacion (tipo_dia, recorrido_id)
select 'mar_vie', id from recorridos
where tipo = 'fijo'
   or (tipo = 'pre_turno' and codigo in ('PT-CA-01','PT-NO-01','PT-OE-01','PT-SU-01'))
   or codigo in ('CE-SU-01');

insert into plantilla_operacion (tipo_dia, recorrido_id)
select 'sabado', id from recorridos
where tipo = 'fijo'
  and codigo not in ('RF-CA-09','RF-CA-10','RF-NO-01','RF-OE-11','RF-SU-11');

-- ── Condiciones especiales de clientes ──────────────────────
insert into condiciones_especiales (cliente, condicion, observacion_adicional) values
  ('Bazar Trenque','Entregar solo por la manana','El local abre de 9 a 13'),
  ('Farmacia Sur','No dejar en porteria','Requiere firma del encargado'),
  ('Mundo Mascotas','Llamar antes de llegar',null),
  ('Optica Central','Producto fragil','Bultos chicos, no apilar');

commit;

-- Control rapido de lo generado
select
  (select count(*) from recorridos) as recorridos,
  (select count(*) from conductores) as choferes,
  (select count(*) from plantilla_operacion where tipo_dia='lun_feriado') as piso_lunes,
  (select count(*) from plantilla_operacion where tipo_dia='mar_vie') as piso_martes_viernes,
  (select count(*) from plantilla_operacion where tipo_dia='sabado') as piso_sabado;
