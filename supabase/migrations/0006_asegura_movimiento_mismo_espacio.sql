-- ============================================================================
-- MIGRACIÓN 0006: Un movimiento solo referencia cuentas y categorías de SU espacio
-- [TRACK A]
-- ============================================================================
-- Problema: las FKs simples (cuenta_id -> cuenta.id) no pasan por RLS. Un miembro
-- del espacio A podía insertar un movimiento en A apuntando a una cuenta o
-- categoría del espacio B si conocía su id, y el saldo de esa cuenta ajena se
-- calcularía con un movimiento que su dueño nunca ve.
--
-- Solución: FKs compuestas (espacio_id, X_id). La pareja (espacio_id, id) es
-- única de hecho porque id ya es PK; el UNIQUE explícito solo habilita la FK.
-- Las FKs a cuenta pasan de RESTRICT a NO ACTION (default): RESTRICT se evalúa
-- fila a fila y rompía el borrado en cascada de espacio (p. ej. al borrar un
-- usuario de auth.users); NO ACTION se evalúa al final de la sentencia y sigue
-- impidiendo borrar una cuenta con movimientos. En la app el borrado es lógico.
-- MATCH SIMPLE (default) omite la verificación cuando cuenta_destino_id o
-- categoria_id son NULL, que es lo esperado en ingreso/egreso y sin categoría.
-- ============================================================================

alter table public.cuenta
  add constraint cuenta_espacio_id_unico unique (espacio_id, id);

alter table public.categoria
  add constraint categoria_espacio_id_unico unique (espacio_id, id);

alter table public.movimiento
  drop constraint if exists movimiento_cuenta_id_fkey,
  drop constraint if exists movimiento_cuenta_destino_id_fkey,
  drop constraint if exists movimiento_categoria_id_fkey;

alter table public.movimiento
  add constraint movimiento_cuenta_mismo_espacio
    foreign key (espacio_id, cuenta_id)
    references public.cuenta (espacio_id, id),
  add constraint movimiento_cuenta_destino_mismo_espacio
    foreign key (espacio_id, cuenta_destino_id)
    references public.cuenta (espacio_id, id),
  -- SET NULL solo sobre categoria_id: espacio_id es NOT NULL y no debe tocarse.
  add constraint movimiento_categoria_mismo_espacio
    foreign key (espacio_id, categoria_id)
    references public.categoria (espacio_id, id) on delete set null (categoria_id),
  -- Una transferencia a la misma cuenta no mueve dinero: es un error de captura.
  add constraint movimiento_transferencia_distinta
    check (tipo <> 'transferencia' or cuenta_destino_id <> cuenta_id),
  add constraint movimiento_monto_positivo check (monto > 0);
