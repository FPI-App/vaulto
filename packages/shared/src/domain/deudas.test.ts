import { describe, expect, it } from 'vitest'

import { calcularSaldoPendiente, estadoDeudaDesdeSaldo } from './deudas'

describe('calcularSaldoPendiente', () => {
  it('resta varios pagos en centavos sin errores de redondeo', () => {
    expect(calcularSaldoPendiente('100.00', ['0.10', '0.20'])).toBe('99.70')
  })

  it('devuelve cero cuando los pagos saldan exactamente la deuda', () => {
    expect(calcularSaldoPendiente('100.25', ['75', '25.25'])).toBe('0.00')
  })

  it('acepta una deuda sin pagos', () => {
    expect(calcularSaldoPendiente('1250.50', [])).toBe('1250.50')
  })

  it('rechaza un principal negativo, pagos negativos y sobrepagos', () => {
    expect(() => calcularSaldoPendiente('-1', [])).toThrow(RangeError)
    expect(() => calcularSaldoPendiente('10', ['-1'])).toThrow(RangeError)
    expect(() => calcularSaldoPendiente('10', ['10.01'])).toThrow(RangeError)
  })
})

describe('estadoDeudaDesdeSaldo', () => {
  it('marca saldada únicamente cuando el saldo llega a cero', () => {
    expect(estadoDeudaDesdeSaldo('0.00')).toBe('saldada')
    expect(estadoDeudaDesdeSaldo('0.01')).toBe('activa')
  })

  it('rechaza un saldo negativo', () => {
    expect(() => estadoDeudaDesdeSaldo('-0.01')).toThrow(RangeError)
  })
})
