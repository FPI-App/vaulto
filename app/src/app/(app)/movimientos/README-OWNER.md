# Movimientos — Track A (lmilo)

**Dueño:** lmilo · Track A
**Tabla canónica:** `movimiento`.

Ingresos, egresos y transferencias. Campos del MVP:
`cuenta_id, cuenta_destino_id? (solo transferencia), categoria_id?, tipo ('ingreso'|'egreso'|'transferencia'), monto numeric(14,2), currency='COP', fecha timestamptz, nota?, pago_id?`
más los transversales.

## Reglas de la costura (no romper el spine)
- Importa tipos/esquema desde `@vaulto/shared`. No redefinas el `AppSchema`.
- `pago_id` es el puente con la feature de Deudas (Track B): un abono puede materializarse
  como movimiento. No acoples código con Track B; comunícate solo por las columnas del modelo.
- Soft delete obligatorio. Orden de FK respetado por la cola de PowerSync (no crear movimiento
  antes que su cuenta).
- UI on-brand vía `@/theme` + `@/components`. Montos con `fontVariant: ['tabular-nums']` y `formatCOP`.
