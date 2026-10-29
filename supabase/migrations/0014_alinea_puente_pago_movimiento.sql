-- El destino remoto conserva una FK del esquema inicial anterior al plan canónico.
-- El puente bidireccional se coordina en el dominio, sin forzar el orden de la cola.
alter table public.pago drop constraint if exists pago_movimiento_id_fkey;
