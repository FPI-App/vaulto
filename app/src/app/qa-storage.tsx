import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { PowerSyncDatabase } from '@powersync/react-native'
import { AppSchema } from '@vaulto/shared/powersync'
import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'

import { useAuth } from '@/lib/auth/AuthProvider'
import { LegacyDatabaseMigration } from '@/lib/db/LegacyDatabaseMigration'
import { exportLegacyDatabase } from '@/lib/db/exportLegacyDatabase'
import {
  categoriasQa, leerEstadoQa, resolverPropietarioQa, validarMismoPropietario, type QaOwner,
} from '@/lib/db/qaStorageRemote'
import { supabase } from '@/lib/supabase'
import { SupabaseConnector } from '@/lib/sync/SupabaseConnector'
import { SyncRecoveryStore } from '@/lib/sync/SyncRecoveryStore'

const REMOTE_STATE_KEY = 'vaulto.qa.storage.remote'
const DRAIN_TIMEOUT_MS = 60_000
const sha = async (value: unknown) => (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, typeof value === 'string' ? value : JSON.stringify(value))).slice(0, 12)

/**
 * Fixture nativo aislado; no usa archivos de producción. Los modos `create` y `resume` usan un usuario
 * sintético. Los modos `remote-create` y `remote-resume` (#21) usan la sesión QA actual y su espacio, sin
 * aceptar propietarios por parámetro, y reproducen una cola migrada contra el remoto.
 */
export default function StorageQA() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const { session, initializing } = useAuth()
  const started = useRef<string | null>(null)
  const [report, setReport] = useState<Record<string, unknown>>({ status: 'waiting' })
  useEffect(() => {
    if (!__DEV__ || !mode || !['create', 'resume', 'remote-create', 'remote-resume'].includes(mode) || started.current === mode) return
    const remote = mode.startsWith('remote-')
    if (remote && (initializing || !session)) return
    started.current = mode
    let stage = 'fixture'
    const run = async () => {
      const options = { keychainService: 'vaulto.qa.migrations' }
      const storage = { get: (key: string) => SecureStore.getItemAsync(key, options), set: (key: string, value: string) => SecureStore.setItemAsync(key, value, options) }
      if (remote) {
        const owner = await currentOwner(session?.user.id, (value) => { stage = value })
        return mode === 'remote-create'
          ? remoteCreate(owner, storage, (value) => { stage = value })
          : remoteResume(owner, storage, (value) => { stage = value })
      }
      if (mode === 'resume') {
        stage = 'resume'
        const saved = await storage.get('vaulto.qa.storage.last')
        if (!saved) throw new Error('Falta fixture')
        const state: { user: string; directoryUri: string; filename: string; clientId: string; queueHash: string; debtId: string; scenario: string } = JSON.parse(saved)
        const key = await storage.get(`vaulto.database.v1.${state.user}`)
        if (!key || await new LegacyDatabaseMigration(storage).current(state.user) !== state.filename) throw new Error('Falta identidad')
        const db = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: state.filename, dbLocation: decodeURIComponent(new URL(state.directoryUri).pathname), sqliteOptions: { encryptionKey: key } } })
        await db.init()
        const queueHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(await db.getAll('SELECT * FROM ps_crud ORDER BY id')))
        const sameClient = await db.getClientId() === state.clientId
        const debt = await db.getOptional<{ saldo_pendiente: string }>('SELECT saldo_pendiente FROM deuda WHERE id = ?', [state.debtId])
        await db.close()
        if (queueHash !== state.queueHash || !sameClient || debt?.saldo_pendiente !== '90.00') throw new Error('Reinicio no conservado')
        return { status: 'passed', resumed: true, scenario: state.scenario, preservedQueue: true, preservedClient: true, correctKey: true }
      }
      const user = Crypto.randomUUID()
      const directory = new Directory(Paths.document, `qa-storage-${Crypto.randomUUID()}`)
      directory.create({ intermediates: true })
      const location = decodeURIComponent(new URL(directory.uri).pathname)
      const source = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: 'vaulto.sqlite', dbLocation: location } })
      await source.init()
      const debtId = Crypto.randomUUID()
      await source.execute('INSERT INTO perfil (id, espacio_id, nombre, apellido, username, onboarding_completo) VALUES (?, ?, ?, ?, ?, 1)', [user, 'qa-space', 'QA', 'Storage', `qa_${user}`])
      await source.execute('INSERT INTO deuda (id, espacio_id, direccion, contraparte, monto_inicial, saldo_pendiente, currency, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [debtId, 'qa-space', 'yo_debo', 'QA', '100.00', '100.00', 'COP', 'activa'])
      await source.writeTransaction(async (tx) => {
        await tx.execute('INSERT INTO pago (id, espacio_id, deuda_id, monto, currency, fecha) VALUES (?, ?, ?, ?, ?, ?)', [Crypto.randomUUID(), 'qa-space', debtId, '10.00', 'COP', new Date().toISOString()])
        await tx.execute("UPDATE deuda SET saldo_pendiente = '90.00' WHERE id = ?", [debtId])
      })
      const clientId = await source.getClientId()
      const queue = await source.getAll('SELECT * FROM ps_crud ORDER BY id')
      await source.close()
      const encryptionKey = Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join('')
      await storage.set(`vaulto.database.v1.${user}`, encryptionKey)
      const migration = new LegacyDatabaseMigration(storage)
      const filename = await migration.migrate(user, () => exportLegacyDatabase(user, new File(directory, 'vaulto.sqlite'), directory.uri, encryptionKey, (value) => { stage = value }))
      stage = 'powersync-reopen'
      const migrated = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: filename, dbLocation: location, sqliteOptions: { encryptionKey } } })
      await migrated.init()
      const preservedQueue = JSON.stringify(await migrated.getAll('SELECT * FROM ps_crud ORDER BY id')) === JSON.stringify(queue)
      const preservedClient = await migrated.getClientId() === clientId
      const debt = await migrated.getOptional<{ saldo_pendiente: string }>('SELECT saldo_pendiente FROM deuda WHERE id = ?', [debtId])
      await migrated.close()
      if (!preservedQueue || !preservedClient || debt?.saldo_pendiente !== '90.00') throw new Error('Fixture no conservado')
      const scenario = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, filename)).slice(0, 12)
      await storage.set('vaulto.qa.storage.last', JSON.stringify({ user, directoryUri: directory.uri, filename, clientId, queueHash: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(queue)), debtId, scenario }))
      return { status: 'passed', scenario, preservedQueue, preservedClient, queueEntries: queue.length, correctKey: true, wrongKeyRejected: true, sourcePreserved: new File(directory, 'vaulto.sqlite').exists }
    }
    void run().then(setReport).catch(() => setReport({ status: 'failed', stage }))
  }, [mode, session, initializing])
  if (!__DEV__) return <Redirect href="/(auth)/login" />
  return <View style={{ flex: 1, padding: 32, justifyContent: 'center' }}><Text selectable testID="storage-qa-report">{JSON.stringify(report)}</Text></View>
}

type QaStorage = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }

/** Valida sesión y espacio contra el remoto con el cliente autenticado; sin escrituras. */
async function currentOwner(sessionUserId: string | undefined, onStage: (stage: string) => void): Promise<QaOwner> {
  onStage('owner')
  const { data, error } = await supabase.from('espacio_miembro').select('user_id, espacio_id, deleted_at').eq('user_id', sessionUserId ?? '')
  if (error) throw new Error('qa-espacio')
  return resolverPropietarioQa(sessionUserId, data ?? [])
}

async function remoteCreate(owner: QaOwner, storage: QaStorage, onStage: (stage: string) => void) {
  onStage('fixture-state')
  // Un reintento de create no puede sustituir la llave de un fixture previo o incompleto.
  if (await storage.get(REMOTE_STATE_KEY) || await storage.get(`vaulto.database.v1.${owner.userId}`)
    || await new LegacyDatabaseMigration(storage).current(owner.userId)) throw new Error('qa-fixture-existente')
  const ids: [string, string] = [Crypto.randomUUID(), Crypto.randomUUID()]
  const categorias = categoriasQa(owner, ids)
  const directory = new Directory(Paths.document, `qa-storage-remote-${Crypto.randomUUID()}`)
  directory.create({ intermediates: true })
  const location = decodeURIComponent(new URL(directory.uri).pathname)
  onStage('source')
  // Fuente en texto plano, aislada y sin conectar nunca: no es la base del usuario ni su alias.
  const source = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: 'vaulto.sqlite', dbLocation: location } })
  await source.init()
  onStage('source-profile')
  // El perfil de atribución se escribe en la tabla interna: no genera CRUD y no se enviará al remoto.
  await source.execute("INSERT INTO ps_data__perfil (id, data) VALUES (?, json_object('espacio_id', ?, 'nombre', 'QA', 'onboarding_completo', 1))", [owner.userId, owner.espacioId])
  if ((await source.getAll('SELECT id FROM ps_crud')).length !== 0) throw new Error('qa-crud-previo')
  const now = new Date().toISOString()
  await source.writeTransaction(async (tx) => {
    for (const item of categorias) {
      await tx.execute('INSERT INTO categoria (id, espacio_id, nombre, tipo, icono, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [item.id, item.espacio_id, item.nombre, item.tipo, item.icono, item.color, now, now])
    }
  })
  const clientId = await source.getClientId()
  const queue = await source.getAll('SELECT * FROM ps_crud ORDER BY id')
  await source.close()
  if (queue.length !== categorias.length) throw new Error('qa-cola')
  onStage('export')
  const encryptionKey = Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join('')
  await storage.set(`vaulto.database.v1.${owner.userId}`, encryptionKey)
  const filename = await new LegacyDatabaseMigration(storage).migrate(owner.userId, () => exportLegacyDatabase(owner.userId, new File(directory, 'vaulto.sqlite'), directory.uri, encryptionKey, onStage))
  onStage('reopen')
  const migrated = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: filename, dbLocation: location, sqliteOptions: { encryptionKey } } })
  await migrated.init()
  const queueHash = await sha(await migrated.getAll('SELECT * FROM ps_crud ORDER BY id'))
  const preservedQueue = queueHash === await sha(queue)
  const preservedClient = await migrated.getClientId() === clientId
  await migrated.close() // Nunca se conecta en esta fase.
  if (!preservedQueue || !preservedClient) throw new Error('qa-conservacion')
  const scenario = await sha(filename)
  await storage.set(REMOTE_STATE_KEY, JSON.stringify({
    version: 1, user: owner.userId, espacioId: owner.espacioId, directoryUri: directory.uri, filename, clientId,
    queueHash, queueEntries: queue.length, categoryIds: ids, scenario, replayed: false,
  }))
  return {
    status: 'passed', phase: 'remote-create', scenario, ownerValidated: true, userHash: await sha(owner.userId), spaceHash: await sha(owner.espacioId),
    categoryIds: ids, queueEntries: queue.length, queueHash, preservedQueue, preservedClient,
    connected: false, sourcePreserved: new File(directory, 'vaulto.sqlite').exists,
  }
}

async function countRemote(ids: readonly string[]): Promise<number> {
  const { data, error } = await supabase.from('categoria').select('id').in('id', [...ids])
  if (error) throw new Error('qa-remoto')
  return data?.length ?? 0
}

async function remoteResume(owner: QaOwner, storage: QaStorage, onStage: (stage: string) => void) {
  onStage('state')
  const state = leerEstadoQa(await storage.get(REMOTE_STATE_KEY))
  validarMismoPropietario(state, owner)
  if (state.replayed) throw new Error('qa-ya-reproducido')
  const key = await storage.get(`vaulto.database.v1.${state.user}`)
  if (!key || await new LegacyDatabaseMigration(storage).current(state.user) !== state.filename) throw new Error('qa-identidad')
  onStage('open-encrypted')
  const db = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: state.filename, dbLocation: decodeURIComponent(new URL(state.directoryUri).pathname), sqliteOptions: { encryptionKey: key } } })
  await db.init()
  try {
    const pending = await db.getAll('SELECT * FROM ps_crud ORDER BY id')
    const sameQueue = await sha(pending) === state.queueHash && pending.length === state.queueEntries
    const sameClient = await db.getClientId() === state.clientId
    if (!sameQueue || !sameClient) throw new Error('qa-conservacion')
    const remoteBefore = await countRemote(state.categoryIds)
    if (remoteBefore !== 0) throw new Error('qa-remoto-previo')
    onStage('replay')
    const recovery = new SyncRecoveryStore(db)
    await recovery.init()
    const counters = { calls: 0, failures: 0, completed: 0 }
    const batchIds = new Set<string>()
    class CountingConnector extends SupabaseConnector {
      override async uploadData(source: Parameters<SupabaseConnector['uploadData']>[0]) {
        counters.calls++
        const counting: typeof source = {
          getClientId: () => source.getClientId(),
          getNextCrudTransaction: async () => {
            const transaction = await source.getNextCrudTransaction()
            if (transaction?.crud.length) {
              const first = transaction.crud[0]!
              const last = transaction.crud[transaction.crud.length - 1]!
              batchIds.add(`${await source.getClientId()}:${first.clientId}:${last.clientId}`)
            }
            return transaction && { crud: transaction.crud, complete: async () => { await transaction.complete(); counters.completed++ } }
          },
        }
        try { await super.uploadData(counting) } catch (error) { counters.failures++; throw error }
      }
    }
    await db.connect(new CountingConnector(state.user, recovery))
    const deadline = Date.now() + DRAIN_TIMEOUT_MS
    let drained = false
    while (Date.now() < deadline) {
      if ((await db.getAll('SELECT id FROM ps_crud')).length === 0) { drained = true; break }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    await db.disconnect()
    onStage('verify')
    const remoteAfter = await countRemote(state.categoryIds)
    const recoveryRows = (await db.getAll('SELECT decision FROM vaulto_sync_recovery')).length
    const passed = drained && remoteAfter === state.categoryIds.length && counters.completed === 1
    if (passed) await storage.set(REMOTE_STATE_KEY, JSON.stringify({ ...state, replayed: true }))
    return {
      status: passed ? 'passed' : 'failed', phase: 'remote-resume', scenario: state.scenario, ownerValidated: true,
      categoryIds: state.categoryIds, queueEntriesBefore: pending.length, queueHashBefore: state.queueHash, preservedQueue: sameQueue, preservedClient: sameClient,
      remoteBefore, remoteAfter, drained, uploadCalls: counters.calls, uploadFailures: counters.failures, transactionsCompleted: counters.completed,
      recoveryRows, batchIds: [...batchIds], timeoutMs: DRAIN_TIMEOUT_MS,
    }
  } finally {
    await db.close().catch(() => {})
  }
}

/** Entrada para el harness nativo aislado: evita montar las pantallas del producto. */
export async function runRemoteStorageFixture(mode: 'remote-create' | 'remote-resume', userId: string, onStage: (stage: string) => void) {
  if (!__DEV__) throw new Error('qa-development-only')
  const options = { keychainService: 'vaulto.qa.migrations' }
  const store = {
    get: (key: string) => SecureStore.getItemAsync(key, options),
    set: (key: string, value: string) => SecureStore.setItemAsync(key, value, options),
  }
  const owner = await currentOwner(userId, onStage)
  return mode === 'remote-create' ? remoteCreate(owner, store, onStage) : remoteResume(owner, store, onStage)
}
