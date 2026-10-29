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

`DeudasSelectorsProvider` crea la implementación real para la base y el espacio activo;
no necesita una prop `value`. Usa la noop mientras el usuario no tenga espacio activo.

La lógica de dominio vive en `packages/shared/src/domain/deudas.ts`. Los selectores
locales implementan el contrato en `app/src/features/deudas/data/deudasSelectors.ts`;
leen únicamente el espacio activo, omiten filas con soft delete y consultan la copia
local de PowerSync para funcionar sin conexión.

El detalle muestra el historial de abonos con monto, moneda, fecha y nota. Cada abono
se inserta en la misma transacción que actualiza el saldo; no se aceptan sobrepagos.
Las pruebas de `deudasRepo.test.ts` y `deudasSelectors.test.ts` usan SQLite en memoria
para comprobar rollback, límites de espacio, soft deletes y vencimientos.

## Reglas de la costura (no romper el spine)
- Importa tipos/esquema desde `@vaulto/shared`. No redefinas el `AppSchema` ni el contrato.
- `movimiento_id` en `pago` es el puente con Movimientos (Track A): comunícate por columnas, no por código.
- Deuda en violeta, NO rojo (BRAND.md §2). Soft delete obligatorio.
