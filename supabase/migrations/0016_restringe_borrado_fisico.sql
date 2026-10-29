-- Alinear también instalaciones antiguas que heredaron privilegios amplios.
-- Las políticas RLS no filtran TRUNCATE; el MVP solo necesita SELECT/INSERT/UPDATE.
revoke delete, truncate on public.espacio, public.espacio_miembro, public.perfil,
  public.cuenta, public.categoria, public.movimiento, public.deuda, public.pago
  from anon, authenticated;
