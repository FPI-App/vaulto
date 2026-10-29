// Hooks reactivos de lectura de Cuentas. useQuery re-emite solo cuando cambian
// las tablas involucradas, así el saldo se recalcula en vivo al registrar
// movimientos (issue #7: "saldo calculado en vivo").
import { useMemo } from 'react'
import { useQuery } from '@powersync/react-native'
import {
  cuentasConSaldo,
  SELECT_CUENTAS_CON_SALDO,
  SELECT_CUENTA,
  type CuentaRow,
  type CuentaSaldoRow,
  type CuentaConSaldo,
} from './cuentasQueries'

export type { CuentaConSaldo } from './cuentasQueries'

export interface CuentasState {
  cuentas: CuentaConSaldo[]
  cargando: boolean
  error: boolean
}

/** Lista de cuentas del espacio con saldo en vivo. */
export function useCuentas(espacioId: string | null): CuentasState {
  const id = espacioId ?? ''
  const query = useQuery<CuentaSaldoRow>(SELECT_CUENTAS_CON_SALDO, [id])
  const cuentas = useMemo(() => cuentasConSaldo(query.data, espacioId), [query.data, espacioId])
  return { cuentas, cargando: query.isLoading || query.fetchReason === 'settings-changed', error: Boolean(query.error) }
}

/** Una sola cuenta por id (para la pantalla de edición). */
export function useCuenta(espacioId: string | null, id: string): { cuenta: CuentaRow | null; cargando: boolean; error: boolean } {
  const { data, isLoading, error, fetchReason } = useQuery<CuentaRow>(
    SELECT_CUENTA, [id, espacioId ?? ''],
  )
  const cuenta = data.find((fila) => fila.id === id && fila.espacio_id === espacioId) ?? null
  return { cuenta: error ? null : cuenta, cargando: isLoading || fetchReason === 'settings-changed', error: Boolean(error) }
}
