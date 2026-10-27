// Cálculos puros de deuda. Los montos llegan como numeric(14,2) y se calculan
// en centavos para evitar errores de precisión de punto flotante.
import { aCentavos, desdeCentavos } from './money'
import type { EstadoDeuda } from '../types'

/** Calcula el saldo después de aplicar todos los abonos registrados. */
export function calcularSaldoPendiente(
  montoInicial: string | number,
  pagos: readonly (string | number)[],
): string {
  const principal = aCentavos(montoInicial)
  if (principal < 0) throw new RangeError('El monto inicial no puede ser negativo')

  const totalPagos = pagos.reduce<number>((total, pago) => {
    const centavos = aCentavos(pago)
    if (centavos < 0) throw new RangeError('El monto de un abono no puede ser negativo')
    return total + centavos
  }, 0)

  if (totalPagos > principal) throw new RangeError('Los abonos no pueden superar el monto inicial')
  return desdeCentavos(principal - totalPagos)
}

/** Deriva el estado de una deuda del saldo calculado, también al editar pagos. */
export function estadoDeudaDesdeSaldo(saldoPendiente: string | number): EstadoDeuda {
  const saldo = aCentavos(saldoPendiente)
  if (saldo < 0) throw new RangeError('El saldo pendiente no puede ser negativo')
  return saldo === 0 ? 'saldada' : 'activa'
}
