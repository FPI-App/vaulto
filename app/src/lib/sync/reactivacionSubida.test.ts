// Seam real: el bucle de subida de CRUD es el de @powersync/shared-internals (el que usa el SDK 2.4);
// aquí solo se simulan la red, el adaptador de cola y la primera línea de sync. No ejercita SQLite
// cifrado ni el núcleo Rust: la ejecución nativa sigue pendiente de dispositivo.
import { AbstractStreamingSyncImplementation, resolveSyncOptions, type LockOptions } from '@powersync/shared-internals'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { testDatabase } from '@/test/sqlite'
import { SupabaseConnector } from './SupabaseConnector'
import { SyncRecoveryStore } from './SyncRecoveryStore'

const mocks = vi.hoisted(() => ({ session: vi.fn(), createClient: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('@powersync/react-native', () => ({ UpdateType: { PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' } }))

const RETRY_MS = 40
const BATCH = 'QA-device:1:2'
const crud = [
  { clientId: 1, id: 'QA-pago', table: 'pago', op: 'PUT', opData: { deuda_id: 'QA-deuda', monto: '60.00' } },
  { clientId: 2, id: 'QA-deuda', table: 'deuda', op: 'PATCH', opData: { saldo_pendiente: '40.00' } },
]
const operations = crud.map((op) => ({ table: op.table, id: op.id, op: op.op, data: op.opData }))

class Red {
  up = true
  server: 'rechaza' | 'acepta' = 'rechaza'
  rpcs: string[] = []
  private onDrop?: () => void
  drop() { this.up = false; this.onDrop?.() }
  restore() { this.up = true }
  watch(listener: () => void) { this.onDrop = listener }
}

/** Sustituye solo la conexión: el bucle de subida y sus reintentos son los reales del SDK. */
class SyncDeLaPrueba extends AbstractStreamingSyncImplementation {
  constructor(private readonly red: Red, uploadCrud: () => Promise<void>, adapter: object) {
    super({
      adapter: adapter as never, subscriptions: [], uploadCrud, postCheckpointRequest: () => null,
      logger: { log() {} } as never, remote: {} as never, serializedSchema: {},
    })
  }
  obtainLock<T>(options: LockOptions<T>) { return options.callback() }
  protected override async streamingSyncIteration(signal: AbortSignal) {
    if (!this.red.up) throw new Error('sin red')
    this.updateSyncStatus({ connected: true, connecting: false, priority_status: [], downloading: null, streams: [] })
    this.triggerCrudUpload() // el SDK lo hace al recibir la primera línea de sync
    await new Promise<void>((resolve) => {
      this.red.watch(resolve)
      signal.addEventListener('abort', () => resolve(), { once: true })
    })
    return null
  }
}

let red: Red
let queue: typeof crud
let completes: number
let database: ReturnType<typeof testDatabase>
let store: SyncRecoveryStore
let sync: SyncDeLaPrueba

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fixture')
  mocks.session.mockImplementation(async () => red.up
    ? { data: { session: { user: { id: 'a' }, access_token: 'fixture-not-a-real-token' } }, error: null }
    : { data: { session: null }, error: new Error('sin red') })
  red = new Red()
  queue = [...crud]
  completes = 0
  database = testDatabase()
  store = new SyncRecoveryStore(database.queries)
  await store.init()
  mocks.createClient.mockReturnValue({
    rpc: (name: string) => ({
      throwOnError: async () => {
        red.rpcs.push(name)
        if (!red.up) throw { code: 'NETWORK', message: 'QA-private-detail' }
        if (name === 'cancelar_lote_abono') return { data: { protocol: 1, batch_id: BATCH, status: 'cancelled' } }
        if (red.server === 'rechaza') throw { code: '23514', message: 'QA-private-detail' }
        return { data: { protocol: 1, batch_id: BATCH, status: 'applied' } }
      },
    }),
  })
  const source = {
    getClientId: async () => 'QA-device',
    getNextCrudTransaction: async () => queue.length ? { crud: queue, complete: async () => { completes++; queue = [] } } : null,
  } as unknown as Parameters<SupabaseConnector['uploadData']>[0]
  const connector = new SupabaseConnector('a', store)
  const adapter = {
    nextCrudItem: async () => queue[0],
    updateLocalTarget: async () => false,
    registerListener: () => () => {},
  }
  sync = new SyncDeLaPrueba(red, () => connector.uploadData(source), adapter)
  void sync.connect(resolveSyncOptions({ retryDelayMs: RETRY_MS, crudUploadThrottleMs: 5 }, 'http' as never))
})
afterEach(async () => { await sync.disconnect(); database.close(); vi.unstubAllEnvs() })

const conteo = (name: string) => red.rpcs.filter((rpc) => rpc === name).length

describe('Reactivación de la subida con el bucle real del SDK', () => {
  it('con el stream conectado, el abono rechazado se reintenta solo cada retryDelay y queda registrado una vez', async () => {
    await vi.waitFor(() => expect(conteo('aplicar_lote_sync')).toBeGreaterThanOrEqual(3), { timeout: 2000 })
    expect(await database.queries.getOptional('SELECT count(*) n FROM vaulto_sync_recovery')).toEqual({ n: 1 })
    expect(completes).toBe(0)
  })

  it('una anulación pedida con el stream conectado se envía en el siguiente reintento, sin evento CRUD', async () => {
    await vi.waitFor(() => expect(conteo('aplicar_lote_sync')).toBeGreaterThanOrEqual(1))
    await store.requestCancellation(BATCH)
    await vi.waitFor(() => expect(completes).toBe(1), { timeout: RETRY_MS * 5 })
    expect(red.rpcs.at(-1)).toBe('cancelar_lote_abono')
  })

  it('tras caer la red el bucle se detiene y, al reconectar, la primera línea reactiva la subida pendiente', async () => {
    await vi.waitFor(() => expect(conteo('aplicar_lote_sync')).toBeGreaterThanOrEqual(1))
    red.drop()
    await vi.waitFor(() => expect(sync.isConnected).toBe(false))
    await store.requestCancellation(BATCH) // tabla local: no genera CRUD ni despierta el bucle
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS * 3))
    const sinRed = red.rpcs.length
    expect(completes).toBe(0)
    red.restore()
    await vi.waitFor(() => expect(completes).toBe(1), { timeout: RETRY_MS * 15 })
    expect(red.rpcs.length).toBeGreaterThan(sinRed)
    expect(red.rpcs.at(-1)).toBe('cancelar_lote_abono')
  })

  it('si el servidor acepta el lote tras reconectar, aplica el mismo lote una vez y vacía la cola', async () => {
    await vi.waitFor(() => expect(conteo('aplicar_lote_sync')).toBeGreaterThanOrEqual(1))
    red.drop()
    await vi.waitFor(() => expect(sync.isConnected).toBe(false))
    red.server = 'acepta'
    red.restore()
    await vi.waitFor(() => expect(completes).toBe(1), { timeout: RETRY_MS * 15 })
    expect((await store.get(BATCH, operations))?.decision).toBe('applied')
  })
})
