import { describe, expect, it } from 'vitest'

import { calcularSaldos, saldoCuenta, saldoCuentaCentavos, sumarSaldos, type MovimientoParaSaldo } from './saldo'

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

  it.each(['ingreso', 'egreso'] as const)('rechaza acumulación insegura de %s', (tipo) => {
    const movs = Array.from({ length: 91 }, () => ({ ...ingreso('a', '999999999999.99'), tipo }))
    expect(() => saldoCuentaCentavos('0', 'a', movs)).toThrow(RangeError)
    expect(() => saldoCuenta('0', 'a', movs)).toThrow(RangeError)
  })

  it('rechaza un saldo inicial que ya perdió precisión en centavos', () => {
    expect(() => saldoCuenta('100000000000000', 'a', [])).toThrow(RangeError)
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

  it('las transferencias conservan el total aunque una cuenta quede sobregirada', () => {
    const cuentas = Object.freeze([
      Object.freeze({ id: 'a', saldo_inicial: '0.10' }),
      Object.freeze({ id: 'b', saldo_inicial: '0.20' }),
      Object.freeze({ id: 'c', saldo_inicial: '-5.00' }),
    ])
    const movimientos = Object.freeze([
      Object.freeze(transferencia('a', 'b', '100.01')),
      Object.freeze(transferencia('b', 'c', '40.03')),
      Object.freeze(transferencia('c', 'a', '0.07')),
    ])
    const saldos = calcularSaldos(cuentas, movimientos)

    expect(saldos).toEqual({ a: '-99.84', b: '60.18', c: '34.96' })
    expect(sumarSaldos(Object.values(saldos))).toBe('-4.70')
    for (const cuenta of cuentas) {
      expect(saldos[cuenta.id]).toBe(saldoCuenta(cuenta.saldo_inicial, cuenta.id, movimientos))
    }
  })

  it('rechaza acumulaciones inseguras también al calcular varias cuentas', () => {
    const movimientos = Array.from({ length: 91 }, () => transferencia('a', 'b', '999999999999.99'))
    expect(() => calcularSaldos([
      { id: 'a', saldo_inicial: '0' },
      { id: 'b', saldo_inicial: '0' },
    ], movimientos)).toThrow(RangeError)
  })

  it('rechaza saldos iniciales inseguros aunque no haya movimientos', () => {
    expect(() => calcularSaldos([{ id: 'a', saldo_inicial: '100000000000000' }], [])).toThrow(RangeError)
  })
})

describe('sumarSaldos', () => {
  it('no pierde un centavo al volver a sumar un saldo agregado grande', () => {
    const movimientos = Array.from({ length: 80 }, () => ingreso('a', '999999999999.99'))
    movimientos.push(ingreso('a', '0.81'))
    const saldo = saldoCuenta('0', 'a', movimientos)
    expect(saldo).toBe('80000000000000.01')
    expect(sumarSaldos([saldo])).toBe(saldo)
  })
  it('suma strings decimales en centavos', () => {
    expect(sumarSaldos(['0.10', '0.20', '-1.00'])).toBe('-0.70')
    expect(sumarSaldos([])).toBe('0.00')
  })

  it.each(['999999999999.99', '-999999999999.99'])('rechaza un total inseguro de %s', (saldo) => {
    expect(() => sumarSaldos(Array.from({ length: 91 }, () => saldo))).toThrow(RangeError)
  })

  it.each([
    ['999999999999.99', '89999999999999.10'],
    ['-999999999999.99', '-89999999999999.10'],
  ])('conserva centavos de %s mientras el acumulado es seguro', (saldo, esperado) => {
    expect(sumarSaldos(Array.from({ length: 90 }, () => saldo))).toBe(esperado)
  })
})
