import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { testDatabase } from '@/test/sqlite'
import { actualizarDeuda, crearDeuda, registrarAbono, type DatosDeuda } from './deudasRepo'

let fixture: ReturnType<typeof testDatabase>
const datos: DatosDeuda = { direccion: 'yo_debo', contraparte: 'Ana', monto_inicial: '100.00', fecha_limite: null, prioridad: 0, nota: null }
beforeEach(() => { fixture = testDatabase() })
afterEach(() => fixture.close())

describe('Deudas y abonos en SQLite', () => {
  it('varios abonos actualizan el saldo exacto y el último salda la deuda', async () => {
    const id = await crearDeuda(fixture.db, 'espacio', datos)
    await registrarAbono(fixture.db, 'espacio', id, '0.10', ' Primer pago ')
    await registrarAbono(fixture.db, 'espacio', id, '0.20')
    expect(await fixture.queries.getOptional('SELECT saldo_pendiente, estado FROM deuda WHERE id = ?', [id])).toEqual({ saldo_pendiente: '99.70', estado: 'activa' })
    await registrarAbono(fixture.db, 'espacio', id, '99.70')
    expect(await fixture.queries.getOptional('SELECT saldo_pendiente, estado FROM deuda WHERE id = ?', [id])).toEqual({ saldo_pendiente: '0.00', estado: 'saldada' })
    expect(await fixture.queries.getOptional('SELECT count(*) cantidad FROM pago')).toEqual({ cantidad: 3 })
    expect(await fixture.queries.getOptional('SELECT nota FROM pago WHERE monto = ?', ['0.10'])).toEqual({ nota: 'Primer pago' })
  })
  it('un sobrepago o un abono en otro espacio no inserta pagos ni cambia el saldo', async () => {
    const id = await crearDeuda(fixture.db, 'propio', datos)
    await expect(registrarAbono(fixture.db, 'propio', id, '100.01')).rejects.toThrow('supera')
    await expect(registrarAbono(fixture.db, 'propio', id, '10abc')).rejects.toThrow()
    await expect(registrarAbono(fixture.db, 'ajeno', id, '10')).rejects.toThrow('espacio')
    await expect(actualizarDeuda(fixture.db, 'ajeno', id, datos)).rejects.toThrow('espacio')
    expect(await fixture.queries.getOptional('SELECT count(*) cantidad FROM pago')).toEqual({ cantidad: 0 })
    expect(await fixture.queries.getOptional('SELECT saldo_pendiente FROM deuda WHERE id = ?', [id])).toEqual({ saldo_pendiente: '100.00' })
  })
  it('revierte el pago si falla la actualización del saldo', async () => {
    const id = await crearDeuda(fixture.db, 'espacio', datos)
    fixture.sqlite.exec("CREATE TRIGGER rechazar_saldo BEFORE UPDATE ON deuda BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END")
    await expect(registrarAbono(fixture.db, 'espacio', id, '10')).rejects.toThrow('fallo simulado')
    expect(await fixture.queries.getOptional('SELECT count(*) cantidad FROM pago')).toEqual({ cantidad: 0 })
    expect(await fixture.queries.getOptional('SELECT saldo_pendiente FROM deuda WHERE id = ?', [id])).toEqual({ saldo_pendiente: '100.00' })
  })
  it('al editar conserva pagos y rechaza reducir el principal por debajo de lo abonado', async () => {
    const id = await crearDeuda(fixture.db, 'espacio', { ...datos, direccion: 'me_deben' })
    await registrarAbono(fixture.db, 'espacio', id, '60')
    await expect(actualizarDeuda(fixture.db, 'espacio', id, { ...datos, monto_inicial: '59' })).rejects.toThrow()
    await actualizarDeuda(fixture.db, 'espacio', id, { ...datos, monto_inicial: '60' })
    expect(await fixture.queries.getOptional('SELECT monto_inicial, saldo_pendiente, estado FROM deuda WHERE id = ?', [id]))
      .toEqual({ monto_inicial: '60.00', saldo_pendiente: '0.00', estado: 'saldada' })
  })
  it('excluye pagos eliminados y usa la moneda de la deuda para el nuevo abono', async () => {
    const id = await crearDeuda(fixture.db, 'espacio', datos)
    await registrarAbono(fixture.db, 'espacio', id, '70')
    await fixture.db.execute("UPDATE pago SET deleted_at = '2026-01-01'")
    await fixture.db.execute("UPDATE deuda SET currency = 'USD' WHERE id = ?", [id])
    await registrarAbono(fixture.db, 'espacio', id, '100')
    expect(await fixture.queries.getOptional('SELECT currency, monto FROM pago WHERE deleted_at IS NULL')).toEqual({ currency: 'USD', monto: '100.00' })
    expect(await fixture.queries.getOptional('SELECT estado FROM deuda WHERE id = ?', [id])).toEqual({ estado: 'saldada' })
  })
  it('rechaza datos inválidos aunque la mutación no provenga del formulario', async () => {
    await expect(crearDeuda(fixture.db, 'espacio', { ...datos, monto_inicial: '0' })).rejects.toThrow()
    for (const monto_inicial of ['10abc', '0.001', '1000000000000']) {
      await expect(crearDeuda(fixture.db, 'espacio', { ...datos, monto_inicial })).rejects.toThrow()
    }
    await expect(crearDeuda(fixture.db, 'espacio', { ...datos, prioridad: 1.5 })).rejects.toThrow()
    await expect(crearDeuda(fixture.db, 'espacio', { ...datos, fecha_limite: '2026-02-30' })).rejects.toThrow()
    expect(await fixture.queries.getOptional('SELECT count(*) cantidad FROM deuda')).toEqual({ cantidad: 0 })
  })
})
