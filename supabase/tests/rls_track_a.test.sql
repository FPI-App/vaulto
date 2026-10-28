-- Aislamiento por espacio de las tablas de Track A (cuenta, categoria, movimiento).
-- Corre con: supabase test db
--
-- Dos usuarios, cada uno dueño de su espacio. El usuario A no debe poder leer,
-- escribir ni referenciar filas del espacio de B, y nadie puede borrar físicamente.
begin;
select plan(17);
select set_config('vaulto.sync_protocol', '1', true);

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sin RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

insert into public.espacio (id, nombre, owner_user_id) values
  ('e0000000-0000-0000-0000-00000000000a', 'Espacio A', '00000000-0000-0000-0000-00000000000a'),
  ('e0000000-0000-0000-0000-00000000000b', 'Espacio B', '00000000-0000-0000-0000-00000000000b');

insert into public.espacio_miembro (espacio_id, user_id) values
  ('e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('e0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');

insert into public.cuenta (id, espacio_id, nombre, tipo, saldo_inicial) values
  ('c0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-00000000000b', 'Cuenta B', 'banco', 1000);

insert into public.categoria (id, espacio_id, nombre, tipo) values
  ('ca000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-00000000000b', 'Mercado B', 'egreso');

insert into public.movimiento (espacio_id, cuenta_id, categoria_id, tipo, monto, fecha) values
  ('e0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-0000000000b1',
   'ca000000-0000-0000-0000-0000000000b1', 'egreso', 50, now());

-- ---------------------------------------------------------------------------
-- Como usuario A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.cuenta (id, espacio_id, nombre, tipo) values
    ('c0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-00000000000a', 'Cuenta A', 'efectivo')$$,
  'A crea cuenta en su espacio'
);
select lives_ok(
  $$insert into public.categoria (id, espacio_id, nombre, tipo) values
    ('ca000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-00000000000a', 'Sueldo', 'ingreso')$$,
  'A crea categoría en su espacio'
);
select lives_ok(
  $$insert into public.movimiento (espacio_id, cuenta_id, categoria_id, tipo, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a1',
     'ca000000-0000-0000-0000-0000000000a1', 'ingreso', 100, now())$$,
  'A registra movimiento en su espacio'
);

select is((select count(*) from public.cuenta)::int, 1, 'A solo ve sus cuentas');
select is((select count(*) from public.categoria)::int, 1, 'A solo ve sus categorías');
select is((select count(*) from public.movimiento)::int, 1, 'A solo ve sus movimientos');

select throws_ok(
  $$insert into public.cuenta (espacio_id, nombre, tipo) values
    ('e0000000-0000-0000-0000-00000000000b', 'Intrusa', 'banco')$$,
  '42501', null, 'A no crea cuentas en el espacio de B'
);
select throws_ok(
  $$insert into public.categoria (espacio_id, nombre, tipo) values
    ('e0000000-0000-0000-0000-00000000000b', 'Intrusa', 'egreso')$$,
  '42501', null, 'A no crea categorías en el espacio de B'
);
select throws_ok(
  $$insert into public.movimiento (espacio_id, cuenta_id, tipo, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-0000000000b1', 'egreso', 1, now())$$,
  '42501', null, 'A no crea movimientos en el espacio de B'
);

-- Las FKs no pasan por RLS: sin la 0006 esto entraba y alteraba el saldo de B.
select throws_ok(
  $$insert into public.movimiento (espacio_id, cuenta_id, cuenta_destino_id, tipo, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a1',
     'c0000000-0000-0000-0000-0000000000b1', 'transferencia', 10, now())$$,
  '23503', null, 'A no transfiere hacia una cuenta de B'
);
select throws_ok(
  $$insert into public.movimiento (espacio_id, cuenta_id, categoria_id, tipo, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a1',
     'ca000000-0000-0000-0000-0000000000b1', 'egreso', 10, now())$$,
  '23503', null, 'A no usa categorías de B'
);

select is_empty(
  $$update public.cuenta set nombre = 'hackeada'
    where id = 'c0000000-0000-0000-0000-0000000000b1' returning id$$,
  'A no edita cuentas de B'
);
select throws_ok(
  $$delete from public.cuenta where id = 'c0000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'Nadie borra físicamente (sin GRANT DELETE): el borrado es lógico'
);

-- ---------------------------------------------------------------------------
-- Integridad del movimiento (aplica a cualquier usuario)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.movimiento (espacio_id, cuenta_id, cuenta_destino_id, tipo, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a1',
     'c0000000-0000-0000-0000-0000000000a1', 'transferencia', 10, now())$$,
  '23514', null, 'Transferencia a la misma cuenta se rechaza'
);
select throws_ok(
  $$insert into public.movimiento (espacio_id, cuenta_id, tipo, monto, fecha) values
    ('e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a1', 'egreso', 0, now())$$,
  '23514', null, 'Monto cero o negativo se rechaza'
);

-- ---------------------------------------------------------------------------
-- Como usuario B: no ve lo de A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*) from public.cuenta where espacio_id = 'e0000000-0000-0000-0000-00000000000a')::int,
  0, 'B no ve cuentas de A'
);
select is(
  (select count(*) from public.movimiento where espacio_id = 'e0000000-0000-0000-0000-00000000000a')::int,
  0, 'B no ve movimientos de A'
);

select * from finish();
rollback;
