-- Esta función SECURITY DEFINER lee auth.users.invited_at / email_confirmed_at
-- únicamente para el admin. Es la alternativa a usar el cliente de servicio
-- (SUPABASE_SECRET_KEY), que 03-03 confinó a un solo archivo y un solo
-- importador (Open Question 2 de 03-RESEARCH.md, Pitfall 3): así el secreto
-- no se toca para pintar la insignia de "invitación pendiente".
-- Es aditiva y reversible con un simple:
--   drop function public.clientes_estado_invitacion(uuid[]);
create function public.clientes_estado_invitacion(ids uuid[])
returns table (id uuid, invitado_en timestamptz, confirmado_en timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
    select u.id, u.invited_at, u.email_confirmed_at
    from auth.users u
    where u.id = any(ids);
end;
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto en toda función nueva; sin este
-- revoke explícito cualquier rol anónimo podría invocarla (mismo motivo que
-- private.is_admin() en la migración de Fase 1).
revoke execute on function public.clientes_estado_invitacion(uuid[]) from public, anon;
grant execute on function public.clientes_estado_invitacion(uuid[]) to authenticated;

comment on function public.clientes_estado_invitacion(uuid[]) is
  'Estado de invitación (invited_at/email_confirmed_at) por cliente; solo admin. Único consumidor permitido: lib/clientes/listar.ts.';
