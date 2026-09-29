-- pagador/viajero en cada reserva (D-01 a D-04): a partir de ahora el admin
-- puede registrar una venta para un cliente que todavía no tiene cuenta,
-- escribiendo directamente los datos de contacto de quien paga (y, si
-- corresponde, de quien viaja) dentro de la propia reserva.
--
-- Puerta de un solo sentido (rated one-way en 02-CONTEXT.md): una vez que
-- existan reservas reales guardadas con esta forma, cambiarla exige una
-- migración de datos coordinada con las Fases 3 y 4. Decisión del dueño del
-- negocio, opción A: los datos de contacto viven en la reserva; el vínculo
-- con una cuenta de cliente (cliente_id) queda opcional para cuando la
-- Fase 3 cree cuentas -- eso permitirá más adelante que un pagador vea
-- también las reservas de sus familiares. Teléfono del viajero obligatorio
-- cuando "es para otra persona" (D-04, confirmado por el dueño).
--
-- Esta migración es puramente aditiva: nada se elimina ni se renombra, y las
-- políticas RLS y GRANTs existentes de reservas quedan sin cambios --
-- el GRANT de tabla ya cubre las columnas nuevas, y la política del cliente
-- ("reservas: el cliente ve las suyas", using (select auth.uid()) = cliente_id)
-- nunca es verdadera cuando cliente_id es NULL, así que una reserva sin
-- cuenta queda invisible para clientes sin necesidad de tocar la política.

alter table public.reservas
  alter column cliente_id drop not null;

comment on column public.reservas.cliente_id is
  'Vínculo opcional con una cuenta de cliente (Fase 3). NULL es el caso normal en el MVP: los datos de contacto de quien paga siempre viven en las columnas pagador_*, sin depender de que exista una cuenta.';

alter table public.reservas
  add column pagador_nombre text,
  add column pagador_telefono text,
  add column pagador_email text,
  add column viajero_nombre text,
  add column viajero_telefono text;

-- Backfill de filas preexistentes (todas de la era Fase 1, con cliente_id no
-- nulo) a partir del perfil real vinculado. Nunca se inventa un valor de
-- relleno: si a una fila le falta el teléfono en su perfil, el paso e) de
-- abajo hace fallar la migración completa (rollback atómico) en vez de
-- escribir un dato inventado.
update public.reservas r
set
  pagador_nombre = coalesce(nullif(btrim(p.nombre), ''), p.email),
  pagador_telefono = nullif(btrim(p.telefono), ''),
  pagador_email = p.email
from public.profiles p
where p.id = r.cliente_id
  and r.pagador_nombre is null;

alter table public.reservas
  alter column pagador_nombre set not null,
  alter column pagador_telefono set not null;

alter table public.reservas
  add constraint reservas_pagador_nombre_no_vacio
    check (btrim(pagador_nombre) <> ''),
  add constraint reservas_pagador_telefono_no_vacio
    check (btrim(pagador_telefono) <> ''),
  add constraint reservas_viajero_nombre_no_vacio
    check (viajero_nombre is null or btrim(viajero_nombre) <> ''),
  add constraint reservas_viajero_telefono_requiere_nombre
    check (viajero_telefono is null or viajero_nombre is not null),
  add constraint reservas_nota_problema_si_con_problema
    check (
      estado_proveedor <> 'con_problema'
      or (nota_problema is not null and btrim(nota_problema) <> '')
    ),
  add constraint reservas_detalle_es_objeto
    check (jsonb_typeof(detalle) = 'object'),
  add constraint reservas_detalle_tamano
    check (pg_column_size(detalle) <= 16384),
  add constraint reservas_detalle_tipo_coincide
    check (detalle ->> 'tipo' is null or detalle ->> 'tipo' = tipo);

create index reservas_created_at_idx on public.reservas (created_at desc);

comment on column public.reservas.pagador_nombre is
  'Nombre de quien paga la reserva. Obligatorio siempre, exista o no una cuenta de cliente vinculada (D-01, D-04). Nunca se pide documento de identidad.';
comment on column public.reservas.pagador_telefono is
  'Teléfono de quien paga. Obligatorio junto con pagador_nombre -- el mínimo de datos para una persona sin cuenta (D-04).';
comment on column public.reservas.pagador_email is
  'Correo de quien paga. Opcional (D-04): muchos clientes reservan hoy solo por WhatsApp, sin correo.';
comment on column public.reservas.viajero_nombre is
  'Nombre de quien viaja, solo cuando es distinto de quien paga ("es para otra persona", D-02). NULL cuando el pagador también viaja.';
comment on column public.reservas.viajero_telefono is
  'Teléfono de quien viaja. Solo tiene sentido junto con viajero_nombre (ver reservas_viajero_telefono_requiere_nombre); la obligatoriedad exacta cuando hay viajero distinto la aplica la validación de la aplicación (D-04), no esta columna.';
