# Políticas RLS

Referencia legible de las políticas Row Level Security de Vaulto. Las políticas **reales** se aplican vía migración en `../migrations/`; este directorio documenta cada una de forma legible para el equipo y para revisar coherencia con las reglas de sincronización de PowerSync.

## Principios

1. **RLS obligatorio en toda tabla.** Sin política = sin acceso (comportamiento correcto).
2. **Aislamiento por usuario:** un usuario solo ve filas donde `user_id = auth.uid()` (y, cuando aplique el modo pareja, filas de su `espacio_id`).
3. **Soft delete respetado:** las filas con `deleted_at` no nulo siguen existiendo; la app las filtra. RLS no las oculta por borrado.
4. **Coherencia con PowerSync:** las reglas de sincronización (qué filas baja cada dispositivo) deben corresponderse con lo que RLS permite leer.

## Plantilla por tabla

Al documentar una tabla, registra: nombre, columnas de control de acceso (`user_id`, `espacio_id`), y las políticas `select` / `insert` / `update` (no hay `delete` físico en el flujo normal — el borrado es un `update` de `deleted_at`).
