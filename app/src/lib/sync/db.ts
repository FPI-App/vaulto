import { PowerSyncDatabase } from '@powersync/react-native'
import { isSQLCipher } from '@op-engineering/op-sqlite'
import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { AppSchema } from '@vaulto/shared/powersync'

import { DatabaseKeys, type KeyStorage } from '@/lib/db/databaseKeys'
import { DatabaseSessions } from '@/lib/db/DatabaseSessions'
import { StorageError, userDatabaseIdentity } from '@/lib/db/storageErrors'
import { LegacyDatabaseMigration } from '@/lib/db/LegacyDatabaseMigration'
import { exportLegacyDatabase } from '@/lib/db/exportLegacyDatabase'

import { SupabaseConnector } from './SupabaseConnector'
import { SyncRecoveryStore } from './SyncRecoveryStore'
import { isCategorySeedIntent } from './CategorySeedIntent'

const keyOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'vaulto.database.keys',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}
const keyStorage: KeyStorage = {
  get: (key) => SecureStore.getItemAsync(key, keyOptions),
  set: (key, value) => SecureStore.setItemAsync(key, value, keyOptions),
}
const keys = new DatabaseKeys(keyStorage, () => Crypto.getRandomBytesAsync(32))
const migration = new LegacyDatabaseMigration(keyStorage)

function legacyDatabase() {
  // RQNS usaba files/ en Android; OP-SQLite usa databases/. iOS usa Documents/.
  const candidates = [new File(Paths.document, 'vaulto.sqlite')]
  if (Platform.OS === 'android') {
    candidates.push(new File(new URL('../databases/vaulto.sqlite', Paths.document.uri).toString()))
  }
  return candidates.find((file) => file.exists)
}

async function openUserDatabase(userId: string): Promise<PowerSyncDatabase> {
  const originalName = userDatabaseIdentity(userId).filename
  const mappedName = await migration.current(userId)
  let filename = mappedName ?? originalName
  if (!isSQLCipher()) {
    throw new StorageError('unsupported-cipher', 'Este build no incluye SQLCipher. Instala el APK de desarrollo actualizado para continuar.')
  }
  const directory = new Directory(Paths.document, 'vaulto-databases')
  let file = new File(directory, filename)
  if (mappedName && !file.exists) throw new StorageError('legacy-database', 'No se encontró la copia migrada. No se recreó ni reemplazó información.')
  if (!file.exists) {
    const source = legacyDatabase()
    if (source && !await migration.belongsToAnotherVerifiedUser(userId)) {
      const key = await keys.getOrCreate(userId, false)
      directory.create({ intermediates: true, idempotent: true })
      filename = await migration.migrate(userId, () => exportLegacyDatabase(userId, source, directory.uri, key))
      file = new File(directory, filename)
    }
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
  const recovery = new SyncRecoveryStore(db)
  await recovery.init()
  void db.connect(new SupabaseConnector(userId, recovery, (operation) => isCategorySeedIntent(db, operation))).catch(() => {})
  return db
}

export const databaseSessions = new DatabaseSessions(openUserDatabase)
