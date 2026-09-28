-- Reservas, pagos y recordatorios + RLS + GRANTs, en el mismo archivo que
-- crea cada tabla (Pitfall 5 de la investigación: RLS nunca se agrega
-- "después" — se habilita en la misma migración que crea la tabla).
--
-- Este proyecto de Supabase tiene "Automatically expose new tables"
-- DESACTIVADO en Data API, así que -- igual que en
-- 20260927000001_perfiles_y_rol_admin.sql -- cada tabla necesita su propio
-- GRANT explícito además de RLS; sin el GRANT, PostgREST devuelve
-- "permission denied for table <tabla>" (42501) sin importar qué tan
-- correctas sean las políticas.

-- private.set_updated_at(): trigger genérico que mantiene updated_at al
-- momento de cada UPDATE. Vive en el schema private (no expuesto por la
-- Data API), igual que private.is_admin().
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

-- Tabla public.reservas: una reserva de un cliente (pasaje, hotel, tour o
-- entrada). El precio y la moneda viven juntos en la reserva (RESA-01);
-- USD es la moneda por defecto y canónica del negocio (PITFALLS Pitfall 3),
-- y esto reemplaza deliberadamente la columna precio_usd de RESEARCH.md por
-- precio + moneda, para permitir cotizar también en bolívares si hiciera
-- falta más adelante sin perder el default USD.
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles (id) on delete restrict,
  tipo text not null check (tipo in ('pasaje', 'hotel', 'tour', 'entrada')),
  detalle jsonb not null default '{}'::jsonb,
  precio numeric(12, 2) not null check (precio >= 0),
  moneda text not null default 'USD' check (moneda in ('USD','VES')),
  estado_proveedor text not null default 'pendiente'
    check (estado_proveedor in ('pendiente', 'confirmada', 'con_problema')),
  nota_problema text,
  fecha_importante date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reservas enable row level security;

grant select, insert, update, delete on public.reservas to authenticated;

create index reservas_cliente_id_idx on public.reservas using btree (cliente_id);

create trigger reservas_set_updated_at
before update on public.reservas
for each row execute function private.set_updated_at();

comment on table public.reservas is
  'Una reserva (pasaje, hotel, tour o entrada) de un cliente. estado_proveedor es independiente del estado de pago (RESA-04): una reserva puede estar pagada y aun así pendiente con el proveedor, o viceversa.';
comment on column public.reservas.precio is
  'Precio de la reserva en la moneda indicada por la columna moneda. Nunca se guarda un total ya convertido — cada pago mantiene su propia moneda y tasa (ver public.pagos).';
comment on column public.reservas.moneda is
  'USD es el default y la moneda canónica del negocio. VES (bolívares) existe para cotizar reservas puntuales en bolívares, pero el dólar sigue siendo la referencia estable.';

create policy "reservas: el cliente ve las suyas"
on public.reservas
for select
to authenticated
using ( (select auth.uid()) = cliente_id );

create policy "reservas: el admin gestiona todas"
on public.reservas
for all
to authenticated
using ( (select private.is_admin()) )
with check ( (select private.is_admin()) );

-- Tabla public.pagos: cada pago es su propia fila (nunca un total
-- colapsado), con moneda y, si es en bolívares, la tasa de cambio obligatoria
-- (PITFALLS Pitfall 3). on delete restrict en reserva_id: una reserva con
-- pagos nunca se puede borrar silenciosamente (reemplaza deliberadamente el
-- "on delete cascade" de RESEARCH.md, porque un registro financiero no debe
-- desaparecer solo porque se borró la reserva).
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id) on delete restrict,
  monto numeric(12, 2) not null check (monto > 0),
  moneda text not null check (moneda in ('USD','VES')),
  tasa_cambio numeric(14, 4) check (tasa_cambio is null or tasa_cambio > 0),
  metodo text not null check (metodo in ('efectivo', 'zelle', 'binance', 'payoneer')),
  comprobante_path text,
  payment_link_url text,
  referencia text,
  estado text not null default 'pendiente_revision'
    check (estado in ('pendiente_revision', 'confirmado')),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint pagos_tasa_cambio_obligatoria_en_bs
    check (moneda = 'USD' or tasa_cambio is not null)
);

alter table public.pagos enable row level security;

grant select, insert, update, delete on public.pagos to authenticated;

create index pagos_reserva_id_idx on public.pagos using btree (reserva_id);

comment on table public.pagos is
  'Un pago (parcial o total) de una reserva. Cada pago guarda su propio método, monto y moneda; nunca se colapsan varios pagos en un solo total (PITFALLS Pitfall 3).';
comment on column public.pagos.moneda is
  'USD o VES. Si es VES, tasa_cambio es obligatoria (ver el check pagos_tasa_cambio_obligatoria_en_bs) para poder reconstruir el equivalente en USD después.';
comment on column public.pagos.tasa_cambio is
  'Tasa de cambio Bs/USD usada para este pago puntual, tecleada por el admin al momento del pago (no se integra una API de tasa en vivo — PITFALLS). Obligatoria cuando moneda = VES; siempre null cuando moneda = USD.';
comment on column public.pagos.comprobante_path is
  'Ruta dentro del bucket privado comprobantes (nunca una URL pública). Se resuelve a una URL firmada de corta duración al momento de mostrarla.';

create policy "pagos: el cliente ve los de sus reservas"
on public.pagos
for select
to authenticated
using (
  exists (
    select 1
    from public.reservas r
    where r.id = pagos.reserva_id
      and r.cliente_id = (select auth.uid())
  )
);

create policy "pagos: el admin gestiona todos"
on public.pagos
for all
to authenticated
using ( (select private.is_admin()) )
with check ( (select private.is_admin()) );

-- Tabla public.recordatorios: cola interna de envíos (recordatorio de fecha
-- importante, o aviso de cambio). Nadie más que el admin puede leerla o
-- escribirla -- es una cola de envío interna, no una vista para el cliente;
-- el cliente se entera por correo cuando el envío realmente ocurre (Fase 5),
-- así que no hace falta una política de lectura para clientes (a diferencia
-- de RESEARCH.md, que sí proponía una).
create table public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id) on delete cascade,
  tipo text not null check (tipo in ('recordatorio', 'aviso_cambio')),
  fecha_envio_programada timestamptz not null,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.recordatorios enable row level security;

grant select, insert, update, delete on public.recordatorios to authenticated;

create index recordatorios_reserva_id_idx on public.recordatorios using btree (reserva_id);

comment on table public.recordatorios is
  'Cola interna de envíos programados (recordatorio antes de una fecha importante, o aviso de cambio en la reserva). Solo el admin la ve o la escribe; el cliente se entera por correo cuando el envío ocurre (Fase 5), no leyendo esta tabla.';

create policy "recordatorios: solo el admin"
on public.recordatorios
for all
to authenticated
using ( (select private.is_admin()) )
with check ( (select private.is_admin()) );
-- fin recordatorios
