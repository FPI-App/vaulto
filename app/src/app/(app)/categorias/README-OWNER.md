# Categorías — Track A (lmilo)

**Dueño:** lmilo · Track A
**Tabla canónica:** `categoria`.

Categorías de clasificación. Campos del MVP:
`nombre, tipo ('ingreso'|'egreso'), icono?, color?` más los transversales.

Ruta fuera de la tab bar (`href: null` en el Tabs layout): se navega desde Movimientos.

## Reglas de la costura (no romper el spine)
- Importa tipos/esquema desde `@vaulto/shared`. No redefinas el `AppSchema`.
- `icono`: usar nombres de Lucide (BRAND.md §4). `color`: reservar el color para significado.
- Soft delete obligatorio. UI on-brand vía `@/theme` + `@/components`.
