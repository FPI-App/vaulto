import { StorageError, userDatabaseIdentity } from './storageErrors'
import type { KeyStorage } from './databaseKeys'

interface VerifiedCopy { filename: string; fingerprint: string }

/** Publica una copia solo después de verificarla; nunca sustituye ni borra el original. */
export class LegacyDatabaseMigration {
  constructor(private readonly storage: KeyStorage) {}

  async current(userId: string): Promise<string | null> {
    const identity = userDatabaseIdentity(userId)
    const raw = await this.storage.get(`${identity.keyName}.migration`)
    if (!raw) return null
    return this.validate(userId, raw)
  }

  private validate(userId: string, raw: string): string {
    const identity = userDatabaseIdentity(userId)
    try {
      const entry: unknown = JSON.parse(raw)
      if (typeof entry !== 'object' || entry === null || !('filename' in entry) || !('fingerprint' in entry)
        || typeof entry.filename !== 'string' || typeof entry.fingerprint !== 'string'
        || !/^[a-f0-9]{64}$/.test(entry.fingerprint)
        || !entry.filename.startsWith(identity.filename.replace('.sqlite', '-migrated-'))
        || !/^vaulto-[a-f0-9-]+-migrated-[a-f0-9-]+\.sqlite$/.test(entry.filename)) throw new Error()
      return entry.filename
    } catch {
      throw new StorageError('legacy-database', 'El registro de migración no es válido. Conservamos todos los archivos.')
    }
  }

  async belongsToAnotherVerifiedUser(userId: string): Promise<boolean> {
    const owner = await this.storage.get('vaulto.database.legacy.owner')
    if (!owner || owner === userId) return false
    try { return Boolean(await this.current(owner)) } catch { return false }
  }

  async migrate(userId: string, exportAndVerify: () => Promise<VerifiedCopy>): Promise<string> {
    const existing = await this.current(userId)
    if (existing) return existing
    const copy = await exportAndVerify()
    const key = `${userDatabaseIdentity(userId).keyName}.migration`
    const value = JSON.stringify(copy)
    this.validate(userId, value)
    await this.storage.set(key, value)
    if (await this.storage.get(key) !== value) throw new StorageError('key-storage', 'No se pudo confirmar la copia migrada. Conservamos el original.')
    const confirmed = await this.current(userId)
    if (!confirmed) throw new StorageError('legacy-database', 'La copia todavía no está confirmada.')
    await this.storage.set('vaulto.database.legacy.owner', userId)
    return confirmed
  }
}
