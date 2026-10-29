begin;
select plan(7);
select set_config('vaulto.sync_protocol','1',true);
insert into auth.users(id,email) values ('15000000-0000-0000-0000-000000000001','qa15@example.invalid');
insert into public.espacio(id,nombre,owner_user_id) values ('15000000-0000-0000-0000-000000000010','QA','15000000-0000-0000-0000-000000000001');
insert into public.espacio_miembro(espacio_id,user_id) values ('15000000-0000-0000-0000-000000000010','15000000-0000-0000-0000-000000000001');
insert into public.categoria(id,espacio_id,nombre,tipo,icono,color) values
 ('15000000-0000-0000-0000-000000000020','15000000-0000-0000-0000-000000000010','Editada por A','egreso','gift','#DC2626');
select set_config('qa.seed','[{"table":"categoria","id":"15000000-0000-0000-0000-000000000020","op":"PUT","if_absent":true,"data":{"espacio_id":"15000000-0000-0000-0000-000000000010","nombre":"Nombre sugerido","tipo":"egreso","icono":"gift","color":"#DC2626"}}]',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is(public.aplicar_lote_sync('qa15:1:1',current_setting('qa.seed')::jsonb)->>'status','applied','semilla tardía recibe confirmación sin sobrescribir');
select is((select nombre from public.categoria where id='15000000-0000-0000-0000-000000000020'),'Editada por A','edición anterior se conserva');
select public.aplicar_lote_sync('qa15:2:2','[{"table":"categoria","id":"15000000-0000-0000-0000-000000000020","op":"DELETE","data":{}}]'::jsonb);
select public.aplicar_lote_sync('qa15:3:3',current_setting('qa.seed')::jsonb);
select ok((select deleted_at is not null from public.categoria where id='15000000-0000-0000-0000-000000000020'),'semilla no resucita la categoría eliminada');
select is((select count(*)::int from public.categoria where espacio_id='15000000-0000-0000-0000-000000000010'),1,'dos semillas no duplican la fila');
-- Simular un cliente anterior que perdió complete() después de aplicar su PUT.
select set_config('qa.upgrade',replace(current_setting('qa.seed'),'000000000020','000000000021'),true);
select public.aplicar_lote_sync('qa15:4:4',jsonb_build_array((current_setting('qa.upgrade')::jsonb->0)-'if_absent'));
select public.aplicar_lote_sync('qa15:5:5','[{"table":"categoria","id":"15000000-0000-0000-0000-000000000021","op":"PATCH","data":{"nombre":"Edición posterior"}}]'::jsonb);
select is(public.aplicar_lote_sync('qa15:4:4',current_setting('qa.upgrade')::jsonb)->>'status','already_applied','actualización reconoce recibo anterior sin if_absent');
select is((select nombre from public.categoria where id='15000000-0000-0000-0000-000000000021'),'Edición posterior','reintento actualizado no vuelve a aplicar la semilla');
select throws_ok($$select public.aplicar_lote_sync('qa15:4:4',jsonb_set(current_setting('qa.upgrade')::jsonb,'{0,data,nombre}','"Otro contenido"'::jsonb))$$,'22023',null,'compatibilidad no acepta otros cambios del contenido');
select * from finish();
rollback;
