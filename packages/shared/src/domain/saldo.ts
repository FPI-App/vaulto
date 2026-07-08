// Cálculo de saldos de cuenta. Dominio PURO (issue #12): sin red, sin DB, sin
// React. Testeable en aislamiento y compartible cliente/servidor.
//
// Regla del saldo de una cuenta:
//   saldo = saldo_inicial
//         + ingresos a la cuenta
//         − egresos de la cuenta
//         + transferencias recibidas (cuenta_destino_id == cuenta)
//         − transferencias enviadas  (cuenta_id == cuenta)
//
// Todo el dinero se opera en centavos (enteros) vía ../money para no acumular
// error de float. Ver money.ts para el porqué de numeric(14,2) como string.

import { aCentavos, desdeCentavos } from './money'
import type { TipoMovimiento } from '../types'

/**
 * Proyección mínima de un movimiento necesaria para calcular saldos. Se pide
 * solo lo que el cálculo usa, para no acoplar el dominio a la fila completa ni a
 * la forma en que la capa de datos la entregue.
 */
export interface MovimientoParaSaldo {
  cuenta_id: string
  cuenta_destino_id: string | null
  tipo: TipoMovimiento
  monto: string
}

/** Proyección mínima de una cuenta para calcular su saldo. */
export interface CuentaParaSaldo {
  id: string
  saldo_inicial: string
}

/**
 * Saldo de una cuenta en centavos (entero). Recorre los movimientos una sola vez
 * aplicando el signo según el rol de la cuenta en cada movimiento.
 */
export function saldoCuentaCentavos(
  saldoInicial: string,
  cuentaId: string,
  movimientos: readonly MovimientoParaSaldo[],
): number {
  let total = aCentavos(saldoInicial)
  for (const m of movimientos) {
    const monto = aCentavos(m.monto)
    switch (m.tipo) {
      case 'ingreso':
        if (m.cuenta_id === cuentaId) total += monto
        break
      case 'egreso':
        if (m.cuenta_id === cuentaId) total -= monto
        break
      case 'transferencia':
        if (m.cuenta_id === cuentaId) total -= monto
        if (m.cuenta_destino_id === cuentaId) total += monto
        break
    }
  }
  return total
}

/** Saldo de una cuenta como string decimal (numeric(14,2)). */
export function saldoCuenta(
  saldoInicial: string,
  cuentaId: string,
  movimientos: readonly MovimientoParaSaldo[],
): string {
  return desdeCentavos(saldoCuentaCentavos(saldoInicial, cuentaId, movimientos))
}

/**
 * Saldos de varias cuentas en una pasada: agrupa los montos por cuenta y evita
 * recorrer todos los movimientos una vez por cuenta (O(cuentas·movimientos)).
 * Devuelve un mapa id_cuenta -> saldo (string decimal).
 */
export function calcularSaldos(
  cuentas: readonly CuentaParaSaldo[],
  movimientos: readonly MovimientoParaSaldo[],
): Record<string, string> {
  const centavos: Record<string, number> = {}
  for (const c of cuentas) centavos[c.id] = aCentavos(c.saldo_inicial)

  for (const m of movimientos) {
    const monto = aCentavos(m.monto)
    if (m.tipo === 'transferencia') {
      if (m.cuenta_id in centavos) centavos[m.cuenta_id] -= monto
      if (m.cuenta_destino_id && m.cuenta_destino_id in centavos) {
        centavos[m.cuenta_destino_id] += monto
      }
    } else if (m.cuenta_id in centavos) {
      centavos[m.cuenta_id] += m.tipo === 'ingreso' ? monto : -monto
    }
  }

  const saldos: Record<string, string> = {}
  for (const id in centavos) saldos[id] = desdeCentavos(centavos[id])
  return saldos
}

/** Suma total de una lista de saldos (string) -> string decimal. Para KPIs. */
export function sumarSaldos(saldos: readonly string[]): string {
  return desdeCentavos(saldos.reduce((acc, s) => acc + aCentavos(s), 0))
}
