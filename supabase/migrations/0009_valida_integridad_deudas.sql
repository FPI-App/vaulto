-- Mantiene los montos coherentes y evita puentes de pago entre espacios.
-- Constraints NOT VALID no inspeccionan el histórico, pero sí toda escritura nueva.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deuda_montos_coherentes') then
    alter table public.deuda add constraint deuda_montos_coherentes
      check (monto_inicial > 0 and saldo_pendiente >= 0 and saldo_pendiente <= monto_inicial) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pago_monto_positivo') then
    alter table public.pago add constraint pago_monto_positivo check (monto > 0) not valid;
  end if;
end;
$$;

create or replace function public.validar_espacio_de_pago()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.deuda d
    where d.id = new.deuda_id and d.espacio_id = new.espacio_id
  ) then
    raise exception 'La deuda debe pertenecer al mismo espacio del pago'
      using errcode = '23514', constraint = 'pago_deuda_mismo_espacio';
  end if;

  if new.movimiento_id is not null and not exists (
    select 1 from public.movimiento m
    where m.id = new.movimiento_id and m.espacio_id = new.espacio_id
  ) then
    raise exception 'El movimiento debe pertenecer al mismo espacio del pago'
      using errcode = '23514', constraint = 'pago_movimiento_mismo_espacio';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_espacio_de_pago on public.pago;
create trigger validar_espacio_de_pago
  before insert or update of deuda_id, espacio_id, movimiento_id
  on public.pago
  for each row execute function public.validar_espacio_de_pago();
