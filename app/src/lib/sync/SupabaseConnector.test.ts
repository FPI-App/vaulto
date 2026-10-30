import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateType } from '@powersync/react-native'

import { SupabaseConnector } from './SupabaseConnector'
import { SyncUploadError } from './SyncUploadError'
import { SyncRecoveryStore } from './SyncRecoveryStore'
import { testDatabase } from '@/test/sqlite'

const mocks = vi.hoisted(() => ({ session: vi.fn(), createClient: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('@powersync/react-native', () => ({ UpdateType: { PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' } }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fixture')
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'legacy-fixture')
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'a' }, access_token: 'fixture-not-a-real-token' } }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

interface RpcArgs {
  p_lote_id: string
  p_operaciones: { table: string; id: string; op: UpdateType; data: Record<string, unknown> }[]
}

function fixture(op = UpdateType.PATCH) {
  const complete = vi.fn(async () => {})
  const crud = [{ clientId: 1, id: 'QA-deuda', table: 'deuda', op, opData: { nota: 'QA' } }]
  const source = { getClientId: vi.fn(async () => 'QA-device'), getNextCrudTransaction: vi.fn(async () => ({ crud, complete })) }
  const rpc = vi.fn<(name: string, args: RpcArgs) => { throwOnError(): Promise<{ data: unknown }> }>(() => ({ throwOnError: async () => ({ data: { protocol: 1, batch_id: 'QA-device:1:1', status: 'applied' } }) }))
  const from = vi.fn()
  mocks.createClient.mockReturnValue({ rpc, from })
  return { complete, crud, source, rpc, from }
}

describe('Subida atómica ligada a la cuenta propietaria', () => {
  it('mantiene la intención de semilla al reintentar sin marcar otras operaciones', async () => {
    const f = fixture()
    const crud = [
      { clientId: 1, id: 'QA-semilla', table: 'categoria', op: UpdateType.PUT, opData: { nombre: 'Comida' } },
      { clientId: 2, id: 'QA-deuda', table: 'deuda', op: UpdateType.PATCH, opData: { nota: 'QA' } },
    ]
    const source = { getClientId: async () => 'QA-device', getNextCrudTransaction: async () => ({ crud, complete: f.complete }) }
    const seedIntent = vi.fn(async (operation: { id: string }) => operation.id === 'QA-semilla')
    f.rpc.mockReturnValue({ throwOnError: async () => ({ data: { protocol: 1, batch_id: 'QA-device:1:2', status: 'applied' } }) })
    f.complete.mockRejectedValueOnce(new Error('QA interrupción local'))
    const connector = new SupabaseConnector('a', undefined, seedIntent)
    await expect(connector.uploadData(source)).rejects.toMatchObject({ code: 'retry' })
    await connector.uploadData(source)
    expect(f.rpc.mock.calls[0]?.[1]).toEqual(f.rpc.mock.calls[1]?.[1])
    expect(f.rpc.mock.calls[0]?.[1].p_operaciones).toEqual([
      { table: 'categoria', id: 'QA-semilla', op: 'PUT', data: { nombre: 'Comida' }, if_absent: true },
      { table: 'deuda', id: 'QA-deuda', op: 'PATCH', data: { nota: 'QA' } },
    ])
    expect(f.complete).toHaveBeenCalledTimes(2)
  })
  it.each(['cancelled', 'already_applied'])('recupera un abono solicitado con recibo %s, incluso tras perder complete', async (status) => {
    const database = testDatabase()
    try {
      const store = new SyncRecoveryStore(database.queries)
      await store.init()
      const f = fixture()
      const crud = [
        { clientId: 1, id: 'QA-pago', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'QA-deuda', monto: '60.00' } },
        { clientId: 2, id: 'QA-deuda', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '40.00' } },
      ]
      const operations = crud.map((op) => ({ table: op.table, id: op.id, op: op.op, data: op.opData }))
      await store.record('QA-device:1:2', operations)
      await store.requestCancellation('QA-device:1:2')
      f.rpc.mockReturnValue({ throwOnError: async () => ({ data: { protocol: 1, batch_id: 'QA-device:1:2', status } }) })
      const source = { getClientId: async () => 'QA-device', getNextCrudTransaction: async () => ({ crud, complete: f.complete }) }
      f.complete.mockRejectedValueOnce(new Error('QA interrupción local'))
      await expect(new SupabaseConnector('a', store).uploadData(source)).rejects.toMatchObject({ code: 'retry' })
      await new SupabaseConnector('a', new SyncRecoveryStore(database.queries)).uploadData(source)
      expect(f.rpc.mock.calls[0]?.[0]).toBe('cancelar_lote_abono')
      expect(f.rpc.mock.calls[0]?.[1]).toEqual(f.rpc.mock.calls[1]?.[1])
      expect((await store.get('QA-device:1:2', operations))?.decision).toBe(status === 'cancelled' ? 'cancelled' : 'applied')
      expect(f.complete).toHaveBeenCalledTimes(2)
    } finally { database.close() }
  })
  describe('recuperación de abonos con anulación pendiente', () => {
    const crud = [
      { clientId: 1, id: 'QA-pago', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'QA-deuda', monto: '60.00' } },
      { clientId: 2, id: 'QA-deuda', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '40.00' } },
    ]
    const operations = crud.map((op) => ({ table: op.table, id: op.id, op: op.op, data: op.opData }))
    const rechazo = { throwOnError: async () => { throw { code: '23514', message: 'QA-private-detail' } } }
    const sesion = (id: string) => mocks.session.mockResolvedValue({ data: { session: { user: { id }, access_token: 'fixture-not-a-real-token' } }, error: null })
    const recibo = (status: string) => ({ throwOnError: async () => ({ data: { protocol: 1, batch_id: 'QA-device:1:2', status } }) })

    it('conserva la anulación solicitada al cambiar de cuenta y la retoma al volver, sin llamar al servidor con la otra sesión', async () => {
      const cuentaA = testDatabase()
      try {
        const store = new SyncRecoveryStore(cuentaA.queries)
        await store.init()
        const f = fixture()
        const source = { getClientId: async () => 'QA-device', getNextCrudTransaction: async () => ({ crud, complete: f.complete }) }
        f.rpc.mockReturnValueOnce(rechazo)
        await expect(new SupabaseConnector('a', store).uploadData(source)).rejects.toMatchObject({ code: 'conflict' })
        await store.requestCancellation('QA-device:1:2')

        sesion('b')
        f.rpc.mockClear()
        await expect(new SupabaseConnector('a', store).uploadData(source)).rejects.toThrow('sesión cambió')
        expect(f.rpc).not.toHaveBeenCalled()
        expect(f.complete).not.toHaveBeenCalled()
        expect((await store.get('QA-device:1:2', operations))?.decision).toBe('requested')

        sesion('a')
        f.rpc.mockReturnValue(recibo('cancelled'))
        await new SupabaseConnector('a', new SyncRecoveryStore(cuentaA.queries)).uploadData(source)
        expect(f.rpc).toHaveBeenCalledTimes(1)
        expect(f.rpc.mock.calls[0]?.[0]).toBe('cancelar_lote_abono')
        expect((await store.get('QA-device:1:2', operations))?.decision).toBe('cancelled')
        expect(f.complete).toHaveBeenCalledOnce()
      } finally { cuentaA.close() }
    })
    it('no aplica a otra cuenta la anulación registrada en la base de la primera', async () => {
      const cuentaA = testDatabase()
      const cuentaB = testDatabase()
      try {
        const storeA = new SyncRecoveryStore(cuentaA.queries)
        const storeB = new SyncRecoveryStore(cuentaB.queries)
        await storeA.init()
        await storeB.init()
        await storeA.record('QA-device:1:2', operations)
        await storeA.requestCancellation('QA-device:1:2')
        const f = fixture()
        const source = { getClientId: async () => 'QA-device', getNextCrudTransaction: async () => ({ crud, complete: f.complete }) }
        sesion('b')
        f.rpc.mockReturnValue(recibo('applied'))
        await new SupabaseConnector('b', storeB).uploadData(source)
        expect(f.rpc.mock.calls[0]?.[0]).toBe('aplicar_lote_sync')
        expect(await storeB.get('QA-device:1:2', operations)).toBeNull()
        expect((await storeA.get('QA-device:1:2', operations))?.decision).toBe('requested')
      } finally { cuentaA.close(); cuentaB.close() }
    })
    it('tras perder la respuesta de la anulación reenvía el mismo payload y completa la cola una sola vez (no simula recibos del servidor)', async () => {
      const database = testDatabase()
      try {
        const store = new SyncRecoveryStore(database.queries)
        await store.init()
        await store.record('QA-device:1:2', operations)
        await store.requestCancellation('QA-device:1:2')
        const f = fixture()
        const source = { getClientId: async () => 'QA-device', getNextCrudTransaction: async () => ({ crud, complete: f.complete }) }
        f.rpc.mockReturnValueOnce({ throwOnError: async () => { throw { code: 'NETWORK', message: 'QA-private-detail' } } })
        await expect(new SupabaseConnector('a', store).uploadData(source)).rejects.toMatchObject({ code: 'retry' })
        expect((await store.get('QA-device:1:2', operations))?.decision).toBe('requested')
        expect(f.complete).not.toHaveBeenCalled()
        f.rpc.mockReturnValue(recibo('cancelled'))
        await new SupabaseConnector('a', store).uploadData(source)
        expect(f.rpc.mock.calls.map((call) => call[0])).toEqual(['cancelar_lote_abono', 'cancelar_lote_abono'])
        expect(f.rpc.mock.calls[0]?.[1]).toEqual(f.rpc.mock.calls[1]?.[1])
        expect(f.complete).toHaveBeenCalledOnce()
      } finally { database.close() }
    })
    it('en reintentos manuales registra el rechazo una sola vez y aplica con el mismo lote (no simula reconexión automática)', async () => {
      const database = testDatabase()
      try {
        const store = new SyncRecoveryStore(database.queries)
        await store.init()
        const f = fixture()
        const source = { getClientId: async () => 'QA-device', getNextCrudTransaction: async () => ({ crud, complete: f.complete }) }
        f.rpc.mockReturnValueOnce(rechazo).mockReturnValueOnce(rechazo)
        const connector = new SupabaseConnector('a', store)
        await expect(connector.uploadData(source)).rejects.toMatchObject({ code: 'conflict' })
        await expect(connector.uploadData(source)).rejects.toMatchObject({ code: 'conflict' })
        expect(await database.queries.getOptional('SELECT count(*) n FROM vaulto_sync_recovery')).toEqual({ n: 1 })
        f.rpc.mockReturnValue(recibo('applied'))
        await connector.uploadData(source)
        expect(new Set(f.rpc.mock.calls.map((call) => call[1].p_lote_id))).toEqual(new Set(['QA-device:1:2']))
        expect((await store.get('QA-device:1:2', operations))?.decision).toBe('applied')
        expect(f.complete).toHaveBeenCalledOnce()
      } finally { database.close() }
    })
  })
  it('no lee la cola ni crea un cliente cuando la sesión pertenece a otra cuenta', async () => {
    const f = fixture()
    mocks.createClient.mockClear()
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'b' } } }, error: null })
    const connector = new SupabaseConnector('a')
    await expect(connector.fetchCredentials()).rejects.toThrow('sesión cambió')
    await expect(connector.uploadData(f.source)).rejects.toThrow('sesión cambió')
    expect(f.source.getNextCrudTransaction).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('no sube cuando la sesión está cerrada', async () => {
    const f = fixture()
    mocks.session.mockResolvedValue({ data: { session: null }, error: null })
    await expect(new SupabaseConnector('a').uploadData(f.source)).rejects.toThrow('sesión cambió')
    expect(f.complete).not.toHaveBeenCalled()
  })
  it('no solicita RPC si la cola está vacía', async () => {
    const getNextCrudTransaction = vi.fn(async () => null)
    await new SupabaseConnector('a').uploadData({ getNextCrudTransaction, getClientId: vi.fn(async () => 'QA') })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('envía el lote entero una vez y solo completa tras un recibo válido', async () => {
    const f = fixture()
    f.crud.push({ clientId: 2, id: 'QA-segunda', table: 'deuda', op: UpdateType.PUT, opData: { nota: 'QA' } })
    f.rpc.mockReturnValue({ throwOnError: async () => ({ data: { protocol: 1, batch_id: 'QA-device:1:2', status: 'applied' } }) })
    await new SupabaseConnector('a').uploadData(f.source)
    expect(f.rpc).toHaveBeenCalledTimes(1)
    expect(f.rpc).toHaveBeenCalledWith('aplicar_lote_sync', {
      p_lote_id: 'QA-device:1:2', p_operaciones: f.crud.map((op) => ({ table: op.table, id: op.id, op: op.op, data: op.opData })),
    })
    expect(f.from).not.toHaveBeenCalled()
    expect(f.complete).toHaveBeenCalledOnce()
    expect(mocks.createClient.mock.calls[0]?.[1]).toBe('sb_publishable_fixture')
    expect(mocks.createClient.mock.calls[0]?.[2].auth.persistSession).toBe(false)
  })
  it('reintenta con la misma identidad después de perder la confirmación local', async () => {
    const f = fixture(UpdateType.DELETE)
    f.complete.mockRejectedValueOnce(new Error('QA complete failure'))
    const connector = new SupabaseConnector('a')
    await expect(connector.uploadData(f.source)).rejects.toThrow('cola local se conservó')
    f.rpc.mockReturnValue({ throwOnError: async () => ({ data: { protocol: 1, batch_id: 'QA-device:1:1', status: 'already_applied' } }) })
    await connector.uploadData(f.source)
    expect(f.rpc.mock.calls[0]).toEqual(f.rpc.mock.calls[1])
    expect(f.rpc.mock.calls[1]?.[1].p_operaciones[0]).toMatchObject({ op: 'DELETE', data: { nota: 'QA' } })
    expect(f.complete).toHaveBeenCalledTimes(2)
  })
  it.each([
    ['PGRST202', 'backend'], ['23514', 'conflict'], ['42501', 'conflict'], ['22023', 'conflict'], ['NETWORK', 'retry'],
  ])('conserva la cola con %s y no expone detalles del servidor', async (code, expected) => {
    const f = fixture()
    f.rpc.mockReturnValue({ throwOnError: async () => { throw { code, message: 'QA-private-detail' } } })
    const failure: unknown = await new SupabaseConnector('a').uploadData(f.source).catch((error: unknown) => error)
    expect(failure).toMatchObject({ name: 'SyncUploadError', code: expected })
    expect(failure).toBeInstanceOf(SyncUploadError)
    if (!(failure instanceof SyncUploadError)) throw new Error('Se esperaba un error sanitizado')
    expect(failure.message).not.toContain('QA-private-detail')
    expect(f.complete).not.toHaveBeenCalled()
    expect(f.from).not.toHaveBeenCalled()
  })
  it.each([null, { protocol: 2 }, { protocol: 1, batch_id: 'otro', status: 'applied' }])('rechaza recibos incompatibles (%j)', async (data) => {
    const f = fixture()
    f.rpc.mockReturnValue({ throwOnError: async () => ({ data }) })
    await expect(new SupabaseConnector('a').uploadData(f.source)).rejects.toMatchObject({ code: 'protocol' })
    expect(f.complete).not.toHaveBeenCalled()
  })
  it('rechaza identidades locales inseguras antes de llamar al servidor', async () => {
    const f = fixture()
    f.crud.splice(0, 1, { clientId: Number.MAX_SAFE_INTEGER + 1, id: 'QA', table: 'deuda', op: UpdateType.PATCH, opData: { nota: 'QA' } })
    await expect(new SupabaseConnector('a').uploadData(f.source)).rejects.toMatchObject({ code: 'protocol' })
    expect(f.rpc).not.toHaveBeenCalled()
    expect(f.complete).not.toHaveBeenCalled()
  })
  it('sanitiza también los errores al leer la identidad de la base', async () => {
    const f = fixture()
    f.source.getClientId.mockRejectedValueOnce(new Error('QA-private-storage-detail'))
    await expect(new SupabaseConnector('a').uploadData(f.source)).rejects.toMatchObject({ code: 'retry' })
    expect(f.rpc).not.toHaveBeenCalled()
    expect(f.complete).not.toHaveBeenCalled()
  })
})
