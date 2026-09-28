-- Refuerza el invariante documentado en el comentario de la columna
-- pagos.tasa_cambio ("Obligatoria cuando moneda = VES; siempre null cuando
-- moneda = USD"): el constraint original de 20260927000002 solo obligaba
-- la mitad VES-requiere-tasa (moneda = 'USD' or tasa_cambio is not null),
-- así que nada impedía un INSERT/UPDATE con moneda = 'USD' y tasa_cambio no
-- nulo, violando en silencio el invariante que la lógica de reportes
-- USD/VES de una fase futura asumirá (WR-04, code review de Fase 1).

alter table public.pagos
  drop constraint pagos_tasa_cambio_obligatoria_en_bs;

alter table public.pagos
  add constraint pagos_tasa_cambio_solo_en_bs
    check (
      (moneda = 'VES' and tasa_cambio is not null)
      or (moneda = 'USD' and tasa_cambio is null)
    );
