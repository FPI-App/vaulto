-- ============================================================================
-- MIGRACIÓN 0005: Corrección de RLS SELECT en espacio
-- ============================================================================
-- Problema: PowerSync utiliza UPSERT (INSERT ... ON CONFLICT DO UPDATE RETURNING *)
-- Al hacer RETURNING, Postgres evalúa la política de SELECT. Si el usuario que 
-- inserta el espacio no pasa la política de SELECT, Postgres arroja el error
-- "new row violates row-level security policy".
-- Como la tabla `espacio_miembro` aún no tiene el registro del dueño (se inserta
-- justo después en la misma transacción lógica), `is_espacio_member(id)` devolvía false.
-- Solución: Permitir que el owner_user_id siempre pueda hacer SELECT de su propio espacio.

drop policy if exists "espacio_select" on public.espacio;

create policy "espacio_select" on public.espacio
  for select to authenticated
  using ( owner_user_id = auth.uid() or public.is_espacio_member(id) );
