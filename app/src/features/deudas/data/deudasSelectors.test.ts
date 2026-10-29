import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { testDatabase } from '@/test/sqlite'
import { crearDeuda, registrarAbono, type DatosDeuda } from './deudasRepo'
import { SQLiteDeudasSelectors } from './deudasSelectors'

let fixture: ReturnType<typeof testDatabase>
const datos: DatosDeuda = { direccion: 'yo_debo', contraparte: 'Ana', monto_inicial: '100.00', fecha_limite: '2027-01-01', prioridad: 0, nota: null }
beforeEach(() => { fixture = testDatabase() })
afterEach(() => fixture.close())

describe('Selectores de deudas sobre SQLite', () => {
  it('consulta principal y pagos en un solo snapshot y no duplica deudas al sumar', async () => {
    const id = await crearDeuda(fixture.db, 'propio', datos)
    await registrarAbono(fixture.db, 'propio', id, '10')
    await registrarAbono(fixture.db, 'propio', id, '20')
    const spy = vi.spyOn(fixture.queries, 'getAll')
    const selectors = new SQLiteDeudasSelectors(fixture.queries, 'propio')
    expect(await selectors.getTotalPorDireccion('yo_debo')).toBe(70)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('rechaza KPIs con sobrepagos sin publicar un total parcial ni descartar pagos', async () => {
    const id = await crearDeuda(fixture.db, 'propio', datos)
    await registrarAbono(fixture.db, 'propio', id, '60')
    await fixture.db.execute(
      'INSERT INTO pago (id, espacio_id, deuda_id, monto) VALUES (?, ?, ?, ?)',
      ['QA-concurrente', 'propio', id, '60.00'],
    )
    const selectors = new SQLiteDeudasSelectors(fixture.queries, 'propio')
    await expect(selectors.getTotalPorDireccion('yo_debo')).rejects.toThrow('superar')
    await expect(selectors.getProximosVencimientos(3)).rejects.toThrow('superar')
    expect(await fixture.queries.getOptional('SELECT count(*) AS cantidad FROM pago')).toEqual({ cantidad: 2 })
  })

  it('calcula totales por dirección, excluyendo saldadas, eliminadas y otros espacios', async () => {
    const activa = await crearDeuda(fixture.db, 'propio', datos)
    await registrarAbono(fixture.db, 'propio', activa, '0.30')
    await crearDeuda(fixture.db, 'propio', { ...datos, direccion: 'me_deben', monto_inicial: '25' })
    const saldada = await crearDeuda(fixture.db, 'propio', datos)
    await registrarAbono(fixture.db, 'propio', saldada, '100')
    const eliminada = await crearDeuda(fixture.db, 'propio', datos)
    await fixture.db.execute("UPDATE deuda SET deleted_at = '2026-01-01' WHERE id = ?", [eliminada])
    await crearDeuda(fixture.db, 'ajeno', datos)
    const selectors = new SQLiteDeudasSelectors(fixture.queries, 'propio')
    expect(await selectors.getTotalPorDireccion('yo_debo')).toBe(99.7)
    expect(await selectors.getTotalPorDireccion('me_deben')).toBe(25)
  })
  it('ordena vencimientos por fecha y prioridad, con un límite estricto', async () => {
    const primera = await crearDeuda(fixture.db, 'propio', { ...datos, prioridad: 5 })
    await crearDeuda(fixture.db, 'propio', { ...datos, prioridad: 1 })
    await crearDeuda(fixture.db, 'propio', { ...datos, fecha_limite: null })
    await crearDeuda(fixture.db, 'propio', { ...datos, fecha_limite: '2027-02-01' })
    const selectors = new SQLiteDeudasSelectors(fixture.queries, 'propio')
    const proximas = await selectors.getProximosVencimientos(1)
    expect(proximas).toHaveLength(1)
    expect(proximas[0]?.deuda_id).toBe(primera)
    expect(await selectors.getProximosVencimientos(10)).toHaveLength(3)
    expect(await selectors.getProximosVencimientos(Number.NaN)).toEqual([])
    expect(await selectors.getProximosVencimientos(-1)).toEqual([])
  })
})
