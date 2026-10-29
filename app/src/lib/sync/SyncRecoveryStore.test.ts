import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { testDatabase } from '@/test/sqlite'
import { esLoteAbono, SyncRecoveryStore, type SyncOperation } from './SyncRecoveryStore'

let fixture: ReturnType<typeof testDatabase>
let store: SyncRecoveryStore
export const abono: SyncOperation[] = [
  { table: 'pago', id: 'pago', op: 'PUT', data: { deuda_id: 'deuda', monto: '60.00', espacio_id: 'propio' } },
  { table: 'deuda', id: 'deuda', op: 'PATCH', data: { saldo_pendiente: '40.00' } },
]
beforeEach(async () => { fixture = testDatabase(); store = new SyncRecoveryStore(fixture.queries); await store.init() })
afterEach(() => fixture.close())

describe('Registro durable de abonos rechazados', () => {
  it('conserva el contenido, la decisión y la identidad al reabrir el registro', async () => {
    await store.record('device:1:2', abono)
    await store.requestCancellation('device:1:2')
    const reopened = new SyncRecoveryStore(fixture.queries)
    expect(await reopened.get('device:1:2', abono)).toMatchObject({ decision: 'requested', operations_json: JSON.stringify(abono) })
  })
  it('no permite sustituir el contenido de una identidad que ya requiere revisión', async () => {
    await store.record('device:1:2', abono)
    const otro = abono.map((op) => op.table === 'pago' ? { ...op, data: { ...op.data, monto: '61.00' } } : op)
    await expect(store.get('device:1:2', otro)).rejects.toThrow('no coincide')
    await expect(store.record('device:1:2', otro)).rejects.toThrow('no coincide')
    expect((await store.get('device:1:2', abono))?.operations_json).toBe(JSON.stringify(abono))
  })
  it('no ofrece anulación genérica para onboarding u otros lotes', async () => {
    expect(esLoteAbono([{ table: 'perfil', id: 'usuario', op: 'PUT', data: {} }])).toBe(false)
    expect(esLoteAbono([abono[0]!, { table: 'deuda', id: 'otra', op: 'PATCH', data: {} }])).toBe(false)
    await store.record('device:3:3', [{ table: 'cuenta', id: 'cuenta', op: 'PUT', data: {} }])
    expect(await store.get('device:3:3', [])).toBeNull()
  })
  it('confirmar anulación conserva el historial y no lo vuelve a solicitar', async () => {
    await store.record('device:1:2', abono)
    await store.requestCancellation('device:1:2')
    await store.confirm('device:1:2', 'cancelled')
    await store.requestCancellation('device:1:2')
    expect(await store.get('device:1:2', abono)).toMatchObject({ decision: 'cancelled', operations_json: JSON.stringify(abono) })
    expect(await fixture.queries.getOptional('SELECT count(*) n FROM vaulto_sync_recovery')).toEqual({ n: 1 })
  })
})
