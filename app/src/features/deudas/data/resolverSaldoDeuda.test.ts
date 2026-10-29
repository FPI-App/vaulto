import { describe, expect, it } from 'vitest'

import type { DeudaRow } from './deudasRepo'
import { resolverSaldoDeuda } from './resolverSaldoDeuda'

const deuda: DeudaRow = {
  id: 'qa-deuda', direccion: 'yo_debo', contraparte: 'QA', monto_inicial: '100.00',
  saldo_pendiente: '100.00', currency: 'COP', fecha_limite: null, prioridad: 0,
  estado: 'activa', nota: null, created_at: '2026-01-01T00:00:00Z',
}

describe('Lectura de saldos de deuda', () => {
  it('calcula el saldo desde abonos sin confiar en la copia persistida', () => {
    expect(resolverSaldoDeuda(deuda, ['10.25', '20.10'])).toMatchObject({
      saldo_pendiente: '69.65', estado: 'activa', conflicto: null,
    })
    expect(resolverSaldoDeuda(deuda, ['100'])).toMatchObject({
      saldo_pendiente: '0.00', estado: 'saldada', conflicto: null,
    })
  })

  it('conserva la identidad y distingue sobrepago de deuda saldada', () => {
    const pagos = ['60', '60']
    const resultado = resolverSaldoDeuda(deuda, pagos)
    expect(resultado).toMatchObject({ id: deuda.id, saldo_pendiente: null, estado: 'conflicto' })
    expect(resultado.conflicto).toBeTruthy()
    expect(pagos).toEqual(['60', '60'])
    expect(deuda.saldo_pendiente).toBe('100.00')
  })

  it('muestra conflicto para un abono inválido en lugar de lanzar durante render', () => {
    expect(resolverSaldoDeuda(deuda, ['-1'])).toMatchObject({ saldo_pendiente: null, estado: 'conflicto' })
    expect(resolverSaldoDeuda(deuda, ['inválido'])).toMatchObject({ saldo_pendiente: null, estado: 'conflicto' })
  })
})
