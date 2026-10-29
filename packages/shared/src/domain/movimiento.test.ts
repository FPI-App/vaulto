import { describe, expect, it } from 'vitest'

import {
  normalizarBorrador,
  rangoDeMes,
  resumenMovimientos,
  signoMovimiento,
  validarMovimiento,
  type BorradorMovimiento,
  type ContextoValidacion,
  type MovimientoParaResumen,
} from './movimiento'

const ctx: ContextoValidacion = {
  cuentasDisponibles: new Set(['a', 'b']),
  tipoCategoria: new Map([
    ['mercado', 'egreso'],
    ['salario', 'ingreso'],
  ]),
}

const base: BorradorMovimiento = {
  tipo: 'egreso',
  monto: '25000.00',
  cuenta_id: 'a',
  cuenta_destino_id: null,
  categoria_id: 'mercado',
}

describe('validarMovimiento', () => {
  it('acepta un egreso completo y sin categoría', () => {
    expect(validarMovimiento(base, ctx)).toEqual([])
    expect(validarMovimiento({ ...base, categoria_id: null }, ctx)).toEqual([])
  })

  it.each([null, '0.00', '-5.00'])('rechaza monto %j', (monto) => {
    expect(validarMovimiento({ ...base, monto }, ctx)).toEqual(['monto_invalido'])
  })

  it('exige cuenta disponible', () => {
    expect(validarMovimiento({ ...base, cuenta_id: null }, ctx)).toEqual(['falta_cuenta'])
    expect(validarMovimiento({ ...base, cuenta_id: 'archivada' }, ctx)).toEqual(['cuenta_no_disponible'])
  })

  it('la categoría debe existir y coincidir con el tipo', () => {
    expect(validarMovimiento({ ...base, categoria_id: 'salario' }, ctx)).toEqual(['categoria_tipo_distinto'])
    expect(validarMovimiento({ ...base, categoria_id: 'borrada' }, ctx)).toEqual(['categoria_no_disponible'])
  })

  describe('transferencia', () => {
    const t: BorradorMovimiento = { ...base, tipo: 'transferencia', cuenta_destino_id: 'b', categoria_id: null }

    it('válida entre dos cuentas distintas', () => {
      expect(validarMovimiento(t, ctx)).toEqual([])
    })

    it('exige destino distinto y disponible', () => {
      expect(validarMovimiento({ ...t, cuenta_destino_id: null }, ctx)).toEqual(['falta_destino'])
      expect(validarMovimiento({ ...t, cuenta_destino_id: 'a' }, ctx)).toEqual(['destino_igual_origen'])
      expect(validarMovimiento({ ...t, cuenta_destino_id: 'x' }, ctx)).toEqual(['cuenta_no_disponible'])
    })

    it('ignora la categoría (se limpia al normalizar)', () => {
      const conCategoria = { ...t, categoria_id: 'salario' }
      expect(validarMovimiento(conCategoria, ctx)).toEqual([])
      expect(normalizarBorrador(conCategoria).categoria_id).toBeNull()
    })
  })

  it('normalizar quita el destino de ingreso/egreso', () => {
    expect(normalizarBorrador({ ...base, cuenta_destino_id: 'b' }).cuenta_destino_id).toBeNull()
  })
})

const ingreso: MovimientoParaResumen = { tipo: 'ingreso', monto: '100.00', cuenta_id: 'a', cuenta_destino_id: null }
const egreso: MovimientoParaResumen = { tipo: 'egreso', monto: '30.50', cuenta_id: 'b', cuenta_destino_id: null }
const transf: MovimientoParaResumen = { tipo: 'transferencia', monto: '20.00', cuenta_id: 'a', cuenta_destino_id: 'b' }

describe('signoMovimiento', () => {
  it('sin cuenta: transferencia es neutra', () => {
    expect([ingreso, egreso, transf].map((m) => signoMovimiento(m))).toEqual([1, -1, 0])
  })

  it('desde una cuenta: la transferencia sale del origen y entra al destino', () => {
    expect(signoMovimiento(transf, 'a')).toBe(-1)
    expect(signoMovimiento(transf, 'b')).toBe(1)
    expect(signoMovimiento(transf, 'c')).toBe(0)
    expect(signoMovimiento(egreso, 'a')).toBe(0)
  })
})

describe('resumenMovimientos', () => {
  it('global: excluye transferencias', () => {
    expect(resumenMovimientos([ingreso, egreso, transf])).toEqual({
      entradas: '100.00',
      salidas: '30.50',
      neto: '69.50',
    })
  })

  it('por cuenta: incluye transferencias según el sentido', () => {
    expect(resumenMovimientos([ingreso, egreso, transf], 'b')).toEqual({
      entradas: '20.00',
      salidas: '30.50',
      neto: '-10.50',
    })
  })
})

describe('rangoDeMes', () => {
  it('cubre el mes local completo y encadena con el siguiente', () => {
    const ref = new Date(2026, 9, 13, 15, 0)
    const actual = rangoDeMes(ref)
    const anterior = rangoDeMes(ref, -1)
    expect(new Date(actual.desde)).toEqual(new Date(2026, 9, 1))
    expect(new Date(actual.hasta)).toEqual(new Date(2026, 10, 1))
    expect(anterior.hasta).toBe(actual.desde)
    expect(ref.toISOString() >= actual.desde && ref.toISOString() < actual.hasta).toBe(true)
  })

  it('cruza de año', () => {
    const { desde, hasta } = rangoDeMes(new Date(2026, 0, 10), -1)
    expect(new Date(desde)).toEqual(new Date(2025, 11, 1))
    expect(new Date(hasta)).toEqual(new Date(2026, 0, 1))
  })
})
