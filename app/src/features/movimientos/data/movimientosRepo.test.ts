import { afterEach, beforeEach, expect, it } from 'vitest'
import { testDatabase } from '@/test/sqlite'
import { crearMovimiento, actualizarMovimiento, eliminarMovimiento, type DatosMovimiento } from './movimientosRepo'

let fixture: ReturnType<typeof testDatabase>
const datos: DatosMovimiento = { tipo: 'ingreso', monto: '10.01', cuenta_id: 'cuenta', cuenta_destino_id: null, categoria_id: null, fecha: '2026-10-29T00:00:00Z', nota: null }
beforeEach(() => {
  fixture = testDatabase()
  fixture.sqlite.exec(`CREATE TABLE movimiento (id TEXT PRIMARY KEY, espacio_id TEXT, cuenta_id TEXT,
    cuenta_destino_id TEXT, categoria_id TEXT, tipo TEXT, monto TEXT, currency TEXT, fecha TEXT,
    nota TEXT, pago_id TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT)`)
})
afterEach(() => fixture.close())
it('rechaza edición y eliminación de otro espacio, aunque se conozca el id', async () => {
  const id = await crearMovimiento(fixture.db, 'ajeno', datos)
  await expect(actualizarMovimiento(fixture.db, 'propio', id, { ...datos, monto: '90' })).rejects.toThrow('espacio')
  await expect(eliminarMovimiento(fixture.db, 'propio', id)).rejects.toThrow('espacio')
  expect(await fixture.queries.getOptional('SELECT monto, deleted_at FROM movimiento WHERE id = ?', [id])).toEqual({ monto: '10.01', deleted_at: null })
})
it('edita y elimina lógicamente solo un movimiento propio activo', async () => {
  const id = await crearMovimiento(fixture.db, 'propio', datos)
  await actualizarMovimiento(fixture.db, 'propio', id, { ...datos, monto: '20.02' })
  await eliminarMovimiento(fixture.db, 'propio', id)
  expect(await fixture.queries.getOptional('SELECT monto, deleted_at IS NOT NULL eliminado FROM movimiento WHERE id = ?', [id])).toEqual({ monto: '20.02', eliminado: 1 })
  await expect(actualizarMovimiento(fixture.db, 'propio', id, datos)).rejects.toThrow()
})
it('un movimiento ligado a pago continúa siendo de solo lectura', async () => {
  const id = await crearMovimiento(fixture.db, 'propio', datos)
  await fixture.db.execute('UPDATE movimiento SET pago_id = ? WHERE id = ?', ['pago', id])
  await expect(actualizarMovimiento(fixture.db, 'propio', id, datos)).rejects.toThrow()
  await expect(eliminarMovimiento(fixture.db, 'propio', id)).rejects.toThrow()
})
