import type { AbstractPowerSyncDatabase } from '@powersync/react-native'
import * as Crypto from 'expo-crypto'
import { aCentavos, calcularSaldoPendiente, desdeCentavos, estadoDeudaDesdeSaldo } from '@vaulto/shared'

export interface DatosDeuda {
  direccion: 'yo_debo' | 'me_deben'
  contraparte: string
  monto_inicial: string
  fecha_limite: string | null
  prioridad: number
  nota: string | null
}

export interface DeudaRow extends DatosDeuda {
  id: string
  saldo_pendiente: string
  currency: string
  estado: 'activa' | 'saldada'
  created_at: string
}

export async function crearDeuda(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
  datos: DatosDeuda,
): Promise<string> {
  const id = Crypto.randomUUID()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO deuda
       (id, espacio_id, direccion, contraparte, monto_inicial, saldo_pendiente, currency,
        fecha_limite, prioridad, estado, nota, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, 'COP', ?, ?, 'activa', ?, ?, ?, NULL)`,
    [id, espacioId, datos.direccion, datos.contraparte, datos.monto_inicial,
      datos.monto_inicial, datos.fecha_limite, datos.prioridad, datos.nota, now, now],
  )
  return id
}

export async function actualizarDeuda(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
  id: string,
  datos: DatosDeuda,
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const deuda = await tx.getOptional<{ id: string }>(
      'SELECT id FROM deuda WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL', [id, espacioId],
    )
    if (!deuda) throw new Error('La deuda ya no existe en este espacio')
    const pagos = await tx.getAll<{ monto: string }>(
      'SELECT monto FROM pago WHERE deuda_id = ? AND espacio_id = ? AND deleted_at IS NULL', [id, espacioId],
    )
    const saldo = calcularSaldoPendiente(datos.monto_inicial, pagos.map((pago) => pago.monto))
    const now = new Date().toISOString()
    await tx.execute(
      `UPDATE deuda SET direccion = ?, contraparte = ?, monto_inicial = ?, saldo_pendiente = ?,
         estado = ?, fecha_limite = ?, prioridad = ?, nota = ?, updated_at = ?
       WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL`,
      [datos.direccion, datos.contraparte, datos.monto_inicial, saldo, estadoDeudaDesdeSaldo(saldo),
        datos.fecha_limite, datos.prioridad, datos.nota, now, id, espacioId],
    )
  })
}

export async function eliminarDeuda(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
  id: string,
): Promise<void> {
  const now = new Date().toISOString()
  await db.execute(
    'UPDATE deuda SET deleted_at = ?, updated_at = ? WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL',
    [now, now, id, espacioId],
  )
}

/** Inserta el abono y recalcula el saldo dentro de una sola transacción local. */
export async function registrarAbono(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
  deudaId: string,
  monto: string,
  nota: string | null = null,
): Promise<void> {
  const pagoCentavos = aCentavos(monto)
  if (pagoCentavos <= 0) throw new RangeError('El abono debe ser mayor que cero')

  await db.writeTransaction(async (tx) => {
    const deuda = await tx.getOptional<{ monto_inicial: string }>(
      `SELECT monto_inicial FROM deuda
       WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL`,
      [deudaId, espacioId],
    )
    if (!deuda) throw new Error('La deuda ya no existe en este espacio')

    const pagos = await tx.getAll<{ monto: string }>(
      `SELECT monto FROM pago WHERE deuda_id = ? AND espacio_id = ? AND deleted_at IS NULL`,
      [deudaId, espacioId],
    )
    const saldoActual = calcularSaldoPendiente(deuda.monto_inicial, pagos.map((pago) => pago.monto))
    if (pagoCentavos > aCentavos(saldoActual)) throw new RangeError('El abono supera el saldo pendiente')

    const saldoNuevo = desdeCentavos(aCentavos(saldoActual) - pagoCentavos)
    const now = new Date().toISOString()
    await tx.execute(
      `INSERT INTO pago
         (id, espacio_id, deuda_id, monto, currency, fecha, nota, movimiento_id,
          created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, 'COP', ?, ?, NULL, ?, ?, NULL)`,
      [Crypto.randomUUID(), espacioId, deudaId, monto, now, nota, now, now],
    )
    await tx.execute(
      `UPDATE deuda SET saldo_pendiente = ?, estado = ?, updated_at = ?
       WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL`,
      [saldoNuevo, estadoDeudaDesdeSaldo(saldoNuevo), now, deudaId, espacioId],
    )
  })
}
