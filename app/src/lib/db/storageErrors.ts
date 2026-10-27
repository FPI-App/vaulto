export class StorageError extends Error {
  constructor(readonly code: 'invalid-user' | 'missing-key' | 'invalid-key' | 'key-storage' | 'legacy-database' | 'unsupported-cipher', message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

export function userDatabaseIdentity(userId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)) {
    throw new StorageError('invalid-user', 'No se pudo identificar la cuenta para abrir sus datos.')
  }
  const id = userId.toLowerCase()
  return { filename: `vaulto-${id}.sqlite`, keyName: `vaulto.database.v1.${id}` }
}
