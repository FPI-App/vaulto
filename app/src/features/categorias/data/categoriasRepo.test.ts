import { afterEach, beforeEach, expect, it } from 'vitest'
import { CATEGORIAS_POR_DEFECTO, idCategoriaSugerida } from '@vaulto/shared/domain'
import { testDatabase } from '@/test/sqlite'
import { isCategorySeedIntent } from '@/lib/sync/CategorySeedIntent'
import { crearCategoria, actualizarCategoria, eliminarCategoria, sembrarCategoriasPorDefecto, type DatosCategoria } from './categoriasRepo'
import { SELECT_CATEGORIA, SELECT_CATEGORIA_HISTORICA, SELECT_CATEGORIAS } from './categoriasQueries'

let fixture: ReturnType<typeof testDatabase>
const propio = '81000000-0000-4000-8000-000000000001'
const ajeno = '81000000-0000-4000-8000-000000000002'
const datos: DatosCategoria = { nombre: ' Mercado ', icono: 'shopping-cart', color: '#DC2626' }
beforeEach(() => {
  fixture = testDatabase()
  fixture.sqlite.exec(`CREATE TABLE categoria (id TEXT PRIMARY KEY, espacio_id TEXT, nombre TEXT,
    tipo TEXT, icono TEXT, color TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE movimiento (id TEXT PRIMARY KEY, categoria_id TEXT)`)
})
afterEach(() => fixture.close())

it('crea y edita por espacio conservando el tipo', async () => {
  const id = await crearCategoria(fixture.db, propio, 'egreso', datos)
  await actualizarCategoria(fixture.db, propio, id, { ...datos, nombre: ' Alimentación ' })
  expect(await fixture.queries.getOptional(SELECT_CATEGORIA, [id, propio])).toMatchObject({ nombre: 'Alimentación', tipo: 'egreso', icono: 'shopping-cart' })
  expect(await fixture.queries.getAll(SELECT_CATEGORIAS, [propio, 'ingreso'])).toEqual([])
})
it('rechaza editar, borrar o consultar categorías activas/históricas de otro espacio', async () => {
  const id = await crearCategoria(fixture.db, ajeno, 'egreso', datos)
  await expect(actualizarCategoria(fixture.db, propio, id, datos)).rejects.toThrow('espacio')
  await expect(eliminarCategoria(fixture.db, propio, id)).rejects.toThrow('espacio')
  expect(await fixture.queries.getOptional(SELECT_CATEGORIA, [id, propio])).toBeNull()
  expect(await fixture.queries.getOptional(SELECT_CATEGORIA_HISTORICA, [id, propio])).toBeNull()
  expect(await fixture.queries.getOptional(SELECT_CATEGORIA, [id, ajeno])).toMatchObject({ nombre: 'Mercado' })
})
it('soft delete mantiene referencias históricas y no permite editar la fila borrada', async () => {
  const id = await crearCategoria(fixture.db, propio, 'egreso', datos)
  await fixture.db.execute('INSERT INTO movimiento (id,categoria_id) VALUES (?,?)', ['movimiento', id])
  await eliminarCategoria(fixture.db, propio, id)
  expect(await fixture.queries.getOptional(SELECT_CATEGORIA, [id, propio])).toBeNull()
  expect(await fixture.queries.getOptional(SELECT_CATEGORIA_HISTORICA, [id, propio])).toMatchObject({ nombre: 'Mercado' })
  expect(await fixture.queries.getOptional('SELECT categoria_id FROM movimiento')).toEqual({ categoria_id: id })
  await expect(actualizarCategoria(fixture.db, propio, id, datos)).rejects.toThrow()
})
it('rechaza nombre vacío, colores ajenos al catálogo y espacio vacío antes de escribir', async () => {
  await expect(crearCategoria(fixture.db, propio, 'egreso', { ...datos, nombre: ' ' })).rejects.toThrow()
  await expect(crearCategoria(fixture.db, propio, 'egreso', { ...datos, color: 'red' })).rejects.toThrow()
  await expect(crearCategoria(fixture.db, '', 'egreso', datos)).rejects.toThrow()
  expect(await fixture.queries.getOptional('SELECT count(*) n FROM categoria')).toEqual({ n: 0 })
})
it('sembrar repetidamente conserva las ediciones y no duplica categorías', async () => {
  expect(await sembrarCategoriasPorDefecto(fixture.db, propio)).toBe(CATEGORIAS_POR_DEFECTO.length)
  const primera = CATEGORIAS_POR_DEFECTO[0]!
  const id = idCategoriaSugerida(propio, primera.slug)
  await actualizarCategoria(fixture.db, propio, id, { ...datos, nombre: 'Personalizada' })
  expect(await sembrarCategoriasPorDefecto(fixture.db, propio)).toBe(0)
  expect(await fixture.queries.getOptional('SELECT count(*) n FROM categoria')).toEqual({ n: CATEGORIAS_POR_DEFECTO.length })
  expect(await fixture.queries.getOptional(SELECT_CATEGORIA, [id, propio])).toMatchObject({ nombre: 'Personalizada' })
})
it('no resucita las sugeridas si el usuario las eliminó todas', async () => {
  await sembrarCategoriasPorDefecto(fixture.db, propio)
  const filas = await fixture.queries.getAll<{ id: string }>('SELECT id FROM categoria')
  for (const row of filas) await eliminarCategoria(fixture.db, propio, row.id)
  expect(await sembrarCategoriasPorDefecto(fixture.db, propio)).toBe(0)
  expect(await fixture.queries.getOptional('SELECT count(*) n FROM categoria WHERE deleted_at IS NULL')).toEqual({ n: 0 })
})
it('la semilla es determinista entre dispositivos y distinta entre espacios', async () => {
  await sembrarCategoriasPorDefecto(fixture.db, propio)
  await sembrarCategoriasPorDefecto(fixture.db, ajeno)
  const idsA = await fixture.queries.getAll<{ id: string }>('SELECT id FROM categoria WHERE espacio_id = ? ORDER BY id', [propio])
  const idsB = await fixture.queries.getAll<{ id: string }>('SELECT id FROM categoria WHERE espacio_id = ? ORDER BY id', [ajeno])
  expect(idsA.map((row) => row.id).sort()).toEqual(CATEGORIAS_POR_DEFECTO.map((item) => idCategoriaSugerida(propio, item.slug)).sort())
  expect(idsA.some((a) => idsB.some((b) => b.id === a.id))).toBe(false)
})
it('conserva intención insert-only aunque el catálogo o el nombre cambien después', async () => {
  await sembrarCategoriasPorDefecto(fixture.db, propio)
  const row = await fixture.queries.getOptional<{ id: string; created_at: string }>('SELECT id, created_at FROM categoria LIMIT 1')
  if (!row) throw new Error('Falta fixture')
  const operation = { table: 'categoria', id: row.id, op: 'PUT', data: { created_at: row.created_at, nombre: 'Nombre inicial' } }
  expect(await isCategorySeedIntent(fixture.queries, operation)).toBe(true)
  expect(await isCategorySeedIntent(fixture.queries, { ...operation, op: 'PATCH' })).toBe(false)
})
it('la siembra es transaccional: un fallo no deja categorías ni intención parcial', async () => {
  fixture.sqlite.exec("CREATE TRIGGER fallo_seed BEFORE INSERT ON categoria BEGIN SELECT RAISE(ABORT, 'QA'); END")
  await expect(sembrarCategoriasPorDefecto(fixture.db, propio)).rejects.toThrow('QA')
  expect(await fixture.queries.getOptional('SELECT count(*) n FROM categoria')).toEqual({ n: 0 })
})
