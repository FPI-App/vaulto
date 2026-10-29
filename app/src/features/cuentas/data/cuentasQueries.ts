import { calcularSaldos, type MovimientoParaSaldo } from '@vaulto/shared/domain'
import type { TipoCuenta } from '@vaulto/shared/types'

export interface CuentaRow {
  id: string
  espacio_id: string
  nombre: string
  tipo: TipoCuenta
  banco: string | null
  saldo_inicial: string
  currency: string
  archivada: number
}

export interface CuentaConSaldo extends Omit<CuentaRow, 'archivada'> {
  archivada: boolean
  saldo: string
}

export interface CuentaSaldoRow extends CuentaRow {
  movimiento_id: string | null
  cuenta_origen_id: string | null
  cuenta_destino_id: string | null
  movimiento_tipo: MovimientoParaSaldo['tipo'] | null
  monto: string | null
}

// Un snapshot evita combinar un saldo inicial con movimientos de otro instante.
export const SELECT_CUENTAS_CON_SALDO = `
  SELECT c.id, c.espacio_id, c.nombre, c.tipo, c.banco, c.saldo_inicial, c.currency, c.archivada,
         m.id AS movimiento_id, m.cuenta_id AS cuenta_origen_id, m.cuenta_destino_id,
         m.tipo AS movimiento_tipo, m.monto
  FROM cuenta c LEFT JOIN movimiento m
    ON (m.cuenta_id = c.id OR m.cuenta_destino_id = c.id)
    AND m.espacio_id = c.espacio_id AND m.deleted_at IS NULL
  WHERE c.espacio_id = ? AND c.deleted_at IS NULL
  ORDER BY c.archivada ASC, c.nombre COLLATE NOCASE ASC, c.id, m.id`

export const SELECT_CUENTA = `
  SELECT id, espacio_id, nombre, tipo, banco, saldo_inicial, currency, archivada
  FROM cuenta WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL LIMIT 1`

export function cuentasConSaldo(filas: readonly CuentaSaldoRow[], espacioId: string | null): CuentaConSaldo[] {
  const cuentas = new Map<string, CuentaRow>()
  const movimientos = new Map<string, MovimientoParaSaldo>()
  for (const fila of filas) {
    // useQuery puede conservar el resultado anterior al cambiar sus parámetros.
    if (fila.espacio_id !== espacioId) continue
    const { movimiento_id, cuenta_origen_id, cuenta_destino_id, movimiento_tipo, monto, ...cuenta } = fila
    cuentas.set(cuenta.id, cuenta)
    if (movimiento_id && cuenta_origen_id && movimiento_tipo && monto !== null) {
      movimientos.set(movimiento_id, {
        cuenta_id: cuenta_origen_id, cuenta_destino_id, tipo: movimiento_tipo, monto,
      })
    }
  }
  const lista = [...cuentas.values()]
  // Una transferencia aparece en dos filas del JOIN; se contabiliza una sola vez.
  const saldos = calcularSaldos(lista, [...movimientos.values()])
  return lista.map((cuenta) => ({ ...cuenta, archivada: cuenta.archivada === 1, saldo: saldos[cuenta.id]! }))
}
