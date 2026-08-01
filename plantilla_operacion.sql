-- ============================================================
-- RutaMap — Piso de recorridos por tipo de dia
-- ============================================================
-- Es lo que activan los botones "Lunes / Feriado", "Martes a Viernes"
-- y "Sabado" en Operacion del Dia: aplicar_plantilla_operacion() marca
-- activo=true a los recorridos listados aca para ese tipo de dia, y
-- activo=false a todo el resto.
--
-- Origen: ESQUEMA_RECORRIDOS (hojas LUNESYFERIADOS / MARTESVIERNES /
-- SABADOS). Totales: 73 / 55 / 47.
--
-- Salvedad del origen: en MARTESVIERNES el codigo PT-NO-01 figura dos
-- veces, la segunda con el nombre "Pre Turno - San Martin / 3 de
-- Febrero", que en la base corresponde a PT-NO-02. Se carga como
-- PT-NO-02: da el total de 55 que declara la propia hoja y coincide
-- con lo que ya tenia la plantilla.
--
-- Reemplaza la plantilla completa. Idempotente.
-- ============================================================

begin;

create temp table _piso(tipo_dia text, codigo text) on commit drop;

insert into _piso(tipo_dia, codigo) values
('lun_feriado','CE-CA-03'),
('lun_feriado','CE-CA-04'),
('lun_feriado','CE-NO-01'),
('lun_feriado','CE-NO-05'),
('lun_feriado','CE-OE-01'),
('lun_feriado','CE-OE-02'),
('lun_feriado','CE-SU-01'),
('lun_feriado','CE-SU-02'),
('lun_feriado','CE-SU-03'),
('lun_feriado','PT-CA-04'),
('lun_feriado','PT-CA-06'),
('lun_feriado','PT-CA-07'),
('lun_feriado','PT-NO-01'),
('lun_feriado','PT-NO-06'),
('lun_feriado','PT-OE-04'),
('lun_feriado','PT-OE-06'),
('lun_feriado','PT-SU-01'),
('lun_feriado','PT-SU-02'),
('lun_feriado','PT-SU-04'),
('lun_feriado','PT-SU-05'),
('lun_feriado','RF-CA-01'),
('lun_feriado','RF-CA-02'),
('lun_feriado','RF-CA-03'),
('lun_feriado','RF-CA-04'),
('lun_feriado','RF-CA-05'),
('lun_feriado','RF-CA-06'),
('lun_feriado','RF-CA-07'),
('lun_feriado','RF-CA-08'),
('lun_feriado','RF-CA-09'),
('lun_feriado','RF-CA-10'),
('lun_feriado','RF-CA-11'),
('lun_feriado','RF-CA-12'),
('lun_feriado','RF-NO-01'),
('lun_feriado','RF-NO-02'),
('lun_feriado','RF-NO-03'),
('lun_feriado','RF-NO-04'),
('lun_feriado','RF-NO-05'),
('lun_feriado','RF-NO-06'),
('lun_feriado','RF-NO-07'),
('lun_feriado','RF-NO-08'),
('lun_feriado','RF-NO-09'),
('lun_feriado','RF-NO-10'),
('lun_feriado','RF-NO-11'),
('lun_feriado','RF-NO-12'),
('lun_feriado','RF-NO-13'),
('lun_feriado','RF-OE-01'),
('lun_feriado','RF-OE-02'),
('lun_feriado','RF-OE-03'),
('lun_feriado','RF-OE-04'),
('lun_feriado','RF-OE-05'),
('lun_feriado','RF-OE-06'),
('lun_feriado','RF-OE-07'),
('lun_feriado','RF-OE-08'),
('lun_feriado','RF-OE-09'),
('lun_feriado','RF-OE-10'),
('lun_feriado','RF-OE-11'),
('lun_feriado','RF-OE-12'),
('lun_feriado','RF-OE-13'),
('lun_feriado','RF-OE-14'),
('lun_feriado','RF-SU-01'),
('lun_feriado','RF-SU-02'),
('lun_feriado','RF-SU-03'),
('lun_feriado','RF-SU-04'),
('lun_feriado','RF-SU-05'),
('lun_feriado','RF-SU-06'),
('lun_feriado','RF-SU-07'),
('lun_feriado','RF-SU-08'),
('lun_feriado','RF-SU-09'),
('lun_feriado','RF-SU-10'),
('lun_feriado','RF-SU-11'),
('lun_feriado','RF-SU-12'),
('lun_feriado','RF-SU-13'),
('lun_feriado','RF-SU-14'),
('mar_vie','CE-CA-03'),
('mar_vie','CE-SU-02'),
('mar_vie','PT-NO-01'),
('mar_vie','PT-NO-02'),
('mar_vie','PT-OE-04'),
('mar_vie','PT-OE-06'),
('mar_vie','RF-CA-01'),
('mar_vie','RF-CA-02'),
('mar_vie','RF-CA-03'),
('mar_vie','RF-CA-04'),
('mar_vie','RF-CA-05'),
('mar_vie','RF-CA-06'),
('mar_vie','RF-CA-08'),
('mar_vie','RF-CA-09'),
('mar_vie','RF-CA-10'),
('mar_vie','RF-CA-11'),
('mar_vie','RF-CA-12'),
('mar_vie','RF-NO-02'),
('mar_vie','RF-NO-03'),
('mar_vie','RF-NO-04'),
('mar_vie','RF-NO-05'),
('mar_vie','RF-NO-06'),
('mar_vie','RF-NO-07'),
('mar_vie','RF-NO-08'),
('mar_vie','RF-NO-09'),
('mar_vie','RF-NO-10'),
('mar_vie','RF-NO-11'),
('mar_vie','RF-NO-12'),
('mar_vie','RF-NO-13'),
('mar_vie','RF-OE-01'),
('mar_vie','RF-OE-02'),
('mar_vie','RF-OE-03'),
('mar_vie','RF-OE-04'),
('mar_vie','RF-OE-05'),
('mar_vie','RF-OE-06'),
('mar_vie','RF-OE-07'),
('mar_vie','RF-OE-08'),
('mar_vie','RF-OE-09'),
('mar_vie','RF-OE-11'),
('mar_vie','RF-OE-12'),
('mar_vie','RF-OE-13'),
('mar_vie','RF-SU-01'),
('mar_vie','RF-SU-02'),
('mar_vie','RF-SU-03'),
('mar_vie','RF-SU-04'),
('mar_vie','RF-SU-06'),
('mar_vie','RF-SU-07'),
('mar_vie','RF-SU-08'),
('mar_vie','RF-SU-09'),
('mar_vie','RF-SU-10'),
('mar_vie','RF-SU-11'),
('mar_vie','RF-SU-12'),
('mar_vie','RF-SU-13'),
('mar_vie','RF-SU-14'),
('mar_vie','UN-OE-06'),
('sabado','CE-CA-03'),
('sabado','RF-CA-01'),
('sabado','RF-CA-02'),
('sabado','RF-CA-03'),
('sabado','RF-CA-04'),
('sabado','RF-CA-05'),
('sabado','RF-CA-06'),
('sabado','RF-CA-08'),
('sabado','RF-CA-10'),
('sabado','RF-CA-12'),
('sabado','RF-NO-01'),
('sabado','RF-NO-03'),
('sabado','RF-NO-04'),
('sabado','RF-NO-05'),
('sabado','RF-NO-06'),
('sabado','RF-NO-07'),
('sabado','RF-NO-09'),
('sabado','RF-NO-10'),
('sabado','RF-NO-11'),
('sabado','RF-NO-12'),
('sabado','RF-NO-13'),
('sabado','RF-OE-01'),
('sabado','RF-OE-02'),
('sabado','RF-OE-03'),
('sabado','RF-OE-04'),
('sabado','RF-OE-05'),
('sabado','RF-OE-06'),
('sabado','RF-OE-07'),
('sabado','RF-OE-08'),
('sabado','RF-OE-09'),
('sabado','RF-OE-10'),
('sabado','RF-OE-11'),
('sabado','RF-OE-12'),
('sabado','RF-OE-13'),
('sabado','RF-SU-01'),
('sabado','RF-SU-02'),
('sabado','RF-SU-03'),
('sabado','RF-SU-04'),
('sabado','RF-SU-06'),
('sabado','RF-SU-07'),
('sabado','RF-SU-08'),
('sabado','RF-SU-09'),
('sabado','RF-SU-10'),
('sabado','RF-SU-11'),
('sabado','RF-SU-12'),
('sabado','RF-SU-13'),
('sabado','RF-SU-14');

-- Corta si algun codigo no existe entre los recorridos, en vez de dejar
-- una plantilla incompleta en silencio.
do $$
declare faltan text;
begin
  select string_agg(distinct p.codigo, ', ') into faltan
  from _piso p left join recorridos r on r.codigo = p.codigo
  where r.id is null;
  if faltan is not null then
    raise exception 'Codigos que no existen en recorridos: %', faltan;
  end if;
end $$;

delete from plantilla_operacion;

insert into plantilla_operacion (tipo_dia, recorrido_id)
select p.tipo_dia, r.id
from _piso p
join recorridos r on r.codigo = p.codigo;

commit;
