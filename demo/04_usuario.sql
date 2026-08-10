-- ============================================================
-- Demo · 4 de 4: usuario para entrar
-- ============================================================
-- Crea la cuenta con la que se muestra el demo. La contrasena se guarda
-- con el mismo cifrado que usa Supabase, asi que sirve para entrar desde
-- la pantalla de login normal.
--
--   usuario:     demo@rutamap.app
--   contrasena:  demo1234
--
-- Se le da rol maestro para que se vean todas las solapas sin tener que
-- configurar permisos.
--
-- Idempotente: si el usuario ya existe, no lo duplica.
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'demo@rutamap.app', extensions.crypt('demo1234', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Usuario Demo"}'::jsonb, false, false
where not exists (select 1 from auth.users where email = 'demo@rutamap.app');

-- El servicio de autenticacion lee estas columnas como texto y devuelve
-- "Database error querying schema" si estan en null. Al crear un usuario a
-- mano hay que dejarlas en cadena vacia; por la interfaz de Supabase esto
-- lo resuelve el propio servicio.
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email = 'demo@rutamap.app';

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email = 'demo@rutamap.app'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into perfiles (id, nombre, rol)
select u.id, 'Usuario Demo', 'maestro' from auth.users u where u.email = 'demo@rutamap.app'
on conflict (id) do update set rol = 'maestro', nombre = 'Usuario Demo';

select u.email, p.rol from auth.users u join perfiles p on p.id = u.id;
