// Reglas de un movimiento (issue #10). Dominio PURO: la UI valida con esto antes
// de escribir y la DB repite lo esencial con constraints (0001 + 0006).

import { aCentavos, desdeCentavos } from './money'
import type { TipoCategoria, TipoMovimiento } from '../types'

/** Lo que el formulario arma antes de guardar. `monto` ya normalizado o null. */
export interface BorradorMovimiento {
  tipo: TipoMovimiento
  monto: string | null
  cuenta_id: string | null
  cuenta_destino_id: string | null
  categoria_id: string | null
}

export interface ContextoValidacion {
  /** Cuentas que se pueden elegir (activas + las que ya tenía el movimiento al editar). */
  cuentasDisponibles: ReadonlySet<string>
  /** Tipo de cada categoría elegible (activas + la que ya tenía al editar). */
  tipoCategoria: ReadonlyMap<string, TipoCategoria>
}

export type ErrorMovimiento =
  | 'monto_invalido'
  | 'falta_cuenta'
  | 'cuenta_no_disponible'
  | 'falta_destino'
  | 'destino_igual_origen'
  | 'categoria_no_disponible'
  | 'categoria_tipo_distinto'

export const MENSAJE_ERROR_MOVIMIENTO: Record<ErrorMovimiento, string> = {
  monto_invalido: 'Escribe un monto mayor que cero.',
  falta_cuenta: 'Elige la cuenta.',
  cuenta_no_disponible: 'Esa cuenta ya no está disponible.',
  falta_destino: 'Elige la cuenta a la que va la transferencia.',
  destino_igual_origen: 'La cuenta de destino debe ser distinta a la de origen.',
  categoria_no_disponible: 'Esa categoría ya no está disponible.',
  categoria_tipo_distinto: 'La categoría no corresponde al tipo de movimiento.',
}

/** Devuelve los errores del borrador (vacío = válido), en orden de aparición en el formulario. */
export function validarMovimiento(b: BorradorMovimiento, ctx: ContextoValidacion): ErrorMovimiento[] {
  const errores: ErrorMovimiento[] = []

  if (b.monto === null || aCentavos(b.monto) <= 0) errores.push('monto_invalido')

  if (!b.cuenta_id) errores.push('falta_cuenta')
  else if (!ctx.cuentasDisponibles.has(b.cuenta_id)) errores.push('cuenta_no_disponible')

  if (b.tipo === 'transferencia') {
    if (!b.cuenta_destino_id) errores.push('falta_destino')
    else if (b.cuenta_destino_id === b.cuenta_id) errores.push('destino_igual_origen')
    else if (!ctx.cuentasDisponibles.has(b.cuenta_destino_id)) errores.push('cuenta_no_disponible')
  } else if (b.categoria_id) {
    const tipoCat = ctx.tipoCategoria.get(b.categoria_id)
    if (!tipoCat) errores.push('categoria_no_disponible')
    else if (tipoCat !== b.tipo) errores.push('categoria_tipo_distinto')
  }

  return errores
}

/** Fila lista para persistir: limpia los campos que el tipo no admite. */
export function normalizarBorrador(b: BorradorMovimiento): BorradorMovimiento {
  return b.tipo === 'transferencia'
    ? { ...b, categoria_id: null }
    : { ...b, cuenta_destino_id: null }
}

export interface MovimientoParaResumen {
  tipo: TipoMovimiento
  monto: string
  cuenta_id: string
  cuenta_destino_id: string | null
}

/**
 * Signo del movimiento visto desde una cuenta: +1 entra dinero, -1 sale, 0 no la
 * toca. Sin cuenta, una transferencia es neutra (mueve dinero entre cuentas propias).
 */
export function signoMovimiento(m: MovimientoParaResumen, cuentaId?: string | null): -1 | 0 | 1 {
  if (m.tipo === 'ingreso') return !cuentaId || m.cuenta_id === cuentaId ? 1 : 0
  if (m.tipo === 'egreso') return !cuentaId || m.cuenta_id === cuentaId ? -1 : 0
  if (!cuentaId) return 0
  if (m.cuenta_id === cuentaId) return -1
  if (m.cuenta_destino_id === cuentaId) return 1
  return 0
}

/**
 * Totales de una lista ya filtrada. Sin cuenta, las transferencias no cuentan
 * como ingreso ni gasto. Con cuenta, cuentan según entren o salgan de ella.
 */
export function resumenMovimientos(
  movs: readonly MovimientoParaResumen[],
  cuentaId?: string | null,
): { entradas: string; salidas: string; neto: string } {
  let entradas = 0
  let salidas = 0
  for (const m of movs) {
    const signo = signoMovimiento(m, cuentaId)
    if (signo === 1) entradas += aCentavos(m.monto)
    else if (signo === -1) salidas += aCentavos(m.monto)
  }
  return {
    entradas: desdeCentavos(entradas),
    salidas: desdeCentavos(salidas),
    neto: desdeCentavos(entradas - salidas),
  }
}

/**
 * Rango [desde, hasta) de un mes en hora LOCAL del dispositivo, como ISO UTC para
 * comparar contra `fecha` (timestamptz). `desplazamiento` 0 = mes de `ref`, -1 = anterior.
 */
export function rangoDeMes(ref: Date, desplazamiento = 0): { desde: string; hasta: string } {
  const desde = new Date(ref.getFullYear(), ref.getMonth() + desplazamiento, 1)
  const hasta = new Date(ref.getFullYear(), ref.getMonth() + desplazamiento + 1, 1)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}
