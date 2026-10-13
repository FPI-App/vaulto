// Capa de datos de Movimientos. Mismas reglas que cuentasRepo: SQLite local de
// PowerSync, updated_at a mano, borrado = soft delete.
//
// Los movimientos con `pago_id` los crea Track B al registrar un abono de deuda:
// son de solo lectura aquí (el WHERE pago_id IS NULL lo garantiza aunque la UI falle).
import type { AbstractPowerSyncDatabase } from '@powersync/react-native'
import * as Crypto from 'expo-crypto'
import type { TipoMovimiento } from '@vaulto/shared'

export interface DatosMovimiento {
  tipo: TipoMovimiento
  /** Decimal string normalizado (numeric(14,2)). */
  monto: string
  cuenta_id: string
  cuenta_destino_id: string | null
  categoria_id: string | null
  /** ISO 8601. */
  fecha: string
  nota: string | null
  /** ISO 4217. MVP: 'COP'. */
  currency?: string
}

export async function crearMovimiento(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
  d: DatosMovimiento,
): Promise<string> {
  const id = Crypto.randomUUID()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO movimiento
       (id, espacio_id, cuenta_id, cuenta_destino_id, categoria_id, tipo, monto, currency, fecha, nota,
        pago_id, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    [
      id,
      espacioId,
      d.cuenta_id,
      d.cuenta_destino_id,
      d.categoria_id,
      d.tipo,
      d.monto,
      d.currency ?? 'COP',
      d.fecha,
      d.nota,
      now,
      now,
    ],
  )
  return id
}

export async function actualizarMovimiento(
  db: AbstractPowerSyncDatabase,
  id: string,
  d: DatosMovimiento,
): Promise<void> {
  await db.execute(
    `UPDATE movimiento
     SET tipo = ?, monto = ?, cuenta_id = ?, cuenta_destino_id = ?, categoria_id = ?, fecha = ?, nota = ?,
         updated_at = ?
     WHERE id = ? AND pago_id IS NULL`,
    [
      d.tipo,
      d.monto,
      d.cuenta_id,
      d.cuenta_destino_id,
      d.categoria_id,
      d.fecha,
      d.nota,
      new Date().toISOString(),
      id,
    ],
  )
}

export async function eliminarMovimiento(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.execute(
    'UPDATE movimiento SET deleted_at = ?, updated_at = ? WHERE id = ? AND pago_id IS NULL',
    [now, now, id],
  )
}
