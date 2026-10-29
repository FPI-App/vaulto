-- ============================================================================
-- MIGRACIÓN 0007: Permisos de tabla explícitos para Track A
-- [TRACK A] cuenta, categoria, movimiento
-- ============================================================================
-- Problema: las versiones recientes de Supabase ya no conceden por defecto
-- SELECT/INSERT/UPDATE a anon/authenticated sobre tablas nuevas de `public`.
-- Sin GRANT, la subida de PowerSync (supabase-js con rol authenticated) falla
-- con 42501 antes siquiera de evaluar RLS. Además los defaults sí dejaban
-- TRUNCATE, que RLS no filtra.
--
-- Solución: permisos mínimos y explícitos. RLS sigue siendo quien aísla por
-- espacio. Sin DELETE: el borrado es lógico (deleted_at).
-- ============================================================================

revoke all on public.cuenta, public.categoria, public.movimiento from anon, authenticated;

grant select, insert, update on public.cuenta, public.categoria, public.movimiento to authenticated;
