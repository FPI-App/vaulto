begin;
select plan(8);
select set_config('vaulto.sync_protocol', '1', true);
insert into auth.users(id,email) values ('13000000-0000-0000-0000-000000000001','qa13@example.invalid');
insert into public.espacio(id,nombre,owner_user_id) values
 ('13000000-0000-0000-0000-000000000010','QA A','13000000-0000-0000-0000-000000000001'),
 ('13000000-0000-0000-0000-000000000011','QA B','13000000-0000-0000-0000-000000000001');
insert into public.espacio_miembro(espacio_id,user_id) values
 ('13000000-0000-0000-0000-000000000010','13000000-0000-0000-0000-000000000001'),
 ('13000000-0000-0000-0000-000000000011','13000000-0000-0000-0000-000000000001');
insert into public.deuda(id,espacio_id,direccion,contraparte,monto_inicial,saldo_pendiente) values
 ('13000000-0000-0000-0000-000000000020','13000000-0000-0000-0000-000000000010','yo_debo','QA',100,40);
insert into public.pago(id,espacio_id,deuda_id,monto,fecha) values
 ('13000000-0000-0000-0000-000000000030','13000000-0000-0000-0000-000000000010','13000000-0000-0000-0000-000000000020',60,now());
select set_config('qa.rejected_ops', '[
 {"table":"pago","id":"13000000-0000-0000-0000-000000000031","op":"PUT","data":{"deuda_id":"13000000-0000-0000-0000-000000000020","espacio_id":"13000000-0000-0000-0000-000000000010","monto":60,"fecha":"2026-10-29T00:00:00Z"}},
 {"table":"deuda","id":"13000000-0000-0000-0000-000000000020","op":"PATCH","data":{"saldo_pendiente":40}}
]',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.aplicar_lote_sync('qa13:1:2',current_setting('qa.rejected_ops')::jsonb)$$,'23514',null,'sobrepago rechaza el lote completo');
select is(public.cancelar_lote_abono('qa13:1:2',current_setting('qa.rejected_ops')::jsonb)->>'status','cancelled','anulación explícita genera recibo');
select is(public.cancelar_lote_abono('qa13:1:2',current_setting('qa.rejected_ops')::jsonb)->>'status','cancelled','anulación es idempotente');
select is(public.aplicar_lote_sync('qa13:1:2',current_setting('qa.rejected_ops')::jsonb)->>'status','cancelled','reenvío no revive un abono anulado');
select is((select count(*)::int from public.pago where deuda_id='13000000-0000-0000-0000-000000000020'),1,'pago aplicado permanece intacto');
select is((select saldo_pendiente::text from public.deuda where id='13000000-0000-0000-0000-000000000020'),'40.00','saldo aplicado no cambia');
select throws_ok($$select public.cancelar_lote_abono('qa13:3:3','[{"table":"perfil","id":"13000000-0000-0000-0000-000000000001","op":"PUT","data":{}}]'::jsonb)$$,'22023',null,'no anula otros tipos de lote');
select throws_ok($$select public.aplicar_lote_sync('qa13:4:5','[
 {"table":"cuenta","id":"13000000-0000-0000-0000-000000000040","op":"PUT","data":{"espacio_id":"13000000-0000-0000-0000-000000000010","nombre":"QA","tipo":"efectivo"}},
 {"table":"cuenta","id":"13000000-0000-0000-0000-000000000040","op":"PATCH","data":{"espacio_id":"13000000-0000-0000-0000-000000000011"}}
]'::jsonb)$$,'23514',null,'no mueve una fila creada antes en el mismo lote');
select * from finish();
rollback;
