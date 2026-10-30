import { useQuery } from '@powersync/react-native'
import { useMemo } from 'react'

import { useEspacioActual } from '@/lib/espacio/useEspacioActual'

import type { DeudaRow } from './deudasRepo'
import { resolverSaldoDeuda } from './resolverSaldoDeuda'

interface PagoRow {
  deuda_id: string
  monto: string
}

export interface AbonoRow extends PagoRow {
  id: string
  currency: string
  fecha: string
  nota: string | null
}

export function useDeudas(direccion: 'yo_debo' | 'me_deben' | null) {
  const { espacioId } = useEspacioActual()
  const deudasQ = useQuery<DeudaRow>(
    `SELECT id, direccion, contraparte, monto_inicial, saldo_pendiente, currency,
            fecha_limite, prioridad, estado, nota, created_at
     FROM deuda
     WHERE espacio_id = ? AND deleted_at IS NULL
       AND (? IS NULL OR direccion = ?)
     ORDER BY fecha_limite IS NULL, fecha_limite ASC, prioridad DESC, created_at DESC`,
    [espacioId ?? '', direccion, direccion],
  )
  const pagosQ = useQuery<PagoRow>(
    `SELECT deuda_id, monto FROM pago
     WHERE espacio_id = ? AND deleted_at IS NULL`,
    [espacioId ?? ''],
  )
  const deudas = useMemo(() => {
    const pagosPorDeuda = new Map<string, string[]>()
    for (const pago of pagosQ.data) {
      const pagos = pagosPorDeuda.get(pago.deuda_id) ?? []
      pagos.push(pago.monto)
      pagosPorDeuda.set(pago.deuda_id, pagos)
    }
    return deudasQ.data.map((deuda) => {
      return resolverSaldoDeuda(deuda, pagosPorDeuda.get(deuda.id) ?? [])
    })
  }, [deudasQ.data, pagosQ.data])

  return { deudas, cargando: deudasQ.isLoading || pagosQ.isLoading, error: deudasQ.error ?? pagosQ.error, espacioId }
}

export function useDeuda(id: string) {
  const { espacioId } = useEspacioActual()
  const { data, isLoading, error } = useQuery<DeudaRow>(
    `SELECT id, direccion, contraparte, monto_inicial, saldo_pendiente, currency,
            fecha_limite, prioridad, estado, nota, created_at
     FROM deuda WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL LIMIT 1`,
    [id, espacioId ?? ''],
  )
  const pagosQ = useQuery<AbonoRow>(
    `SELECT id, deuda_id, monto, currency, fecha, nota FROM pago
     WHERE deuda_id = ? AND espacio_id = ? AND deleted_at IS NULL
     ORDER BY fecha DESC, id DESC`,
    [id, espacioId ?? ''],
  )
  const deuda = data[0]
  return {
    deuda: deuda ? resolverSaldoDeuda(deuda, pagosQ.data.map((pago) => pago.monto)) : null,
    cargando: isLoading || pagosQ.isLoading,
    error: error ?? pagosQ.error,
    abonos: pagosQ.data,
    espacioId,
  }
}
