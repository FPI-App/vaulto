-- Impide autoinscripciones a espacios ajenos y cambios de membresía por miembros.
-- Solo el owner administra invitaciones; la creación de espacio propio conserva
-- el flujo offline del onboarding.

create or replace function public.is_espacio_owner(p_espacio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.espacio e
    where e.id = p_espacio_id
      and e.owner_user_id = auth.uid()
      and e.deleted_at is null
  );
$$;

revoke all on function public.is_espacio_owner(uuid) from public;
grant execute on function public.is_espacio_owner(uuid) to authenticated;

drop policy if exists espacio_miembro_insert on public.espacio_miembro;
create policy espacio_miembro_insert on public.espacio_miembro
  for insert to authenticated
  with check (public.is_espacio_owner(espacio_id));

drop policy if exists espacio_miembro_update on public.espacio_miembro;
create policy espacio_miembro_update on public.espacio_miembro
  for update to authenticated
  using (public.is_espacio_owner(espacio_id))
  with check (public.is_espacio_owner(espacio_id));
