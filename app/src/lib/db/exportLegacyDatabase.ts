import { open, getDylibPath, type DB } from '@op-engineering/op-sqlite'
import * as Crypto from 'expo-crypto'
import { File } from 'expo-file-system'
import { Platform } from 'react-native'

import { StorageError, userDatabaseIdentity } from './storageErrors'

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`

async function rows<T>(db: DB, sql: string, parameters: (string | number)[] = []): Promise<T[]> {
  return (await db.execute(sql, parameters)).rows as T[]
}

function serializable(value: unknown): unknown {
  if (value instanceof ArrayBuffer) return [...new Uint8Array(value)]
  if (ArrayBuffer.isView(value)) return [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)]
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(serializable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, serializable(item)]))
  return value
}

/** Incluye tablas internas, secuencias, cola, vistas y triggers, no solo el dominio. */
async function fingerprint(db: DB, schema: 'main' | 'legacy'): Promise<string> {
  const definitions = await rows<{ type: string; name: string; sql: string | null }>(db,
    `SELECT type, name, sql FROM ${schema}.sqlite_schema WHERE name NOT LIKE 'sqlite_stat%' ORDER BY type, name`)
  const tables: Record<string, unknown> = {}
  for (const definition of definitions.filter((item) => item.type === 'table')) {
    const name = `${schema}.${identifier(definition.name)}`
    let values: unknown[]
    try { values = await rows(db, `SELECT rowid AS __migration_rowid__, * FROM ${name}`) } catch (error) {
      if (!String(error).includes('rowid')) throw error
      values = await rows(db, `SELECT * FROM ${name}`)
    }
    tables[definition.name] = values.map((row) => JSON.stringify(serializable(row))).sort()
  }
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify({ definitions, tables }))
}

export async function exportLegacyDatabase(userId: string, source: File, destinationDirectory: string, encryptionKey: string, onStage: (stage: string) => void = () => {}) {
  const filename = userDatabaseIdentity(userId).filename.replace('.sqlite', `-migrated-${Crypto.randomUUID()}.sqlite`)
  if (new File(destinationDirectory, filename).exists) throw new StorageError('legacy-database', 'La ruta de copia ya existe; se conservó intacta.')
  const location = decodeURIComponent(new URL(destinationDirectory).pathname)
  const target = open({ name: filename, location, encryptionKey })
  let transaction = false
  let attached = false
  let hash = ''
  try {
    target.loadExtension(Platform.OS === 'ios' ? getDylibPath('co.powersync.sqlitecore', 'powersync-sqlite-core') : 'libpowersync', 'sqlite3_powersync_init')
    // La URI obliga a abrir la fuente en solo lectura, incluidos sus cambios WAL.
    onStage('attach-readonly')
    const sourceUri = `${source.uri}?mode=ro`
    await target.execute("ATTACH DATABASE ? AS legacy KEY ''", [sourceUri])
    attached = true
    onStage('ownership')
    const owners = await rows<{ id: string }>(target, 'SELECT id FROM legacy.perfil WHERE deleted_at IS NULL')
    if (owners.length !== 1 || owners[0]?.id !== userId) {
      throw new StorageError('legacy-database', 'La base anterior no se puede atribuir de forma segura a esta cuenta. No se modificó.')
    }
    const version = (await rows<{ user_version: number }>(target, 'PRAGMA legacy.user_version'))[0]?.user_version ?? 0
    const application = (await rows<{ application_id: number }>(target, 'PRAGMA legacy.application_id'))[0]?.application_id ?? 0
    const vacuum = (await rows<{ auto_vacuum: number }>(target, 'PRAGMA legacy.auto_vacuum'))[0]?.auto_vacuum ?? 0
    if (![0, 1, 2].includes(vacuum) || !Number.isInteger(version) || !Number.isInteger(application)) throw new Error('Metadatos no válidos')
    await target.execute(`PRAGMA main.auto_vacuum = ${vacuum}`)
    await target.execute('BEGIN')
    transaction = true
    onStage('source-fingerprint')
    hash = await fingerprint(target, 'legacy')
    onStage('export')
    await target.execute("SELECT sqlcipher_export('main', 'legacy')")
    await target.execute(`PRAGMA main.user_version = ${version}`)
    await target.execute(`PRAGMA main.application_id = ${application}`)
    onStage('copy-fingerprint')
    if (await fingerprint(target, 'main') !== hash) throw new Error('La copia no conserva todas las estructuras')
    const integrity = await rows<{ integrity_check: string }>(target, 'PRAGMA main.integrity_check')
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') throw new Error('Integridad no confirmada')
    await target.execute('COMMIT')
    transaction = false
    await target.execute('DETACH DATABASE legacy')
    attached = false
  } catch (error) {
    if (transaction) await target.execute('ROLLBACK').catch(() => {})
    if (error instanceof StorageError) throw error
    throw new StorageError('legacy-database', 'No se pudo verificar la migración completa. Conservamos el original y la copia sin activar.')
  } finally {
    if (attached) await target.execute('DETACH DATABASE legacy').catch(() => {})
    await target.closeAsync()
  }
  onStage('reopen-correct-key')
  const verified = open({ name: filename, location, encryptionKey, readOnly: true })
  try { await verified.execute('SELECT count(*) FROM sqlite_schema') } finally { await verified.closeAsync() }
  onStage('reject-wrong-key')
  let wrongKeyRejected = false
  const wrong = open({ name: filename, location, encryptionKey: `${encryptionKey[0] === '0' ? '1' : '0'}${encryptionKey.slice(1)}`, readOnly: true })
  try { await wrong.execute('SELECT count(*) FROM sqlite_schema') } catch { wrongKeyRejected = true } finally { await wrong.closeAsync() }
  if (!wrongKeyRejected) throw new StorageError('unsupported-cipher', 'La copia no superó la comprobación de cifrado.')
  return { filename, fingerprint: hash }
}
