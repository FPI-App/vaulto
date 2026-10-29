-- Protocolo, RLS y reintentos: no usa la marca de bypass de las suites RLS.
begin;
select no_plan();
create function pg_temp.op(t text, i uuid, o text, d jsonb default '{}') returns jsonb
language sql immutable as $$ select jsonb_build_object('table', t, 'id', i, 'op', o, 'data', d) $$;
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'qa-sync-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'qa-sync-b@test.local');
insert into public.espacio(id, nombre, owner_user_id) values
  ('e0000000-0000-0000-0000-00000000000a', 'QA A', '00000000-0000-0000-0000-00000000000a'),
  ('e0000000-0000-0000-0000-00000000000b', 'QA B', '00000000-0000-0000-0000-00000000000b');
insert into public.espacio_miembro(espacio_id, user_id) values
  ('e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('e0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');
insert into public.deuda(id, espacio_id, direccion, contraparte, monto_inicial, saldo_pendiente) values
  ('d0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a', 'yo_debo', 'QA A', 100, 100),
  ('d0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000b', 'yo_debo', 'QA B', 100, 100);
create temp table lotes (nombre text primary key, operaciones jsonb);
grant select on lotes to authenticated;
insert into lotes values ('primero', jsonb_build_array(
  pg_temp.op('pago', 'a1000000-0000-0000-0000-000000000001', 'PUT', '{"espacio_id":"e0000000-0000-0000-0000-00000000000a","deuda_id":"d0000000-0000-0000-0000-00000000000a","monto":"60.00","fecha":"2026-01-01T12:00:00Z"}'),
  pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000a', 'PATCH', '{"saldo_pendiente":"40","estado":"activa"}')
));

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$update public.deuda set nota = 'bypass' where id = 'd0000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Una escritura directa no evita el protocolo');
select is(public.aplicar_lote_sync('QA:1:2', (select operaciones from lotes where nombre = 'primero'))->>'status', 'applied', 'Se aplica pago y saldo como un lote');
select is((select saldo_pendiente from public.deuda where id = 'd0000000-0000-0000-0000-00000000000a'), 40::numeric, 'Saldo derivado del primer pago');
select is(public.aplicar_lote_sync('QA:1:2', (select operaciones from lotes where nombre = 'primero'))->>'status', 'already_applied', 'El reintento reconoce el recibo');
select is((select count(*) from public.pago), 1::bigint, 'Reintentar no duplica el pago');
select throws_ok($$select public.aplicar_lote_sync('QA:1:2', jsonb_build_array(pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000a', 'PATCH', '{"nota":"otro contenido"}')))$$,
  '22023', null, 'Reutilizar identidad con otro contenido se rechaza');

select lives_ok($$select public.aplicar_lote_sync('QB:3:4', jsonb_build_array(
  pg_temp.op('pago', 'a1000000-0000-0000-0000-000000000002', 'PUT', '{"espacio_id":"e0000000-0000-0000-0000-00000000000a","deuda_id":"d0000000-0000-0000-0000-00000000000a","monto":"10","fecha":"2026-01-01T12:00:00Z"}'),
  pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000a', 'PATCH', '{"saldo_pendiente":"90"}')
))$$, 'Un segundo dispositivo puede enviar un saldo local obsoleto');
select is((select saldo_pendiente from public.deuda where id = 'd0000000-0000-0000-0000-00000000000a'), 30::numeric, 'Servidor recalcula sobre todos los pagos confirmados');
select throws_ok($$select public.aplicar_lote_sync('QB:5:5', jsonb_build_array(
  pg_temp.op('pago', 'a1000000-0000-0000-0000-000000000003', 'PUT', '{"espacio_id":"e0000000-0000-0000-0000-00000000000a","deuda_id":"d0000000-0000-0000-0000-00000000000a","monto":"40","fecha":"2026-01-01T12:00:00Z"}')
))$$, '23514', null, 'Se rechaza un lote que excede el principal confirmado');
select is((select count(*) from public.pago), 2::bigint, 'El pago rechazado no deja una fila parcial');
select is((select count(*) from private.vaulto_sync_lote where lote_id = 'QB:5:5'), 0::bigint, 'El fallo también revierte el recibo');

select throws_ok($$select public.aplicar_lote_sync('QA:6:7', jsonb_build_array(
  pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000a', 'PATCH', '{"nota":"no debe persistir"}'),
  pg_temp.op('deuda', 'd0000000-0000-0000-0000-000000000099', 'PATCH', '{"nota":"inexistente"}')
))$$, '42501', null, 'Cero filas en la segunda operación revierte el lote entero');
select is((select nota from public.deuda where id = 'd0000000-0000-0000-0000-00000000000a'), null::text, 'La primera operación no queda aplicada tras el fallo');
select is((select count(*) from private.vaulto_sync_lote where lote_id = 'QA:6:7'), 0::bigint, 'El lote fallido sigue siendo reenviable');
select throws_ok($$select public.aplicar_lote_sync('QA:8:8', jsonb_build_array(pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000b', 'PATCH', '{"nota":"ajena"}')))$$,
  '42501', null, 'La función invoker conserva el aislamiento RLS');
select throws_ok($$select public.aplicar_lote_sync('QA:8:9', jsonb_build_array(pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000b', 'PUT', '{"espacio_id":"e0000000-0000-0000-0000-00000000000a","direccion":"yo_debo","contraparte":"QA","monto_inicial":"100","saldo_pendiente":"100"}')))$$,
  '42501', null, 'Un PUT con ID ajeno tampoco puede apropiarse de una fila');
select throws_ok($$select public.aplicar_lote_sync('QA:9:9', jsonb_build_array(pg_temp.op('vaulto_sync_lote', 'd0000000-0000-0000-0000-00000000000a', 'PATCH', '{}')))$$,
  '22023', null, 'El cliente no puede escribir tablas fuera del dominio');
select throws_ok($$select public.aplicar_lote_sync('QA:10:10', jsonb_build_array(pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000a', 'PATCH', '{"columna_inventada":"QA"}')))$$,
  '22023', null, 'Se rechazan columnas no existentes');
select throws_ok($$select public.aplicar_lote_sync('QA:11:11', jsonb_build_array(pg_temp.op('deuda', 'd0000000-0000-0000-0000-00000000000a', 'PATCH', '{"espacio_id":"e0000000-0000-0000-0000-00000000000b"}')))$$,
  '23514', null, 'El protocolo no mueve filas entre espacios');
select throws_ok($$select public.aplicar_lote_sync('QA:12:12', '[]')$$, '22023', null, 'Se rechaza el lote vacío');
select throws_ok($$select public.aplicar_lote_sync('QA:12:13', (select jsonb_agg('{}'::jsonb) from generate_series(1,1001)))$$,
  '22023', null, 'No se dividen silenciosamente lotes que superan el límite');

select is(public.aplicar_lote_sync('QA:13:13', jsonb_build_array(pg_temp.op('pago', 'a1000000-0000-0000-0000-000000000001', 'DELETE')))->>'status', 'applied', 'DELETE de protocolo es soft delete');
select ok((select deleted_at is not null from public.pago where id = 'a1000000-0000-0000-0000-000000000001'), 'El pago se conserva como eliminado');
select is((select saldo_pendiente from public.deuda where id = 'd0000000-0000-0000-0000-00000000000a'), 90::numeric, 'El saldo se recalcula al anular un pago');
select is(public.aplicar_lote_sync('QA:1:2', (select operaciones from lotes where nombre = 'primero'))->>'status', 'already_applied', 'Un reintento antiguo no revive un pago anulado');
select is((select saldo_pendiente from public.deuda where id = 'd0000000-0000-0000-0000-00000000000a'), 90::numeric, 'El reintento antiguo no sobrescribe el saldo nuevo');
select isnt(coalesce(current_setting('vaulto.sync_protocol', true), ''), '1', 'La función restaura el contexto al devolver control');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from private.vaulto_sync_lote), 0::bigint, 'Otro usuario no ve recibos ajenos');
select lives_ok($$select public.aplicar_lote_sync('B:1:3', jsonb_build_array(
  pg_temp.op('espacio', 'e0000000-0000-0000-0000-000000000002', 'PUT', '{"nombre":"QA nuevo","owner_user_id":"00000000-0000-0000-0000-00000000000b"}'),
  pg_temp.op('espacio_miembro', 'b1000000-0000-0000-0000-000000000001', 'PUT', '{"espacio_id":"e0000000-0000-0000-0000-000000000002","user_id":"00000000-0000-0000-0000-00000000000b"}'),
  pg_temp.op('perfil', '00000000-0000-0000-0000-00000000000b', 'PUT', '{"espacio_id":"e0000000-0000-0000-0000-000000000002","nombre":"QA","apellido":"B","username":"qa_sync_b","onboarding_completo":true}')
))$$, 'Onboarding crea raíz, membresía y perfil en una sola transacción');
select ok((select onboarding_completo from public.perfil where id = auth.uid()), 'El perfil de onboarding queda completo');
select set_config('request.jwt.claims', '{}', true);
select throws_ok($$select public.aplicar_lote_sync('missing-user:1', '[]')$$, '42501', null, 'Un rol sin identidad JWT no crea recibos');

reset role;
set local role anon;
select throws_ok($$select public.aplicar_lote_sync('anon:1', '[]')$$, '42501', null, 'El rol anónimo no ejecuta la subida');
select * from finish();
rollback;
