import { describe, expect, it, vi } from 'vitest'

import { DatabaseKeys } from './databaseKeys'
import { userDatabaseIdentity } from './storageErrors'

const userA = '11111111-1111-4111-8111-111111111111'
const userB = '22222222-2222-4222-8222-222222222222'
function fixture() {
  const values = new Map<string, string>()
  const storage = { get: vi.fn(async (name: string) => values.get(name) ?? null), set: vi.fn(async (name: string, value: string) => { values.set(name, value) }) }
  const random = vi.fn(async () => new Uint8Array(32).fill(values.size + 1))
  return { values, storage, random, keys: new DatabaseKeys(storage, random) }
}

describe('Llaves de base por cuenta', () => {
  it('persiste la llave antes de entregarla y la reutiliza al abrir una base existente', async () => {
    const { keys, storage, random } = fixture()
    const key = await keys.getOrCreate(userA, false)
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(await keys.getOrCreate(userA, true)).toBe(key)
    expect(storage.set).toHaveBeenCalledTimes(1)
    expect(random).toHaveBeenCalledTimes(1)
  })
  it('concurrentemente crea una sola llave, y otras cuentas usan identidades diferentes', async () => {
    const { keys, random } = fixture()
    const [first, second] = await Promise.all([keys.getOrCreate(userA, false), keys.getOrCreate(userA, false)])
    expect(first).toBe(second)
    expect(random).toHaveBeenCalledTimes(1)
    expect(await keys.getOrCreate(userB, false)).not.toBe(first)
    expect(userDatabaseIdentity(userA).filename).not.toBe(userDatabaseIdentity(userB).filename)
  })
  it('si el archivo existe y falta la llave, no genera ni guarda un reemplazo', async () => {
    const { keys, random, storage } = fixture()
    await expect(keys.getOrCreate(userA, true)).rejects.toMatchObject({ code: 'missing-key' })
    expect(random).not.toHaveBeenCalled()
    expect(storage.set).not.toHaveBeenCalled()
  })
  it('una llave corrupta tampoco se reemplaza', async () => {
    const { keys, values, storage } = fixture()
    values.set(userDatabaseIdentity(userA).keyName, 'corrupta')
    await expect(keys.getOrCreate(userA, true)).rejects.toMatchObject({ code: 'invalid-key' })
    expect(storage.set).not.toHaveBeenCalled()
  })
  it('no filtra errores de SecureStore y permite reintentar sin generar otra llave almacenada', async () => {
    const { keys, storage, values } = fixture()
    storage.get.mockRejectedValueOnce(new Error('detalle sensible de prueba'))
    await expect(keys.getOrCreate(userA, false)).rejects.toMatchObject({ code: 'key-storage' })
    expect(values.size).toBe(0)
    await expect(keys.getOrCreate(userA, false)).resolves.toMatch(/^[a-f0-9]{64}$/)
  })
  it('bloquea identidades que podrían introducir rutas arbitrarias', () => {
    expect(() => userDatabaseIdentity('../otra-cuenta')).toThrow()
  })
  it('si la llave no queda persistida no entrega una llave que podría perderse', async () => {
    const storage = { get: vi.fn(async () => null), set: vi.fn(async () => {}) }
    const keys = new DatabaseKeys(storage, async () => new Uint8Array(32).fill(1))
    await expect(keys.getOrCreate(userA, false)).rejects.toMatchObject({ code: 'key-storage' })
    expect(storage.get).toHaveBeenCalledTimes(2)
  })
})
