import { describe, expect, it, vi } from 'vitest'
import { LegacyDatabaseMigration } from './LegacyDatabaseMigration'

const user = '11111111-1111-4111-8111-111111111111'
const copy = { filename: `vaulto-${user}-migrated-22222222-2222-4222-8222-222222222222.sqlite`, fingerprint: 'a'.repeat(64) }
function fixture() {
  const values = new Map<string, string>()
  const storage = { get: async (key: string) => values.get(key) ?? null, set: async (key: string, value: string) => { values.set(key, value) } }
  return { storage, values, migration: new LegacyDatabaseMigration(storage) }
}
describe('Activación de copias verificadas', () => {
  it('no activa nada si la exportación o comparación de metadatos falla', async () => {
    const f = fixture()
    await expect(f.migration.migrate(user, async () => { throw new Error('QA copia incompleta') })).rejects.toThrow()
    expect(await f.migration.current(user)).toBeNull()
    expect(f.values.size).toBe(0)
  })
  it('publica solo después de verificar y conserva la decisión tras reiniciar', async () => {
    const f = fixture()
    const exportCopy = vi.fn(async () => copy)
    expect(await f.migration.migrate(user, exportCopy)).toBe(copy.filename)
    expect(await new LegacyDatabaseMigration(f.storage).migrate(user, exportCopy)).toBe(copy.filename)
    expect(exportCopy).toHaveBeenCalledTimes(1)
  })
  it('no admite un archivo de otra cuenta ni rutas fuera de la carpeta', async () => {
    const f = fixture()
    f.values.set(`vaulto.database.v1.${user}.migration`, JSON.stringify({ ...copy, filename: '../otra.sqlite' }))
    await expect(f.migration.current(user)).rejects.toThrow('registro de migración')
  })
  it('después de migrar A, B puede abrir su propia base sin apropiarse del original', async () => {
    const f = fixture()
    const other = '22222222-2222-4222-8222-222222222222'
    expect(await f.migration.belongsToAnotherVerifiedUser(other)).toBe(false)
    await f.migration.migrate(user, async () => copy)
    expect(await f.migration.belongsToAnotherVerifiedUser(other)).toBe(true)
    expect(await f.migration.current(other)).toBeNull()
    expect(await f.migration.belongsToAnotherVerifiedUser(user)).toBe(false)
  })
})
