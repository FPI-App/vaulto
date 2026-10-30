import { StorageError } from './storageErrors'

// La migración de bases legadas depende de op-sqlite, que solo existe en nativo
export async function exportLegacyDatabase(..._args: unknown[]): Promise<string> {
  throw new StorageError('unsupported-cipher', 'La migración de la base local no está disponible en web.')
}
