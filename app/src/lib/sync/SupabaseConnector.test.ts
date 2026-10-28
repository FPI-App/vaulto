import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateType } from '@powersync/react-native'

import { SupabaseConnector } from './SupabaseConnector'

const mocks = vi.hoisted(() => ({ session: vi.fn(), createClient: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('@powersync/react-native', () => ({ UpdateType: { PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' } }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fixture')
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'legacy-fixture')
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'a' }, access_token: 'fixture-not-a-real-token', expires_at: 2000000000 } }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe('Conector ligado a la cuenta propietaria de la base', () => {
  it('no entrega credenciales ni lee la cola cuando la sesión pertenece a otra cuenta', async () => {
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'b' } } }, error: null })
    const connector = new SupabaseConnector('a')
    const getNextCrudTransaction = vi.fn(async () => null)
    await expect(connector.fetchCredentials()).rejects.toThrow('sesión cambió')
    await expect(connector.uploadData({ getNextCrudTransaction })).rejects.toThrow('sesión cambió')
    expect(getNextCrudTransaction).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('la sesión propietaria obtiene sus credenciales y una sesión cerrada queda bloqueada', async () => {
    const connector = new SupabaseConnector('a')
    expect((await connector.fetchCredentials()).token).toBe('fixture-not-a-real-token')
    mocks.session.mockResolvedValue({ data: { session: null }, error: null })
    await expect(connector.fetchCredentials()).rejects.toThrow('sesión cambió')
  })
  it('traduce una eliminación física local a soft delete y completa la cola al guardar', async () => {
    const throwOnError = vi.fn(async () => {})
    const single = vi.fn(() => ({ throwOnError }))
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    mocks.createClient.mockReturnValue({ from: () => ({ update }) })
    const complete = vi.fn(async () => {})
    const getNextCrudTransaction = async () => ({ crud: [{ id: 'deuda', table: 'deuda', op: UpdateType.DELETE, opData: undefined }], complete })
    await new SupabaseConnector('a').uploadData({ getNextCrudTransaction })
    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(eq).toHaveBeenCalledWith('id', 'deuda')
    expect(select).toHaveBeenCalledWith('id')
    expect(single).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(mocks.createClient.mock.calls[0]?.[2].auth.persistSession).toBe(false)
    expect(mocks.createClient.mock.calls[0]?.[1]).toBe('sb_publishable_fixture')
  })
  it('si falla la subida no completa la cola ni expone el error con datos de la fila', async () => {
    const throwOnError = async () => { throw new Error('detalle privado de prueba') }
    mocks.createClient.mockReturnValue({ from: () => ({ upsert: () => ({ select: () => ({ single: () => ({ throwOnError }) }) }) }) })
    const complete = vi.fn(async () => {})
    const getNextCrudTransaction = async () => ({ crud: [{ id: 'deuda', table: 'deuda', op: UpdateType.PUT, opData: { contraparte: 'fixture' } }], complete })
    await expect(new SupabaseConnector('a').uploadData({ getNextCrudTransaction })).rejects.toThrow('cola local se conservó')
    expect(complete).not.toHaveBeenCalled()
  })

  it.each([UpdateType.PATCH, UpdateType.DELETE])('conserva %s cuando RLS no devuelve una fila escrita', async (op) => {
    const throwOnError = vi.fn(async () => { throw new Error('PGRST116: zero rows') })
    const single = vi.fn(() => ({ throwOnError }))
    const select = vi.fn(() => ({ single }))
    mocks.createClient.mockReturnValue({ from: () => ({ update: () => ({ eq: () => ({ select }) }) }) })
    const complete = vi.fn(async () => {})
    const getNextCrudTransaction = async () => ({ crud: [{ id: 'deuda', table: 'deuda', op, opData: { nota: 'QA' } }], complete })
    await expect(new SupabaseConnector('a').uploadData({ getNextCrudTransaction })).rejects.toThrow('cola local se conservó')
    expect(select).toHaveBeenCalledWith('id')
    expect(single).toHaveBeenCalledTimes(1)
    expect(complete).not.toHaveBeenCalled()
  })
})
