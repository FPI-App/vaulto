import { describe, expect, it } from 'vitest'

import { diasHastaVencimiento, etiquetaVencimiento } from './vencimiento'

const hoy = new Date(2026, 9, 13, 23, 30)

describe('diasHastaVencimiento', () => {
  it('cuenta días de calendario sin importar la hora', () => {
    expect(diasHastaVencimiento('2026-10-13', hoy)).toBe(0)
    expect(diasHastaVencimiento('2026-10-14', hoy)).toBe(1)
    expect(diasHastaVencimiento('2026-10-10', hoy)).toBe(-3)
  })

  it('cruza mes y año', () => {
    expect(diasHastaVencimiento('2026-11-01', hoy)).toBe(19)
    expect(diasHastaVencimiento('2027-01-01', new Date(2026, 11, 31))).toBe(1)
  })

  it('rechaza formatos inválidos', () => {
    expect(() => diasHastaVencimiento('13/10/2026', hoy)).toThrow(TypeError)
  })
})

describe('etiquetaVencimiento', () => {
  it.each([
    [null, 'Sin fecha límite'],
    ['2026-10-05', 'Venció hace 8 días'],
    ['2026-10-12', 'Venció ayer'],
    ['2026-10-13', 'Vence hoy'],
    ['2026-10-14', 'Vence mañana'],
    ['2026-10-20', 'Vence en 7 días'],
  ])('%s -> %s', (fecha, esperado) => {
    expect(etiquetaVencimiento(fecha, hoy)).toBe(esperado)
  })
})
