-- Perfiles (profiles) + rol admin/customer + private.is_admin() + trigger de alta.
--
-- Este proyecto de Supabase tiene "Automatically expose new tables" DESACTIVADO
-- en Data API, así que nada en el schema public es alcanzable vía PostgREST sin
-- un GRANT explícito, sin importar qué tan correctas sean las políticas de RLS
-- de abajo. Por eso este archivo otorga USAGE sobre los schemas y GRANTs
-- explícitos sobre la tabla, en vez de asumir el comportamiento por defecto de
-- un proyecto nuevo.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

grant usage on schema public to authenticated;

-- Tabla public.profiles: una fila por cada auth.users, creada automáticamente
-- por el trigger de abajo (nunca insertada a mano desde la app).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  nombre text,
  telefono text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Con el auto-expose de tablas apagado, PostgREST devuelve "permission denied
-- for table profiles" (42501) para cualquier request sin este GRANT, sin
-- importar las políticas de RLS: RLS acota lo que un privilegio ya otorgado
-- puede tocar, no sustituye al GRANT. ("Enable automatic RLS" sí está activado
-- en este proyecto, por lo que el "enable row level security" de arriba es
-- redundante con el default actual — se deja igual para que el archivo sea
-- correcto y autocontenido incluso contra un proyecto futuro sin ese default.)
grant select, insert, update, delete on public.profiles to authenticated;

comment on table public.profiles is
  'Un perfil por usuario de Supabase Auth. role determina si es admin (el único operador del negocio) o customer (un cliente). Se crea automáticamente por el trigger on_auth_user_created; nunca se inserta a mano.';

-- private.is_admin(): SECURITY DEFINER para evitar la recursión de RLS que
-- ocurre si una política sobre profiles vuelve a consultar profiles
-- directamente (error 42P17). Vive en el schema private, que no está
-- expuesto por la Data API, así que no puede invocarse desde afuera.
create function private.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
end;
$$;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Cada usuario lee su propia fila; el admin lee todas.
create policy "perfiles: cada usuario lee el suyo y el admin todos"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or (select private.is_admin())
);

-- Solo el admin puede insertar/actualizar/eliminar filas de profiles. Ningún
-- cliente puede escribir su propia fila (y por lo tanto nunca puede
-- auto-promoverse a admin).
create policy "perfiles: solo el admin escribe"
on public.profiles
for all
to authenticated
using ( (select private.is_admin()) )
with check ( (select private.is_admin()) );

-- private.handle_new_user(): crea la fila de profiles al momento del alta en
-- auth.users. Nunca lee un rol desde los metadatos del usuario — role siempre
-- toma el default de la columna ('customer'), para que un usuario no pueda
-- auto-promoverse pasando { role: 'admin' } en user_metadata al registrarse.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nombre',
    new.email
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
