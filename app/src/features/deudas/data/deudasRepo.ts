import type { DatabaseWriter } from '@/lib/db/DatabaseWriter'
import * as Crypto from 'expo-crypto'
import { aCentavos, calcularSaldoPendiente, desdeCentavos, estadoDeudaDesdeSaldo } from '@vaulto/shared/domain'

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

function validarMonto(monto: string): number {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(monto)) {
    throw new RangeError('El monto admite hasta 12 dígitos enteros y 2 decimales')
  }
  const [entero, decimales = ''] = monto.split('.')
  const centavos = Number(entero) * 100 + Number(decimales.padEnd(2, '0'))
  if (centavos <= 0) throw new RangeError('El monto debe ser mayor que cero')
  return centavos
}

function validarDatosDeuda(datos: DatosDeuda): DatosDeuda {
  if (!['yo_debo', 'me_deben'].includes(datos.direccion) || !datos.contraparte.trim()) {
    throw new Error('Indica la dirección y la persona o entidad de la deuda')
  }
  const principal = validarMonto(datos.monto_inicial)
  if (!Number.isInteger(datos.prioridad) || datos.prioridad < 0 || datos.prioridad > 5) {
    throw new RangeError('La prioridad debe ser un entero entre 0 y 5')
  }
  if (datos.fecha_limite) {
    const fecha = new Date(`${datos.fecha_limite}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_limite) || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== datos.fecha_limite) {
      throw new RangeError('La fecha límite no es válida')
    }
  }
  return { ...datos, monto_inicial: desdeCentavos(principal), contraparte: datos.contraparte.trim(), nota: datos.nota?.trim() || null }
}

export async function crearDeuda(
  db: DatabaseWriter,
  espacioId: string,
  entrada: DatosDeuda,
): Promise<string> {
  const datos = validarDatosDeuda(entrada)
  if (!espacioId) throw new Error('Selecciona un espacio antes de crear la deuda')
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
  db: DatabaseWriter,
  espacioId: string,
  id: string,
  entrada: DatosDeuda,
): Promise<void> {
  const datos = validarDatosDeuda(entrada)
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
  db: DatabaseWriter,
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
  db: DatabaseWriter,
  espacioId: string,
  deudaId: string,
  monto: string,
  nota: string | null = null,
): Promise<void> {
  const pagoCentavos = validarMonto(monto)

  await db.writeTransaction(async (tx) => {
    const deuda = await tx.getOptional<{ monto_inicial: string; currency: string }>(
      `SELECT monto_inicial, currency FROM deuda
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
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      [Crypto.randomUUID(), espacioId, deudaId, desdeCentavos(pagoCentavos), deuda.currency, now, nota?.trim() || null, now, now],
    )
    await tx.execute(
      `UPDATE deuda SET saldo_pendiente = ?, estado = ?, updated_at = ?
       WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL`,
      [saldoNuevo, estadoDeudaDesdeSaldo(saldoNuevo), now, deudaId, espacioId],
    )
  })
}
