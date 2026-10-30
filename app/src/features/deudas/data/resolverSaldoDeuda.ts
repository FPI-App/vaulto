import { calcularSaldoPendiente, estadoDeudaDesdeSaldo } from '@vaulto/shared/domain'

import type { DeudaRow } from './deudasRepo'

export type DeudaCalculada = Omit<DeudaRow, 'saldo_pendiente' | 'estado'> & (
  | { saldo_pendiente: string; estado: 'activa' | 'saldada'; conflicto: null }
  | { saldo_pendiente: null; estado: 'conflicto'; conflicto: string }
)

/** Conserva la deuda y sus pagos; un conflicto nunca se convierte en saldo cero. */
export function resolverSaldoDeuda(deuda: DeudaRow, pagos: readonly string[]): DeudaCalculada {
  try {
    const saldo = calcularSaldoPendiente(deuda.monto_inicial, pagos)
    return { ...deuda, saldo_pendiente: saldo, estado: estadoDeudaDesdeSaldo(saldo), conflicto: null }
  } catch {
    return {
      ...deuda,
      saldo_pendiente: null,
      estado: 'conflicto',
      conflicto: 'Los abonos y el monto inicial no coinciden. Conservamos tus datos; revisa el historial antes de registrar más cambios.',
    }
  }
}
