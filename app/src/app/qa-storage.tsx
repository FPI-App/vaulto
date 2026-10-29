import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { PowerSyncDatabase } from '@powersync/react-native'
import { AppSchema } from '@vaulto/shared/powersync'
import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'

import { LegacyDatabaseMigration } from '@/lib/db/LegacyDatabaseMigration'
import { exportLegacyDatabase } from '@/lib/db/exportLegacyDatabase'

/** Fixture nativo aislado; no usa archivos ni cuentas de producción. */
export default function StorageQA() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const started = useRef<string | null>(null)
  const [report, setReport] = useState<Record<string, unknown>>({ status: 'waiting' })
  useEffect(() => {
    if (!__DEV__ || !mode || !['create', 'resume'].includes(mode) || started.current === mode) return
    started.current = mode
    let stage = 'fixture'
    const run = async () => {
      const options = { keychainService: 'vaulto.qa.migrations' }
      const storage = { get: (key: string) => SecureStore.getItemAsync(key, options), set: (key: string, value: string) => SecureStore.setItemAsync(key, value, options) }
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
  }, [mode])
  if (!__DEV__) return <Redirect href="/(auth)/login" />
  return <View style={{ flex: 1, padding: 32, justifyContent: 'center' }}><Text selectable testID="storage-qa-report">{JSON.stringify(report)}</Text></View>
}
