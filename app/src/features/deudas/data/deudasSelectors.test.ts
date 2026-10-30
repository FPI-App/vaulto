import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { testDatabase } from '@/test/sqlite'
import { crearDeuda, registrarAbono, type DatosDeuda } from './deudasRepo'
import { SQLiteDeudasSelectors } from './deudasSelectors'

let fixture: ReturnType<typeof testDatabase>
const datos: DatosDeuda = { direccion: 'yo_debo', contraparte: 'Ana', monto_inicial: '100.00', fecha_limite: '2027-01-01', prioridad: 0, nota: null }
beforeEach(() => { fixture = testDatabase() })
afterEach(() => fixture.close())

describe('Selectores de deudas sobre SQLite', () => {
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
