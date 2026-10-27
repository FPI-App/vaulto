-- Verifica bootstrap del owner y bloqueo de autoinscripciones a espacios ajenos.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'intruso@test.local');
insert into public.espacio (id, nombre, owner_user_id) values
  ('e0000000-0000-0000-0000-00000000000a', 'Espacio A', '00000000-0000-0000-0000-00000000000a'),
  ('e0000000-0000-0000-0000-00000000000b', 'Espacio B', '00000000-0000-0000-0000-00000000000b');
insert into public.espacio_miembro (espacio_id, user_id) values
  ('e0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.espacio_miembro (espacio_id, user_id)
    values ('e0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'No es posible autoinscribirse al espacio de otro owner'
);
select lives_ok(
  $$insert into public.espacio_miembro (espacio_id, user_id)
    values ('e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a')$$,
  'El owner puede crear la membresía de onboarding en su espacio'
);
select lives_ok(
  $$insert into public.espacio_miembro (espacio_id, user_id, rol)
    values ('e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'miembro')$$,
  'El owner puede invitar a otro usuario'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.is_espacio_member('e0000000-0000-0000-0000-00000000000a'), true,
  'La invitación concede pertenencia solo después de que la inserta el owner');

select * from finish();
rollback;
