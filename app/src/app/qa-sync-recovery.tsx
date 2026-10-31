import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { PowerSyncDatabase } from '@powersync/react-native'
import { AppSchema } from '@vaulto/shared/powersync'
import { aCentavos, desdeCentavos } from '@vaulto/shared/domain'
import * as Crypto from 'expo-crypto'
import { Directory, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'

import { Button } from '@/components/Button'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  accesoResumeSyncQa, evaluarSyncQa, leerEstadoSyncQa, operacionesRemotasSyncQa, puedePrepararSyncQa, registrarEvento,
  type QaSyncPhase, type QaSyncState, type QaTimelineEntry,
} from '@/lib/db/qaSyncRecovery'
import { resolverPropietarioQa, type QaOwner } from '@/lib/db/qaStorageRemote'
import { supabase } from '@/lib/supabase'
import { SupabaseConnector } from '@/lib/sync/SupabaseConnector'
import { SyncRecoveryStore } from '@/lib/sync/SyncRecoveryStore'
import { SyncUploadError } from '@/lib/sync/SyncUploadError'

/**
 * Fixture nativo dev-only de #25: cancelación `requested` pendiente (A/B/A) y reactivación de la subida tras
 * desconectar y restaurar la red SIN reiniciar la app. Usa una base cifrada propia, una llave en el servicio
 * SecureStore de QA y la sesión actual. Nunca toca la base real; el SDK sube solo por el conector real y la
 * anulación pasa por SyncRecoveryStore.requestCancellation, igual que en producción.
 * ?mode=prepare crea el escenario; ?mode=resume lo retoma con el mismo propietario.
 */
const SERVICE = { keychainService: 'vaulto.qa.syncrecovery' }
const STATE_KEY = 'vaulto.qa.syncrecovery.state'
const PROCESS_ID = Crypto.randomUUID()
const POLL_MS = 1000
const BLOCKED_TIMEOUT_MS = 90_000
const DRAIN_TIMEOUT_MS = 180_000
const storage = {
  get: (key: string) => SecureStore.getItemAsync(key, SERVICE),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, SERVICE),
}
const sha = async (value: unknown) => (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, typeof value === 'string' ? value : JSON.stringify(value))).slice(0, 12)

type Report = Record<string, unknown>

async function currentOwner(sessionUserId: string | undefined): Promise<QaOwner> {
  const { data, error } = await supabase.from('espacio_miembro').select('user_id, espacio_id, deleted_at').eq('user_id', sessionUserId ?? '')
  if (error) throw new Error('qa-espacio')
  return resolverPropietarioQa(sessionUserId, data ?? [])
}

async function remoteState(debtId: string) {
  const [pagos, deuda] = await Promise.all([
    supabase.from('pago').select('id, monto').eq('deuda_id', debtId).is('deleted_at', null),
    supabase.from('deuda').select('saldo_pendiente').eq('id', debtId).maybeSingle(),
  ])
  if (pagos.error || deuda.error) throw new Error('qa-remoto')
  return { pagos: pagos.data?.length ?? 0, montos: (pagos.data ?? []).map((item) => desdeCentavos(aCentavos(item.monto))), saldo: deuda.data ? desdeCentavos(aCentavos(deuda.data.saldo_pendiente)) : null }
}

class RecoverySession {
  private events: QaTimelineEntry[] = []
  private timer?: ReturnType<typeof setInterval>
  private stopListening?: () => void
  private connected = false
  private uploadError = 'none'
  private decision: string | null = null
  private outbox = -1
  private requestedAt = 0
  private startedAt = Date.now()
  private finalized: 'passed' | 'failed' | null = null
  private remote: { pagos: number; montos: string[]; saldo: string | null } | null = null
  private polling = false
  private closed = false
  private readonly previousProcess: string

  constructor(
    private readonly db: PowerSyncDatabase,
    private state: QaSyncState,
    private readonly recovery: SyncRecoveryStore,
    private readonly origin: 'prepare' | 'resume',
    private readonly publish: (report: Report) => void,
  ) {
    this.previousProcess = state.processId
  }

  private mark(event: string) { this.events = registrarEvento(this.events, event, new Date()) }

  private async save(phase: QaSyncPhase, queueHash = this.state.queueHash) {
    this.state = { ...this.state, phase, queueHash, processId: PROCESS_ID }
    await storage.set(STATE_KEY, JSON.stringify(this.state))
  }

  async start() {
    this.mark(`start:${this.origin}`)
    const status = this.db.currentStatus
    this.connected = status.connected
    this.stopListening = this.db.registerListener({
      statusChanged: (next) => {
        if (next.connected !== this.connected) { this.connected = next.connected; this.mark(`connected:${next.connected}`) }
        const error = next.uploadError
        const code = !error ? 'none' : error instanceof SyncUploadError ? error.code : 'other'
        if (code !== this.uploadError) { this.uploadError = code; this.mark(`upload-error:${code}`) }
      },
    })
    // Conector y recuperación reales; no se llama a triggerCrudUpload ni se fuerza reconexión.
    await this.db.connect(new SupabaseConnector(this.state.user, this.recovery))
    this.mark('sdk-connect')
    this.timer = setInterval(() => { void this.poll() }, POLL_MS)
    await this.poll()
  }

  async requestCancellation() {
    if (this.decision !== 'blocked') return
    this.requestedAt = Date.now()
    this.mark('requested-by-user')
    await this.recovery.requestCancellation(this.state.batchId)
    await this.poll()
  }

  private async poll() {
    if (this.polling || this.closed) return
    this.polling = true
    try {
      const row = await this.db.getOptional<{ decision: string }>('SELECT decision FROM vaulto_sync_recovery WHERE batch_id = ?', [this.state.batchId])
      const outbox = (await this.db.getOptional<{ n: number }>('SELECT count(*) AS n FROM ps_crud'))?.n ?? 0
      if (outbox !== this.outbox) { this.outbox = outbox; this.mark(`outbox:${outbox}`) }
      const decision = row?.decision ?? null
      if (decision !== this.decision) {
        this.decision = decision
        if (decision) this.mark(decision === 'requested' ? 'requested' : `decision:${decision}`)
        if (decision === 'blocked' && this.state.phase === 'prepared') await this.save('blocked')
        if (decision === 'requested') {
          if (!this.requestedAt) this.requestedAt = Date.now()
          // Guarda estado y huella de cola mientras la anulación sigue pendiente (A/B/A).
          const hash = await sha(await this.db.getAll('SELECT * FROM ps_crud ORDER BY id'))
          if (outbox > 0 && hash !== this.state.queueHash) throw new Error('qa-conservacion')
          await this.save('requested', hash)
        }
      }
      if (!this.finalized && decision === 'cancelled' && outbox === 0) await this.finish()
      this.emit()
    } catch {
      this.publish({ status: 'failed', stage: 'poll', timeline: this.events })
    } finally {
      this.polling = false
    }
  }

  private async finish() {
    this.remote = await remoteState(this.state.debtId)
    const verdict = evaluarSyncQa({
      decision: this.decision, outbox: this.outbox, remotePagos: this.remote.pagos, remoteSaldo: this.remote.saldo, events: this.events.map((item) => item.event),
    })
    this.finalized = verdict.passed ? 'passed' : 'failed'
    this.mark(`verdict:${this.finalized}`)
    if (verdict.passed) await this.save('passed')
  }

  private emit() {
    const elapsed = Date.now() - this.startedAt
    const verdict = evaluarSyncQa({
      decision: this.decision, outbox: this.outbox, remotePagos: this.remote?.pagos ?? -1, remoteSaldo: this.remote?.saldo ?? null, events: this.events.map((item) => item.event),
    })
    void sha(this.state.clientId).then((clientHash) => this.publish({
      status: this.finalized ?? 'running',
      origin: this.origin,
      processId: PROCESS_ID.slice(0, 8),
      connectorCreatedAfterRestart: this.origin === 'resume' && this.previousProcess !== PROCESS_ID,
      reconnectAfterRequestedInProcess: verdict.reconnectAfterRequestedInProcess,
      fixture: { id: this.state.fixtureId, debtId: this.state.debtId, localPaymentId: this.state.localPaymentId, remotePaymentId: this.state.remotePaymentId },
      batchId: this.state.batchId,
      clientIdHash: clientHash,
      queueHash: this.state.queueHash,
      queueEntries: this.state.queueEntries,
      phase: this.state.phase,
      decision: this.decision,
      outbox: this.outbox,
      connected: this.connected,
      uploadError: this.uploadError,
      remote: this.remote ? { pagos: this.remote.pagos, montos: this.remote.montos, saldo: this.remote.saldo } : null,
      timedOut: {
        blocked: this.decision !== 'blocked' && this.decision !== 'requested' && this.decision !== 'cancelled' && elapsed > BLOCKED_TIMEOUT_MS,
        drain: Boolean(this.requestedAt) && this.finalized === null && Date.now() - this.requestedAt > DRAIN_TIMEOUT_MS,
      },
      canRequestCancellation: this.decision === 'blocked',
      timeline: this.events,
    }))
  }

  async close() {
    this.closed = true
    if (this.timer) clearInterval(this.timer)
    this.stopListening?.()
    await this.db.disconnect().catch(() => {})
    await this.db.close().catch(() => {})
  }
}

async function openEncrypted(state: QaSyncState, key: string) {
  const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: state.filename, dbLocation: decodeURIComponent(new URL(state.directoryUri).pathname), sqliteOptions: { encryptionKey: key } },
  })
  await db.init()
  return db
}

async function prepare(owner: QaOwner, publish: (report: Report) => void) {
  if (!puedePrepararSyncQa(await storage.get(STATE_KEY))) {
    publish({ status: 'rejected', reason: 'fixture-pendiente', hint: 'Usa mode=resume; prepare no sobrescribe el fixture pendiente.' })
    return null
  }
  const fixtureId = Crypto.randomUUID()
  const ids = { debtId: Crypto.randomUUID(), remotePaymentId: Crypto.randomUUID(), localPaymentId: Crypto.randomUUID() }
  const directory = new Directory(Paths.document, `qa-sync-recovery-${fixtureId}`)
  const filename = `qa-sync-recovery-${fixtureId}.sqlite`
  const keyName = `key.${fixtureId}`
  let state: QaSyncState = {
    version: 1, fixtureId, user: owner.userId, espacioId: owner.espacioId, directoryUri: directory.uri, filename, keyName, ...ids,
    remoteBatchId: `qa-sr:${fixtureId}:prepare`, batchId: '', clientId: '', queueHash: '', queueEntries: 0, phase: 'init', processId: PROCESS_ID,
  }
  const key = Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join('')
  // Se reserva el estado y la llave antes de crear nada remoto: un prepare repetido ya no puede pisarlos.
  await storage.set(keyName, key)
  await storage.set(STATE_KEY, JSON.stringify(state))

  publish({ status: 'running', stage: 'remote-prepare' })
  const now = new Date().toISOString()
  const { data, error } = await supabase.rpc('aplicar_lote_sync', { p_lote_id: state.remoteBatchId, p_operaciones: operacionesRemotasSyncQa(owner, ids, now) })
  if (error || data?.status !== 'applied') throw new Error('qa-remoto-prepare')

  publish({ status: 'running', stage: 'local-fixture' })
  directory.create({ intermediates: true })
  const db = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: filename, dbLocation: decodeURIComponent(new URL(directory.uri).pathname), sqliteOptions: { encryptionKey: key } } })
  await db.init()
  try {
    // Atribución y deuda sembradas en las tablas internas ps_data__*: no generan CRUD ni se suben.
    await db.execute("INSERT INTO ps_data__perfil (id, data) VALUES (?, json_object('espacio_id', ?, 'nombre', 'QA', 'onboarding_completo', 1))", [owner.userId, owner.espacioId])
    await db.execute(
      "INSERT INTO ps_data__deuda (id, data) VALUES (?, json_object('espacio_id', ?, 'direccion', 'yo_debo', 'contraparte', 'QA recuperación', 'monto_inicial', '100.00', 'saldo_pendiente', '100.00', 'currency', 'COP', 'estado', 'activa', 'prioridad', 0, 'created_at', ?, 'updated_at', ?))",
      [ids.debtId, owner.espacioId, now, now],
    )
    if (((await db.getOptional<{ n: number }>('SELECT count(*) AS n FROM ps_crud'))?.n ?? -1) !== 0) throw new Error('qa-crud-previo')
    await db.writeTransaction(async (tx) => {
      await tx.execute('INSERT INTO pago (id, espacio_id, deuda_id, monto, currency, fecha) VALUES (?, ?, ?, ?, ?, ?)', [ids.localPaymentId, owner.espacioId, ids.debtId, '60.00', 'COP', now])
      await tx.execute("UPDATE deuda SET saldo_pendiente = '40.00' WHERE id = ?", [ids.debtId])
    })
    const queue = await db.getAll<{ id: number }>('SELECT * FROM ps_crud ORDER BY id')
    if (queue.length !== 2) throw new Error('qa-cola')
    const clientId = await db.getClientId()
    state = { ...state, clientId, queueHash: await sha(queue), queueEntries: queue.length, batchId: `${clientId}:${queue[0]!.id}:${queue[queue.length - 1]!.id}`, phase: 'prepared' }
    await storage.set(STATE_KEY, JSON.stringify(state))
    const recovery = new SyncRecoveryStore(db)
    await recovery.init()
    const session = new RecoverySession(db, state, recovery, 'prepare', publish)
    await session.start()
    return session
  } catch (error) {
    await db.disconnect().catch(() => {})
    await db.close().catch(() => {})
    throw error
  }
}

async function resume(owner: QaOwner, publish: (report: Report) => void) {
  const state = leerEstadoSyncQa(await storage.get(STATE_KEY))
  // Antes de abrir la base o leer la llave: otro usuario solo recibe un rechazo.
  if (accesoResumeSyncQa(state, owner) !== 'permitido') {
    publish({ status: 'rejected', reason: 'propietario-distinto', opened: false, uploaded: false })
    return null
  }
  if (state.phase === 'init' || state.phase === 'passed') {
    publish({ status: 'rejected', reason: state.phase === 'passed' ? 'fixture-completado' : 'fixture-incompleto', opened: false, uploaded: false })
    return null
  }
  const key = await storage.get(state.keyName)
  if (!key) throw new Error('qa-llave')
  const db = await openEncrypted(state, key)
  try {
    const recovery = new SyncRecoveryStore(db)
    await recovery.init()
    const queue = await db.getAll('SELECT * FROM ps_crud ORDER BY id')
    if (queue.length > 0 && (await sha(queue) !== state.queueHash || await db.getClientId() !== state.clientId)) throw new Error('qa-conservacion')
    const session = new RecoverySession(db, state, recovery, 'resume', publish)
    await session.start()
    return session
  } catch (error) {
    await db.disconnect().catch(() => {})
    await db.close().catch(() => {})
    throw error
  }
}

export default function SyncRecoveryQA() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const { session, initializing } = useAuth()
  const userId = session?.user.id
  const router = useRouter()
  const started = useRef(false)
  const active = useRef<RecoverySession | null>(null)
  const owner = useRef<string | null>(null)
  const [report, setReport] = useState<Report>({ status: 'waiting' })

  useEffect(() => {
    if (!__DEV__ || !['prepare', 'resume'].includes(mode ?? '') || started.current || initializing || !userId) return
    started.current = true
    let disposed = false
    let stage = 'owner'
    const publish = (next: Report) => { if (!disposed) setReport(next) }
    void (async () => {
      const current = await currentOwner(userId)
      if (disposed) return
      owner.current = current.userId
      stage = mode ?? 'prepare'
      const opened = mode === 'prepare' ? await prepare(current, publish) : await resume(current, publish)
      if (disposed) await opened?.close()
      else active.current = opened
    })().catch(() => { if (!disposed) setReport({ status: 'failed', stage }) })
    return () => {
      disposed = true
      started.current = false
      const opened = active.current
      active.current = null
      void opened?.close()
    }
  }, [mode, userId, initializing])

  // Un cambio de sesión mientras el fixture está abierto lo cierra: el conector no sube con otra cuenta.
  useEffect(() => {
    if (active.current && owner.current && session?.user.id !== owner.current) {
      void active.current.close()
      active.current = null
      setReport({ status: 'closed', reason: 'sesion-cambiada' })
    }
  }, [session])

  useEffect(() => () => { void active.current?.close() }, [])

  if (!__DEV__) return <Redirect href="/(auth)/login" />
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 56, gap: 12 }}>
      <Text selectable testID="sync-recovery-qa-report">{JSON.stringify(report)}</Text>
      <View style={{ gap: 8 }}>
        <Button label="Solicitar anulación" disabled={report.canRequestCancellation !== true} onPress={() => { void active.current?.requestCancellation() }} />
        <Button label="Ir a Perfil" variant="secondary" onPress={() => router.push('/perfil')} />
      </View>
    </ScrollView>
  )
}
