-- La pertenencia permite leer datos, pero no apropiarse del espacio ni transferirlo.
drop policy if exists espacio_update on public.espacio;
create policy espacio_update on public.espacio
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
