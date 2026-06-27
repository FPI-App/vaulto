# Cuentas — Track A (lmilo)

**Dueño:** lmilo · Track A
**Tabla canónica:** `cuenta` (ver ARQUITECTURA.md / modelo de datos MVP1).

Feature de cuentas de banco y efectivo. Campos del MVP:
`nombre, tipo ('banco'|'efectivo'), banco?, saldo_inicial numeric(14,2), currency='COP', archivada bool`
más los transversales (`id, espacio_id, created_at, updated_at, deleted_at`).

## Reglas de la costura (no romper el spine)
- Importa SIEMPRE tipos y esquema desde `@vaulto/shared`. No redefinas tipos ni el `AppSchema`.
- Lee/escribe vía la instancia de PowerSync (`useQuery`, `usePowerSync` de `@powersync/react-native`).
- Respeta el soft delete: borrar = escribir `deleted_at`, nunca DELETE físico.
- UI on-brand: usa `@/theme` (tokens) y los componentes de `@/components`.
- Color financiero siempre con icono/signo (ingreso verde, egreso rojo). Ver BRAND.md §2.
