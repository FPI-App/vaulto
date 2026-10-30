import { sumarANumero } from '@vaulto/shared'

import type { DeudaCalculada } from './resolverSaldoDeuda'

type Direccion = 'me_deben' | 'yo_debo'

/** Total por dirección en centavos enteros; solo deudas activas con saldo conocido. */
export function calcularTotalesDeudas(
  deudas: ReadonlyArray<Pick<DeudaCalculada, 'direccion' | 'estado' | 'saldo_pendiente'>>,
): Record<Direccion, number> {
  const saldos = (direccion: Direccion) =>
    deudas.flatMap((d) => (d.estado === 'activa' && d.direccion === direccion && d.saldo_pendiente !== null ? [d.saldo_pendiente] : []))
  return { me_deben: sumarANumero(saldos('me_deben')), yo_debo: sumarANumero(saldos('yo_debo')) }
}
