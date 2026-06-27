# Deudas — Track B (edav)

**Dueño:** edav · Track B
**Tablas canónicas:** `deuda` y `pago`.

Yo debo / me deben, con abonos y vencimientos. Campos del MVP:
- `deuda`: `direccion ('yo_debo'|'me_deben'), contraparte, monto_inicial numeric(14,2), saldo_pendiente numeric(14,2), currency='COP', fecha_limite date?, prioridad int, estado ('activa'|'saldada'), nota?`
- `pago`: `deuda_id, monto numeric(14,2), currency='COP', fecha timestamptz, nota?, movimiento_id?`
más los transversales.

## Contrato que esta feature DEBE implementar
La interfaz `DeudasSelectors` (definida en `@vaulto/shared`) la consume el dashboard (Track A):

```ts
interface DeudasSelectors {
  getTotalPorDireccion(direccion): Promise<number>
  getProximosVencimientos(limite: number): Promise<VencimientoResumen[]>
}
```

Entrega la impl real y pásala al `DeudasSelectorsProvider` (en el árbol autenticado del
root `_layout.tsx`) vía su prop `value`. Hasta entonces el dashboard usa
`noopDeudasSelectors` (0 / []) — **cero bloqueo** entre tracks.

## Reglas de la costura (no romper el spine)
- Importa tipos/esquema desde `@vaulto/shared`. No redefinas el `AppSchema` ni el contrato.
- `movimiento_id` en `pago` es el puente con Movimientos (Track A): comunícate por columnas, no por código.
- Deuda en violeta, NO rojo (BRAND.md §2). Soft delete obligatorio.
