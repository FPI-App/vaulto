import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sumarSaldos } from '@vaulto/shared/domain'

import { testDatabase } from '@/test/sqlite'
import { actualizarCuenta, archivarCuenta, crearCuenta, eliminarCuenta, type DatosCuenta } from './cuentasRepo'
import { cuentasConSaldo, SELECT_CUENTA, SELECT_CUENTAS_CON_SALDO, type CuentaSaldoRow } from './cuentasQueries'

let fixture: ReturnType<typeof testDatabase>
const datos: DatosCuenta = { nombre: ' Ahorros ', tipo: 'banco', banco: ' Banco ', saldo_inicial: '100.10' }

beforeEach(() => {
  fixture = testDatabase()
  // Réplica local: importes TEXT y archivo 0/1, como el esquema PowerSync.
  fixture.sqlite.exec(`
    CREATE TABLE cuenta (id TEXT PRIMARY KEY, espacio_id TEXT NOT NULL, nombre TEXT, tipo TEXT,
      banco TEXT, saldo_inicial TEXT, currency TEXT, archivada INTEGER,
      created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE movimiento (id TEXT PRIMARY KEY, espacio_id TEXT, cuenta_id TEXT,
      cuenta_destino_id TEXT, tipo TEXT, monto TEXT, deleted_at TEXT);
  `)
})
afterEach(() => fixture.close())

async function listar(espacioId = 'propio') {
  const filas = await fixture.queries.getAll<CuentaSaldoRow>(SELECT_CUENTAS_CON_SALDO, [espacioId])
  return cuentasConSaldo(filas, espacioId)
}

async function movimiento(id: string, cuentaId: string, tipo: string, monto: string, destino: string | null = null, espacioId = 'propio') {
  await fixture.db.execute(
    'INSERT INTO movimiento (id, espacio_id, cuenta_id, cuenta_destino_id, tipo, monto) VALUES (?, ?, ?, ?, ?, ?)',
    [id, espacioId, cuentaId, destino, tipo, monto],
  )
}

describe('Cuentas sobre SQLite sin red', () => {
  it('crea UUID, normaliza campos y conserva centavos y moneda predeterminada', async () => {
    const id = await crearCuenta(fixture.db, 'propio', datos)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await fixture.queries.getOptional('SELECT nombre, banco, saldo_inicial, currency, archivada, deleted_at FROM cuenta WHERE id = ?', [id]))
      .toEqual({ nombre: 'Ahorros', banco: 'Banco', saldo_inicial: '100.10', currency: 'COP', archivada: 0, deleted_at: null })
    expect((await listar())[0]?.saldo).toBe('100.10')
  })

  it('crear y editar efectivo limpia el banco sin alterar identidad ni movimientos', async () => {
    const id = await crearCuenta(fixture.db, 'propio', { ...datos, tipo: 'efectivo', saldo_inicial: '0' })
    await movimiento('ingreso', id, 'ingreso', '0.25')
    await actualizarCuenta(fixture.db, 'propio', id, { ...datos, nombre: ' Caja ', tipo: 'efectivo', saldo_inicial: '1.50' })
    expect(await fixture.queries.getOptional('SELECT id, espacio_id, nombre, banco, saldo_inicial FROM cuenta WHERE id = ?', [id]))
      .toEqual({ id, espacio_id: 'propio', nombre: 'Caja', banco: null, saldo_inicial: '1.50' })
    expect((await listar())[0]?.saldo).toBe('1.75')
  })

  it.each(['10abc', '0.001', '1000000000000', '-1000000000000', 'Infinity', ''])('rechaza saldo inicial %j antes de escribir', async (saldo_inicial) => {
    await expect(crearCuenta(fixture.db, 'propio', { ...datos, saldo_inicial })).rejects.toThrow()
    expect(await listar()).toEqual([])
  })

  it('rechaza espacio o nombre vacíos y conserva la cuenta si una edición es inválida', async () => {
    await expect(crearCuenta(fixture.db, '', datos)).rejects.toThrow('espacio')
    await expect(crearCuenta(fixture.db, 'propio', { ...datos, nombre: ' ' })).rejects.toThrow()
    const id = await crearCuenta(fixture.db, 'propio', datos)
    await expect(actualizarCuenta(fixture.db, 'propio', id, { ...datos, saldo_inicial: '1abc' })).rejects.toThrow()
    expect((await listar())[0]?.saldo_inicial).toBe('100.10')
  })

  it('permite saldo inicial negativo exacto dentro de numeric(14,2)', async () => {
    await crearCuenta(fixture.db, 'propio', { ...datos, saldo_inicial: '-0.05' })
    expect((await listar())[0]?.saldo).toBe('-0.05')
  })

  it('bloquea edición, archivo y borrado lógico de otro espacio', async () => {
    const id = await crearCuenta(fixture.db, 'ajeno', datos)
    await expect(actualizarCuenta(fixture.db, 'propio', id, { ...datos, nombre: 'Intruso' })).rejects.toThrow('espacio')
    await expect(archivarCuenta(fixture.db, 'propio', id, true)).rejects.toThrow('espacio')
    await expect(eliminarCuenta(fixture.db, 'propio', id)).rejects.toThrow('espacio')
    expect(await listar()).toEqual([])
    expect(await fixture.queries.getOptional(SELECT_CUENTA, [id, 'propio'])).toBeNull()
    expect((await listar('ajeno'))[0]).toMatchObject({ nombre: 'Ahorros', archivada: false, saldo: '100.10' })
  })

  it('archivar excluye del disponible, conserva historial y permite desarchivar', async () => {
    const id = await crearCuenta(fixture.db, 'propio', datos)
    await movimiento('ingreso', id, 'ingreso', '10.01')
    await archivarCuenta(fixture.db, 'propio', id, true)
    const archivadas = await listar()
    expect(archivadas[0]).toMatchObject({ archivada: true, saldo: '110.11' })
    expect(sumarSaldos(archivadas.filter((cuenta) => !cuenta.archivada).map((cuenta) => cuenta.saldo))).toBe('0.00')
    await archivarCuenta(fixture.db, 'propio', id, false)
    expect((await listar())[0]).toMatchObject({ archivada: false, saldo: '110.11' })
    expect(await fixture.queries.getOptional('SELECT count(*) cantidad FROM movimiento')).toEqual({ cantidad: 1 })
  })

  it('elimina lógicamente sin borrar historial ni permitir resucitar la cuenta', async () => {
    const id = await crearCuenta(fixture.db, 'propio', datos)
    await movimiento('ingreso', id, 'ingreso', '1')
    await eliminarCuenta(fixture.db, 'propio', id)
    expect(await listar()).toEqual([])
    expect(await fixture.queries.getOptional(SELECT_CUENTA, [id, 'propio'])).toBeNull()
    expect(await fixture.queries.getOptional('SELECT count(*) cantidad FROM cuenta WHERE deleted_at IS NOT NULL')).toEqual({ cantidad: 1 })
    expect(await fixture.queries.getOptional('SELECT count(*) cantidad FROM movimiento')).toEqual({ cantidad: 1 })
    await expect(actualizarCuenta(fixture.db, 'propio', id, datos)).rejects.toThrow()
    await expect(archivarCuenta(fixture.db, 'propio', id, false)).rejects.toThrow()
    await expect(eliminarCuenta(fixture.db, 'propio', id)).rejects.toThrow()
  })

  it('calcula ambas cuentas en un snapshot sin duplicar la transferencia del JOIN', async () => {
    const origen = await crearCuenta(fixture.db, 'propio', datos)
    const destino = await crearCuenta(fixture.db, 'propio', { ...datos, nombre: 'Bolsillo', saldo_inicial: '20.20' })
    await movimiento('ingreso', origen, 'ingreso', '0.10')
    await movimiento('egreso', origen, 'egreso', '0.20')
    await movimiento('transferencia', origen, 'transferencia', '30.03', destino)
    const cuentas = await listar()
    expect(cuentas.find((cuenta) => cuenta.id === origen)?.saldo).toBe('69.97')
    expect(cuentas.find((cuenta) => cuenta.id === destino)?.saldo).toBe('50.23')
    expect(sumarSaldos(cuentas.map((cuenta) => cuenta.saldo))).toBe('120.20')
  })

  it('excluye movimientos eliminados o de otro espacio, incluso con IDs locales coincidentes', async () => {
    const id = await crearCuenta(fixture.db, 'propio', datos)
    await movimiento('eliminado', id, 'egreso', '500')
    await fixture.db.execute('UPDATE movimiento SET deleted_at = ? WHERE id = ?', ['2026-01-01', 'eliminado'])
    await movimiento('ajeno', id, 'ingreso', '1000', null, 'ajeno')
    expect((await listar())[0]?.saldo).toBe('100.10')
  })

  it('no reutiliza filas del espacio anterior mientras cambia la consulta reactiva', async () => {
    await crearCuenta(fixture.db, 'anterior', datos)
    const filas = await fixture.queries.getAll<CuentaSaldoRow>(SELECT_CUENTAS_CON_SALDO, ['anterior'])
    expect(cuentasConSaldo(filas, 'actual')).toEqual([])
    expect(cuentasConSaldo(filas, null)).toEqual([])
  })

  it('conserva una transferencia hacia una cuenta aún activa si la otra fue eliminada', async () => {
    const origen = await crearCuenta(fixture.db, 'propio', datos)
    const destino = await crearCuenta(fixture.db, 'propio', { ...datos, saldo_inicial: '0' })
    await movimiento('transferencia', origen, 'transferencia', '30.03', destino)
    await eliminarCuenta(fixture.db, 'propio', origen)
    expect((await listar())[0]).toMatchObject({ id: destino, saldo: '30.03' })
  })
})
