-- Integridad de pagos, saldos y aislamiento entre espacios.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a-deudas@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b-deudas@test.local');
insert into public.espacio (id, nombre, owner_user_id) values
  ('e0000000-0000-0000-0000-00000000000a', 'Espacio A', '00000000-0000-0000-0000-00000000000a'),
  ('e0000000-0000-0000-0000-00000000000b', 'Espacio B', '00000000-0000-0000-0000-00000000000b');
insert into public.espacio_miembro (espacio_id, user_id) values
  ('e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('e0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');
insert into public.deuda (id, espacio_id, direccion, contraparte, monto_inicial, saldo_pendiente) values
  ('d0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a', 'yo_debo', 'A', 100, 100),
  ('d0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000b', 'yo_debo', 'B', 100, 100);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.pago (espacio_id, deuda_id, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 25, '2026-01-01T12:00:00Z')$$,
  'El pago referencia una deuda del mismo espacio'
);
select throws_ok(
  $$insert into public.pago (espacio_id, deuda_id, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000b', 25, '2026-01-01T12:00:00Z')$$,
  '23514', null, 'El pago no puede referenciar deuda de otro espacio'
);
select throws_ok(
  $$insert into public.pago (espacio_id, deuda_id, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a', 0, '2026-01-01T12:00:00Z')$$,
  '23514', null, 'El monto del pago debe ser positivo'
);
select throws_ok(
  $$insert into public.deuda (espacio_id, direccion, contraparte, monto_inicial, saldo_pendiente)
    values ('e0000000-0000-0000-0000-00000000000a', 'yo_debo', 'Inválida', 10, 11)$$,
  '23514', null, 'El saldo pendiente no puede superar el monto inicial'
);

select * from finish();
rollback;
