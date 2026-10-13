import { describe, expect, it } from 'vitest'

import { aCentavos, desdeCentavos, normalizarMontoInput, restarMontos, sumarMontos } from './money'

describe('aCentavos / desdeCentavos', () => {
  it('ida y vuelta conserva 2 decimales', () => {
    expect(desdeCentavos(aCentavos('1234.5'))).toBe('1234.50')
    expect(desdeCentavos(aCentavos(-0.05))).toBe('-0.05')
  })

  it('lanza con montos no numéricos', () => {
    expect(() => aCentavos('abc')).toThrow(TypeError)
  })
})

describe('sumarMontos / restarMontos', () => {
  it('opera sin error de float', () => {
    expect(sumarMontos('0.1', '0.2')).toBe('0.30')
    expect(restarMontos('1', '0.9')).toBe('0.10')
  })
})

describe('normalizarMontoInput (es-CO)', () => {
  it.each([
    ['1.250.000', '1250000.00'],
    ['1.250,50', '1250.50'],
    ['  25 000 ', '25000.00'],
    ['0', '0.00'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizarMontoInput(entrada)).toBe(esperado)
  })

  it.each(['', 'abc', '-500', '1,2,3', '12a'])('rechaza %j', (entrada) => {
    expect(normalizarMontoInput(entrada)).toBeNull()
  })
})
