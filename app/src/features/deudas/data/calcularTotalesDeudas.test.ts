import { formatCOP } from '@vaulto/shared/domain'
import { describe, expect, it, vi } from 'vitest'

import { calcularTotalesDeudas } from './calcularTotalesDeudas'

vi.mock('@powersync/react-native', async () => {
  const common = await import('@powersync/common')
  return {
    ...common,
    UpdateType: { PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' },
  }
})

describe('calcularTotalesDeudas', () => {
  it('evita la deriva de coma flotante sumando centavos exactos', () => {
    const deudas = [
      { direccion: 'yo_debo' as const, estado: 'activa' as const, saldo_pendiente: '0.01' },
      { direccion: 'yo_debo' as const, estado: 'activa' as const, saldo_pendiente: '2.01' },
      { direccion: 'yo_debo' as const, estado: 'activa' as const, saldo_pendiente: '0.48' },
    ]

    const totales = calcularTotalesDeudas(deudas)

    expect(totales.yo_debo).toBe(2.5)
    expect(totales.yo_debo).not.toBe(0.01 + 2.01 + 0.48)
    expect(formatCOP(totales.yo_debo)).toBe(formatCOP(2.5))
  })

  it('acumula los saldos separando deudas por dirección', () => {
    const deudas = [
      { direccion: 'me_deben' as const, estado: 'activa' as const, saldo_pendiente: '150000.50' },
      { direccion: 'me_deben' as const, estado: 'activa' as const, saldo_pendiente: '49999.50' },
      { direccion: 'yo_debo' as const, estado: 'activa' as const, saldo_pendiente: '80000.00' },
    ]

    expect(calcularTotalesDeudas(deudas)).toEqual({
      me_deben: 200000,
      yo_debo: 80000,
    })
  })

  it('excluye deudas saldadas y deudas con conflicto o saldo nulo', () => {
    const deudas = [
      { direccion: 'me_deben' as const, estado: 'activa' as const, saldo_pendiente: '50000.00' },
      { direccion: 'me_deben' as const, estado: 'saldada' as const, saldo_pendiente: '0.00' },
      { direccion: 'me_deben' as const, estado: 'conflicto' as const, saldo_pendiente: null },
      { direccion: 'yo_debo' as const, estado: 'saldada' as const, saldo_pendiente: '10000.00' },
      { direccion: 'yo_debo' as const, estado: 'conflicto' as const, saldo_pendiente: null },
    ]

    expect(calcularTotalesDeudas(deudas)).toEqual({
      me_deben: 50000,
      yo_debo: 0,
    })
  })

  it('devuelve cero en ambas direcciones cuando la lista está vacía', () => {
    expect(calcularTotalesDeudas([])).toEqual({
      me_deben: 0,
      yo_debo: 0,
    })
  })
})
