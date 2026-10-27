import { PowerSyncDatabase } from '@powersync/react-native'
import { isSQLCipher } from '@op-engineering/op-sqlite'
import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { AppSchema } from '@vaulto/shared/powersync'

import { DatabaseKeys } from '@/lib/db/databaseKeys'
import { DatabaseSessions } from '@/lib/db/DatabaseSessions'
import { StorageError, userDatabaseIdentity } from '@/lib/db/storageErrors'

import { SupabaseConnector } from './SupabaseConnector'

const keyOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'vaulto.database.keys',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}
const keys = new DatabaseKeys({
  get: (key) => SecureStore.getItemAsync(key, keyOptions),
  set: (key, value) => SecureStore.setItemAsync(key, value, keyOptions),
}, () => Crypto.getRandomBytesAsync(32))

function legacyDatabaseExists() {
  // RQNS usaba files/ en Android; OP-SQLite usa databases/. iOS usa Documents/.
  const candidates = [new File(Paths.document, 'vaulto.sqlite')]
  if (Platform.OS === 'android') {
    candidates.push(new File(new URL('../databases/vaulto.sqlite', Paths.document.uri).toString()))
  }
  return candidates.some((file) => file.exists)
}

async function openUserDatabase(userId: string): Promise<PowerSyncDatabase> {
  const { filename } = userDatabaseIdentity(userId)
  if (!isSQLCipher()) {
    throw new StorageError('unsupported-cipher', 'Este build no incluye SQLCipher. Instala el APK de desarrollo actualizado para continuar.')
  }
  const directory = new Directory(Paths.document, 'vaulto-databases')
  const file = new File(directory, filename)
  if (!file.exists && legacyDatabaseExists()) {
    throw new StorageError('legacy-database', 'Encontramos una base anterior. Se conservó intacta; necesita una migración verificada antes de abrirla con cifrado.')
  }
  const encryptionKey = await keys.getOrCreate(userId, file.exists)
  directory.create({ intermediates: true, idempotent: true })
  const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: filename,
      dbLocation: decodeURIComponent(new URL(directory.uri).pathname),
      sqliteOptions: { encryptionKey },
    },
  })
  try {
    await db.init()
    const cipher = await db.getOptional<{ cipher_version: string }>('PRAGMA cipher_version')
    if (!cipher?.cipher_version) throw new StorageError('unsupported-cipher', 'No se pudo verificar SQLCipher en este build.')
  } catch (error) {
    await db.close().catch(() => {})
    if (error instanceof StorageError) throw error
    throw new StorageError('invalid-key', 'No se pudo abrir tu base cifrada. Los archivos se conservaron; no se generó una llave de reemplazo.')
  }
  // La base local queda disponible aunque el dispositivo no tenga conexión.
  void db.connect(new SupabaseConnector(userId)).catch(() => {})
  return db
}

export const databaseSessions = new DatabaseSessions(openUserDatabase)
