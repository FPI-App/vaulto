// Hooks reactivos de lectura de Cuentas. useQuery re-emite solo cuando cambian
// las tablas involucradas, así el saldo se recalcula en vivo al registrar
// movimientos (issue #7: "saldo calculado en vivo").
import { useMemo } from 'react'
import { useQuery } from '@powersync/react-native'
import {
  calcularSaldos,
  type MovimientoParaSaldo,
  type TipoCuenta,
} from '@vaulto/shared'

/** Fila de cuenta tal como la entrega SQLite (archivada llega como 0/1). */
interface CuentaRow {
  id: string
  nombre: string
  tipo: TipoCuenta
  banco: string | null
  saldo_inicial: string
  currency: string
  archivada: number
}

/** Cuenta lista para la UI, con su saldo calculado. */
export interface CuentaConSaldo {
  id: string
  nombre: string
  tipo: TipoCuenta
  banco: string | null
  saldo_inicial: string
  currency: string
  archivada: boolean
  /** saldo_inicial + efecto de todos los movimientos (string decimal). */
  saldo: string
}

const SELECT_CUENTAS = `SELECT id, nombre, tipo, banco, saldo_inicial, currency, archivada
  FROM cuenta
  WHERE espacio_id = ? AND deleted_at IS NULL
  ORDER BY archivada ASC, nombre COLLATE NOCASE ASC`

const SELECT_MOVS = `SELECT cuenta_id, cuenta_destino_id, tipo, monto
  FROM movimiento
  WHERE espacio_id = ? AND deleted_at IS NULL`

export interface CuentasState {
  cuentas: CuentaConSaldo[]
  cargando: boolean
}

/** Lista de cuentas del espacio con saldo en vivo. */
export function useCuentas(espacioId: string | null): CuentasState {
  const id = espacioId ?? ''
  const cuentasQ = useQuery<CuentaRow>(SELECT_CUENTAS, [id])
  const movsQ = useQuery<MovimientoParaSaldo>(SELECT_MOVS, [id])

  const cuentas = useMemo<CuentaConSaldo[]>(() => {
    const saldos = calcularSaldos(cuentasQ.data, movsQ.data)
    return cuentasQ.data.map((c) => ({
      ...c,
      archivada: c.archivada === 1,
      saldo: saldos[c.id] ?? c.saldo_inicial,
    }))
  }, [cuentasQ.data, movsQ.data])

  return { cuentas, cargando: cuentasQ.isLoading || movsQ.isLoading }
}

/** Una sola cuenta por id (para la pantalla de edición). */
export function useCuenta(id: string): { cuenta: CuentaRow | null; cargando: boolean } {
  const { data, isLoading } = useQuery<CuentaRow>(
    `SELECT id, nombre, tipo, banco, saldo_inicial, currency, archivada
     FROM cuenta WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  )
  return { cuenta: data[0] ?? null, cargando: isLoading }
}
