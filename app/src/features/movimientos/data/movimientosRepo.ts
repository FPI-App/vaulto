// Capa de datos de Movimientos. Mismas reglas que cuentasRepo: SQLite local de
// PowerSync, updated_at a mano, borrado = soft delete.
//
// Los movimientos con `pago_id` los crea Track B al registrar un abono de deuda:
// son de solo lectura aquí (el WHERE pago_id IS NULL lo garantiza aunque la UI falle).
import * as Crypto from 'expo-crypto'
import type { TipoMovimiento } from '@vaulto/shared'
import type { DatabaseWriter } from '@/lib/db/DatabaseWriter'

async function modificar(db: DatabaseWriter, espacioId: string, id: string, campos: string, valores: unknown[]) {
  await db.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ id: string }>('SELECT id FROM movimiento WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL AND pago_id IS NULL', [id, espacioId])
    if (!row) throw new Error('El movimiento no está disponible para editar en este espacio')
    await tx.execute(`UPDATE movimiento SET ${campos} WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL AND pago_id IS NULL`, [...valores, id, espacioId])
  })
}

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
  db: DatabaseWriter,
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
  db: DatabaseWriter,
  espacioId: string,
  id: string,
  d: DatosMovimiento,
): Promise<void> {
  await modificar(db, espacioId, id,
    `tipo = ?, monto = ?, cuenta_id = ?, cuenta_destino_id = ?, categoria_id = ?, fecha = ?, nota = ?, updated_at = ?`,
    [
      d.tipo,
      d.monto,
      d.cuenta_id,
      d.cuenta_destino_id,
      d.categoria_id,
      d.fecha,
      d.nota,
      new Date().toISOString(),
    ],
  )
}

export async function eliminarMovimiento(db: DatabaseWriter, espacioId: string, id: string): Promise<void> {
  const now = new Date().toISOString()
  await modificar(db, espacioId, id,
    'deleted_at = ?, updated_at = ?',
    [now, now],
  )
}
