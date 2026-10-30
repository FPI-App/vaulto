import { PowerSyncDatabase } from '@powersync/web'
import { AppSchema } from '@vaulto/shared/powersync'

import { DatabaseSessions } from '@/lib/db/DatabaseSessions'
import { StorageError, userDatabaseIdentity } from '@/lib/db/storageErrors'

import { SupabaseConnector } from './SupabaseConnector'
import { SyncRecoveryStore } from './SyncRecoveryStore'
import { isCategorySeedIntent } from './CategorySeedIntent'

// Metro no reescribe URLs de workers: `pnpm web:assets` copia el worker
// preempaquetado de @powersync/web a public/, que Expo sirve en la raíz.
const WORKER_URL = '/@powersync/worker.js'

// En web no hay SQLCipher: la base vive sin cifrar en IndexedDB del navegador.
// Sirve para desarrollo y QA de pantallas, no para datos reales.
async function openUserDatabase(userId: string): Promise<PowerSyncDatabase> {
  const dbFilename = userDatabaseIdentity(userId).filename
  const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename, worker: WORKER_URL },
    sync: { worker: WORKER_URL },
  })
  try {
    await db.init()
  } catch {
    await db.close().catch(() => {})
    throw new StorageError('invalid-key', 'No se pudo abrir la base local del navegador.')
  }
  const recovery = new SyncRecoveryStore(db)
  await recovery.init()
  void db.connect(new SupabaseConnector(userId, recovery, (operation) => isCategorySeedIntent(db, operation))).catch(() => {})
  return db
}

export const databaseSessions = new DatabaseSessions(openUserDatabase)
