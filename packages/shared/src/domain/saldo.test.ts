import { describe, expect, it } from 'vitest'

import { calcularSaldos, saldoCuenta, sumarSaldos, type MovimientoParaSaldo } from './saldo'

const ingreso = (cuenta: string, monto: string): MovimientoParaSaldo => ({
  cuenta_id: cuenta,
  cuenta_destino_id: null,
  tipo: 'ingreso',
  monto,
})
const egreso = (cuenta: string, monto: string): MovimientoParaSaldo => ({
  cuenta_id: cuenta,
  cuenta_destino_id: null,
  tipo: 'egreso',
  monto,
})
const transferencia = (origen: string, destino: string, monto: string): MovimientoParaSaldo => ({
  cuenta_id: origen,
  cuenta_destino_id: destino,
  tipo: 'transferencia',
  monto,
})

describe('saldoCuenta', () => {
  it('sin movimientos devuelve el saldo inicial', () => {
    expect(saldoCuenta('1500.00', 'a', [])).toBe('1500.00')
  })

  it('suma ingresos y resta egresos de la cuenta', () => {
    const movs = [ingreso('a', '200000'), egreso('a', '50000.50'), ingreso('b', '999')]
    expect(saldoCuenta('100000', 'a', movs)).toBe('249999.50')
  })

  it('la transferencia resta en origen y suma en destino', () => {
    const movs = [transferencia('a', 'b', '30000')]
    expect(saldoCuenta('100000', 'a', movs)).toBe('70000.00')
    expect(saldoCuenta('0', 'b', movs)).toBe('30000.00')
  })

  it('permite saldo negativo (sobregiro)', () => {
    expect(saldoCuenta('0', 'a', [egreso('a', '10.01')])).toBe('-10.01')
  })

  it('no acumula error de float', () => {
    const movs = Array.from({ length: 10 }, () => ingreso('a', '0.1'))
    expect(saldoCuenta('0.2', 'a', movs)).toBe('1.20')
  })
})

describe('calcularSaldos', () => {
  it('coincide con saldoCuenta para cada cuenta en una sola pasada', () => {
    const cuentas = [
      { id: 'a', saldo_inicial: '100000' },
      { id: 'b', saldo_inicial: '5000' },
    ]
    const movs = [
      ingreso('a', '20000'),
      egreso('b', '1000'),
      transferencia('a', 'b', '15000'),
      transferencia('b', 'a', '500'),
    ]
    const saldos = calcularSaldos(cuentas, movs)
    expect(saldos).toEqual({ a: '105500.00', b: '18500.00' })
    for (const c of cuentas) {
      expect(saldos[c.id]).toBe(saldoCuenta(c.saldo_inicial, c.id, movs))
    }
  })

  it('ignora movimientos de cuentas que no están en la lista (borradas o ajenas)', () => {
    const saldos = calcularSaldos([{ id: 'a', saldo_inicial: '0' }], [
      ingreso('x', '100'),
      transferencia('x', 'a', '40'),
      transferencia('a', 'x', '10'),
    ])
    expect(saldos).toEqual({ a: '30.00' })
  })
})

describe('sumarSaldos', () => {
  it('suma strings decimales en centavos', () => {
    expect(sumarSaldos(['0.10', '0.20', '-1.00'])).toBe('-0.70')
    expect(sumarSaldos([])).toBe('0.00')
  })
})
