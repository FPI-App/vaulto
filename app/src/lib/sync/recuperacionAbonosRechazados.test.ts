import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateType } from '@powersync/react-native'

import { testDatabase } from '@/test/sqlite'
import { crearDeuda, registrarAbono } from '@/features/deudas/data/deudasRepo'
import { SupabaseConnector } from './SupabaseConnector'
import { SyncRecoveryStore, type SyncOperation } from './SyncRecoveryStore'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.session,
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@powersync/react-native', () => ({
  UpdateType: { PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co')
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fixture')
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'legacy-fixture')
  mocks.session.mockResolvedValue({
    data: {
      session: {
        user: { id: 'usr-qa-1' },
        access_token: 'fixture-token-qa',
      },
    },
    error: null,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

interface RpcCallArgs {
  p_lote_id: string
  p_operaciones: SyncOperation[]
}

function crearFixtureUpload(operacionesIniciales: { table: string; id: string; op: UpdateType; opData: Record<string, unknown> }[] = []) {
  const complete = vi.fn(async () => {})
  const crud = operacionesIniciales.map((op, idx) => ({
    clientId: idx + 1,
    id: op.id,
    table: op.table,
    op: op.op,
    opData: op.opData,
  }))

  const source = {
    getClientId: vi.fn(async () => 'device-qa-1'),
    getNextCrudTransaction: vi.fn(async () => (crud.length > 0 ? { crud, complete } : null)),
  }

  const rpc = vi.fn<(nombre: string, args: RpcCallArgs) => { throwOnError(): Promise<{ data: unknown }> }>(() => ({
    throwOnError: async () => ({
      data: {
        protocol: 1,
        batch_id: 'device-qa-1:1:' + crud.length,
        status: 'applied',
      },
    }),
  }))

  const from = vi.fn()
  mocks.createClient.mockReturnValue({ rpc, from })

  return { complete, crud, source, rpc, from }
}

describe('QA — Suite de recuperación de abonos rechazados (Issue #25)', () => {
  it('caso 1: deuda 100 con abonos offline 60+60 en dos bases locales', async () => {
    const dispA = testDatabase()
    const dispB = testDatabase()

    try {
      const espacioId = 'esp-qa-shared'
      const now = new Date().toISOString()

      for (const d of [dispA, dispB]) {
        await d.queries.execute(
          'INSERT INTO espacio (id, nombre, owner_user_id, base_currency, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [espacioId, 'Espacio QA', 'usr-qa-1', 'COP', 'CO', now, now],
        )
      }

      const deudaId = await crearDeuda(dispA.db, espacioId, {
        direccion: 'yo_debo',
        contraparte: 'Banco QA',
        monto_inicial: '100.00',
        fecha_limite: null,
        prioridad: 1,
        nota: 'Deuda principal',
      })

      const deudaCreada = await dispA.queries.getOptional<{ monto_inicial: string; saldo_pendiente: string }>(
        'SELECT monto_inicial, saldo_pendiente FROM deuda WHERE id = ?',
        [deudaId],
      )
      expect(deudaCreada).toEqual({ monto_inicial: '100.00', saldo_pendiente: '100.00' })

      await dispB.queries.execute(
        'INSERT INTO deuda (id, espacio_id, direccion, contraparte, monto_inicial, saldo_pendiente, currency, prioridad, estado, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [deudaId, espacioId, 'yo_debo', 'Banco QA', '100.00', '100.00', 'COP', 1, 'activa', now, now],
      )

      await registrarAbono(dispA.db, espacioId, deudaId, '60.00', 'Abono disp A')
      const saldoA = await dispA.queries.getOptional<{ saldo_pendiente: string }>(
        'SELECT saldo_pendiente FROM deuda WHERE id = ?',
        [deudaId],
      )
      expect(saldoA?.saldo_pendiente).toBe('40.00')

      await registrarAbono(dispB.db, espacioId, deudaId, '60.00', 'Abono disp B')
      const saldoB = await dispB.queries.getOptional<{ saldo_pendiente: string }>(
        'SELECT saldo_pendiente FROM deuda WHERE id = ?',
        [deudaId],
      )
      expect(saldoB?.saldo_pendiente).toBe('40.00')

      const pagosA = await dispA.queries.getAll('SELECT * FROM pago WHERE deuda_id = ?', [deudaId])
      const pagosB = await dispB.queries.getAll('SELECT * FROM pago WHERE deuda_id = ?', [deudaId])
      expect(pagosA).toHaveLength(1)
      expect(pagosB).toHaveLength(1)
    } finally {
      dispA.close()
      dispB.close()
    }
  })

  it('caso 2: rechazo visible y detención en la cola al fallar la restricción del servidor', async () => {
    const db = testDatabase()
    try {
      const store = new SyncRecoveryStore(db.queries)
      await store.init()

      const crud = [
        { clientId: 1, id: 'pago-qa-2', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-100', monto: '60.00' } },
        { clientId: 2, id: 'deuda-100', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '40.00' } },
      ]
      const batchId = 'device-qa-1:1:2'
      const operaciones = crud.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      const f = crearFixtureUpload(crud)
      f.rpc.mockReturnValueOnce({
        throwOnError: async () => {
          throw { code: '23514', message: 'Check constraint violation: el saldo no puede ser negativo' }
        },
      })

      const connector = new SupabaseConnector('usr-qa-1', store)
      await expect(connector.uploadData(f.source)).rejects.toMatchObject({
        name: 'SyncUploadError',
        code: 'conflict',
      })

      expect(f.complete).not.toHaveBeenCalled()

      const recovery = await store.get(batchId, operaciones)
      expect(recovery).not.toBeNull()
      expect(recovery?.decision).toBe('blocked')
      expect(recovery?.operations_json).toBe(JSON.stringify(operaciones))
    } finally {
      db.close()
    }
  })

  it('caso 3: anulación explícita del abono en conflicto y liberación de la cola', async () => {
    const db = testDatabase()
    try {
      const store = new SyncRecoveryStore(db.queries)
      await store.init()

      const crud = [
        { clientId: 1, id: 'pago-qa-3', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-100', monto: '60.00' } },
        { clientId: 2, id: 'deuda-100', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '40.00' } },
      ]
      const batchId = 'device-qa-1:1:2'
      const operaciones = crud.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      await store.record(batchId, operaciones)
      await store.requestCancellation(batchId)

      const f = crearFixtureUpload(crud)
      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchId, status: 'cancelled' },
        }),
      })

      const connector = new SupabaseConnector('usr-qa-1', store)
      await connector.uploadData(f.source)

      expect(f.rpc).toHaveBeenCalledTimes(1)
      expect(f.rpc.mock.calls[0]?.[0]).toBe('cancelar_lote_abono')
      expect(f.rpc.mock.calls[0]?.[1]).toEqual({
        p_lote_id: batchId,
        p_operaciones: operaciones,
      })

      expect(f.complete).toHaveBeenCalledOnce()

      const recovery = await store.get(batchId, operaciones)
      expect(recovery?.decision).toBe('cancelled')
    } finally {
      db.close()
    }
  })

  it('caso 4: operación posterior válida procesada exitosamente tras anular el conflicto', async () => {
    const db = testDatabase()
    try {
      const store = new SyncRecoveryStore(db.queries)
      await store.init()

      const crudConflicto = [
        { clientId: 1, id: 'pago-rechazado', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-100', monto: '60.00' } },
        { clientId: 2, id: 'deuda-100', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '40.00' } },
      ]
      const batchIdConflicto = 'device-qa-1:1:2'
      const operacionesConflicto = crudConflicto.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      await store.record(batchIdConflicto, operacionesConflicto)
      await store.requestCancellation(batchIdConflicto)

      const f = crearFixtureUpload(crudConflicto)
      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchIdConflicto, status: 'cancelled' },
        }),
      })

      const connector = new SupabaseConnector('usr-qa-1', store)
      await connector.uploadData(f.source)
      expect(f.complete).toHaveBeenCalledTimes(1)

      const crudPosterior = [
        { clientId: 3, id: 'pago-valido-40', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-100', monto: '40.00' } },
        { clientId: 4, id: 'deuda-100', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '0.00' } },
      ]
      const batchIdPosterior = 'device-qa-1:3:4'
      const operacionesPosterior = crudPosterior.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      const completePosterior = vi.fn(async () => {})
      const sourcePosterior = {
        getClientId: async () => 'device-qa-1',
        getNextCrudTransaction: async () => ({ crud: crudPosterior, complete: completePosterior }),
      }

      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchIdPosterior, status: 'applied' },
        }),
      })

      await connector.uploadData(sourcePosterior)

      expect(f.rpc).toHaveBeenCalledTimes(2)
      expect(f.rpc.mock.calls[1]?.[0]).toBe('aplicar_lote_sync')
      expect(f.rpc.mock.calls[1]?.[1]).toEqual({
        p_lote_id: batchIdPosterior,
        p_operaciones: operacionesPosterior,
      })
      expect(completePosterior).toHaveBeenCalledOnce()
    } finally {
      db.close()
    }
  })

  it('caso 5: reinicio preserva el estado de recuperación durablemente en SQLite', async () => {
    const db = testDatabase()
    try {
      const storeInicial = new SyncRecoveryStore(db.queries)
      await storeInicial.init()

      const crud = [
        { clientId: 1, id: 'pago-qa-5', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-5', monto: '50.00' } },
        { clientId: 2, id: 'deuda-5', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '50.00' } },
      ]
      const batchId = 'device-qa-1:1:2'
      const operaciones = crud.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      await storeInicial.record(batchId, operaciones)
      await storeInicial.requestCancellation(batchId)

      const storeReabierto = new SyncRecoveryStore(db.queries)
      const recuperado = await storeReabierto.get(batchId, operaciones)
      expect(recuperado).toMatchObject({
        batch_id: batchId,
        decision: 'requested',
        operations_json: JSON.stringify(operaciones),
      })

      const f = crearFixtureUpload(crud)
      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchId, status: 'cancelled' },
        }),
      })

      const connector = new SupabaseConnector('usr-qa-1', storeReabierto)
      await connector.uploadData(f.source)

      expect(f.rpc.mock.calls[0]?.[0]).toBe('cancelar_lote_abono')
      expect(f.complete).toHaveBeenCalledOnce()

      const final = await storeReabierto.get(batchId, operaciones)
      expect(final?.decision).toBe('cancelled')
    } finally {
      db.close()
    }
  })

  it('caso 6: cambio de cuenta con anulación pendiente no expone datos ni envía rpc', async () => {
    const dbCuentaA = testDatabase()
    try {
      const storeA = new SyncRecoveryStore(dbCuentaA.queries)
      await storeA.init()

      const crud = [
        { clientId: 1, id: 'pago-cuenta-a', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-a', monto: '60.00' } },
        { clientId: 2, id: 'deuda-a', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '40.00' } },
      ]
      const batchId = 'device-qa-1:1:2'
      const operaciones = crud.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      await storeA.record(batchId, operaciones)
      await storeA.requestCancellation(batchId)

      const f = crearFixtureUpload(crud)
      const connectorA = new SupabaseConnector('usr-qa-1', storeA)

      mocks.session.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: 'usr-qa-2-intruso' },
            access_token: 'token-intruso',
          },
        },
        error: null,
      })

      await expect(connectorA.uploadData(f.source)).rejects.toThrow('La sesión cambió')
      expect(f.rpc).not.toHaveBeenCalled()
      expect(f.complete).not.toHaveBeenCalled()

      mocks.session.mockResolvedValue({
        data: {
          session: {
            user: { id: 'usr-qa-1' },
            access_token: 'fixture-token-qa',
          },
        },
        error: null,
      })

      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchId, status: 'cancelled' },
        }),
      })

      await connectorA.uploadData(f.source)
      expect(f.rpc).toHaveBeenCalledTimes(1)
      expect(f.rpc.mock.calls[0]?.[0]).toBe('cancelar_lote_abono')
      expect(f.complete).toHaveBeenCalledOnce()
    } finally {
      dbCuentaA.close()
    }
  })

  it('caso 7: reintento tras reconexión conserva decisión requested y retransmite', async () => {
    const db = testDatabase()
    try {
      const store = new SyncRecoveryStore(db.queries)
      await store.init()

      const crud = [
        { clientId: 1, id: 'pago-reintento', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-r', monto: '30.00' } },
        { clientId: 2, id: 'deuda-r', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '70.00' } },
      ]
      const batchId = 'device-qa-1:1:2'
      const operaciones = crud.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      await store.record(batchId, operaciones)
      await store.requestCancellation(batchId)

      const f = crearFixtureUpload(crud)
      f.rpc.mockReturnValueOnce({
        throwOnError: async () => {
          throw { code: 'NETWORK', message: 'Falla transitoria de red' }
        },
      })

      const connector = new SupabaseConnector('usr-qa-1', store)
      await expect(connector.uploadData(f.source)).rejects.toMatchObject({
        name: 'SyncUploadError',
        code: 'retry',
      })

      expect((await store.get(batchId, operaciones))?.decision).toBe('requested')
      expect(f.complete).not.toHaveBeenCalled()

      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchId, status: 'cancelled' },
        }),
      })

      await connector.uploadData(f.source)
      expect(f.rpc).toHaveBeenCalledTimes(2)
      expect(f.rpc.mock.calls[0]?.[0]).toBe('cancelar_lote_abono')
      expect(f.rpc.mock.calls[1]?.[0]).toBe('cancelar_lote_abono')
      expect(f.complete).toHaveBeenCalledOnce()
      expect((await store.get(batchId, operaciones))?.decision).toBe('cancelled')
    } finally {
      db.close()
    }
  })

  it('caso 8: pérdida de respuesta sin duplicados manejada con recibo already_applied', async () => {
    const db = testDatabase()
    try {
      const store = new SyncRecoveryStore(db.queries)
      await store.init()

      const crud = [
        { clientId: 1, id: 'pago-dup', table: 'pago', op: UpdateType.PUT, opData: { deuda_id: 'deuda-dup', monto: '60.00' } },
        { clientId: 2, id: 'deuda-dup', table: 'deuda', op: UpdateType.PATCH, opData: { saldo_pendiente: '40.00' } },
      ]
      const batchId = 'device-qa-1:1:2'
      const operaciones = crud.map((c) => ({ table: c.table, id: c.id, op: c.op, data: c.opData }))

      await store.record(batchId, operaciones)
      await store.requestCancellation(batchId)

      const f = crearFixtureUpload(crud)
      f.complete.mockRejectedValueOnce(new Error('Fallo local al confirmar'))
      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchId, status: 'cancelled' },
        }),
      })

      const connector = new SupabaseConnector('usr-qa-1', store)
      await expect(connector.uploadData(f.source)).rejects.toThrow()

      f.rpc.mockReturnValueOnce({
        throwOnError: async () => ({
          data: { protocol: 1, batch_id: batchId, status: 'already_applied' },
        }),
      })

      await connector.uploadData(f.source)

      expect(f.rpc).toHaveBeenCalledTimes(2)
      expect(f.complete).toHaveBeenCalledTimes(2)
      expect((await store.get(batchId, operaciones))?.decision).toBe('applied')
    } finally {
      db.close()
    }
  })

  it('caso 9: aislamiento de usuario y espacio en tablas locales y sync', async () => {
    const db = testDatabase()
    try {
      const now = new Date().toISOString()
      const espacio1 = 'esp-qa-1'
      const espacio2 = 'esp-qa-2'

      await db.queries.execute(
        'INSERT INTO espacio (id, nombre, owner_user_id, base_currency, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [espacio1, 'Espacio 1', 'usr-qa-1', 'COP', 'CO', now, now],
      )
      await db.queries.execute(
        'INSERT INTO espacio (id, nombre, owner_user_id, base_currency, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [espacio2, 'Espacio 2', 'usr-qa-2', 'COP', 'CO', now, now],
      )

      const deudaId1 = await crearDeuda(db.db, espacio1, {
        direccion: 'yo_debo',
        contraparte: 'Persona A',
        monto_inicial: '100.00',
        fecha_limite: null,
        prioridad: 2,
        nota: null,
      })

      const deudaId2 = await crearDeuda(db.db, espacio2, {
        direccion: 'me_deben',
        contraparte: 'Persona B',
        monto_inicial: '200.00',
        fecha_limite: null,
        prioridad: 1,
        nota: null,
      })
      expect(deudaId2).toBeDefined()

      await registrarAbono(db.db, espacio1, deudaId1, '50.00')

      const pagosEspacio1 = await db.queries.getAll('SELECT * FROM pago WHERE espacio_id = ?', [espacio1])
      const pagosEspacio2 = await db.queries.getAll('SELECT * FROM pago WHERE espacio_id = ?', [espacio2])

      expect(pagosEspacio1).toHaveLength(1)
      expect(pagosEspacio2).toHaveLength(0)

      const store = new SyncRecoveryStore(db.queries)
      await store.init()

      const opEspacio1: SyncOperation[] = [
        { table: 'pago', id: 'pago-1', op: 'PUT', data: { deuda_id: deudaId1, monto: '50.00', espacio_id: espacio1 } },
        { table: 'deuda', id: deudaId1, op: 'PATCH', data: { saldo_pendiente: '50.00' } },
      ]
      await store.record('dev-1:1:2', opEspacio1)

      const rec = await store.get('dev-1:1:2', opEspacio1)
      expect(rec?.decision).toBe('blocked')

      const count = await db.queries.getOptional<{ n: number }>('SELECT count(*) as n FROM vaulto_sync_recovery')
      expect(count?.n).toBe(1)
    } finally {
      db.close()
    }
  })
})
