-- Permisos explícitos del Track B; no depende de defaults de la instalación Supabase.
-- No se concede DELETE ni TRUNCATE: el borrado de dominio es lógico.
revoke all on public.espacio, public.espacio_miembro, public.perfil, public.deuda, public.pago
  from anon, authenticated;
grant select, insert, update
  on public.espacio, public.espacio_miembro, public.perfil, public.deuda, public.pago
  to authenticated;
