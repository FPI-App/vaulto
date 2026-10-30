import { StorageError, userDatabaseIdentity } from './storageErrors'

export interface KeyStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

/** No rota ni reemplaza llaves existentes: hacerlo puede volver ilegible la base. */
export class DatabaseKeys {
  private pending = new Map<string, Promise<string>>()

  constructor(private readonly storage: KeyStorage, private readonly randomBytes: () => Promise<Uint8Array>) {}

  getOrCreate(userId: string, databaseExists: boolean): Promise<string> {
    const { keyName } = userDatabaseIdentity(userId)
    const pending = this.pending.get(keyName)
    if (pending) return pending
    const operation = this.load(keyName, databaseExists)
    this.pending.set(keyName, operation)
    void operation.finally(() => this.pending.delete(keyName)).catch(() => {})
    return operation
  }

  private async load(keyName: string, databaseExists: boolean) {
    try {
      const stored = await this.storage.get(keyName)
      if (stored !== null) {
        if (!/^[a-f0-9]{64}$/.test(stored)) {
          throw new StorageError('invalid-key', 'La llave guardada no es válida. Tus archivos se conservaron.')
        }
        return stored
      }
      if (databaseExists) {
        throw new StorageError('missing-key', 'No se encontró la llave de esta base. No se borró ni reinició información; solicita recuperación antes de continuar.')
      }
      const bytes = await this.randomBytes()
      if (bytes.length !== 32) throw new Error('Invalid entropy length')
      const key = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
      await this.storage.set(keyName, key)
      if (await this.storage.get(keyName) !== key) throw new Error('Key persistence failed')
      return key
    } catch (error) {
      if (error instanceof StorageError) throw error
      // Los errores de storage o del driver pueden contener material sensible.
      throw new StorageError('key-storage', 'No se pudo acceder al almacenamiento seguro. Desbloquea el dispositivo e intenta de nuevo.')
    }
  }
}
