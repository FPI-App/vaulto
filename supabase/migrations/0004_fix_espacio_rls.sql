-- Fix RLS policy for espacio to allow upserts by the owner
-- Drop the existing update policy
drop policy if exists "espacio_update" on public.espacio;

-- Recreate it allowing either the owner OR a member to update
create policy "espacio_update" on public.espacio
  for update to authenticated
  using ( owner_user_id = auth.uid() or public.is_espacio_member(id) )
  with check ( owner_user_id = auth.uid() or public.is_espacio_member(id) );
