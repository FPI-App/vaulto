import { describe, expect, it } from 'vitest'

import {
  accesoResumeSyncQa, evaluarSyncQa, leerEstadoSyncQa, operacionesRemotasSyncQa, puedePrepararSyncQa, registrarEvento,
  type QaSyncState,
} from './qaSyncRecovery'

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
const owner = { userId: uuid(1), espacioId: uuid(2) }
const estado: QaSyncState = {
  version: 1, fixtureId: uuid(3), user: owner.userId, espacioId: owner.espacioId, directoryUri: 'file:///qa/', filename: 'qa.sqlite',
  keyName: 'key.fixture', debtId: uuid(4), remotePaymentId: uuid(5), localPaymentId: uuid(6), remoteBatchId: 'qa-sr:remote', batchId: 'cliente:1:2',
  clientId: 'cliente', queueHash: 'abc', queueEntries: 2, phase: 'requested', processId: 'proceso',
}

describe('Estado del fixture de recuperación', () => {
  it('lee un estado completo', () => {
    expect(leerEstadoSyncQa(JSON.stringify(estado))).toEqual(estado)
  })
  it.each([
    ['vacío', null],
    ['no JSON', '{'],
    ['campo extra (propietario arbitrario)', JSON.stringify({ ...estado, owner: owner.userId })],
    ['fase desconocida', JSON.stringify({ ...estado, phase: 'otra' })],
    ['UUID inválido', JSON.stringify({ ...estado, debtId: 'qa-deuda' })],
  ])('rechaza un estado %s', (_caso, texto) => {
    expect(() => leerEstadoSyncQa(texto)).toThrow()
  })
})

describe('Protección del fixture pendiente', () => {
  it('permite preparar solo sin estado previo o con el anterior terminado', () => {
    expect(puedePrepararSyncQa(null)).toBe(true)
    expect(puedePrepararSyncQa(JSON.stringify({ ...estado, phase: 'passed' }))).toBe(true)
    for (const phase of ['init', 'prepared', 'blocked', 'requested'] as const) {
      expect(puedePrepararSyncQa(JSON.stringify({ ...estado, phase }))).toBe(false)
    }
    expect(puedePrepararSyncQa('{ilegible')).toBe(false)
  })
})

describe('Acceso al reanudar', () => {
  it('solo el usuario y el espacio originales abren el fixture', () => {
    expect(accesoResumeSyncQa(estado, owner)).toBe('permitido')
    expect(accesoResumeSyncQa(estado, { ...owner, userId: uuid(7) })).toBe('propietario-distinto')
    expect(accesoResumeSyncQa(estado, { ...owner, espacioId: uuid(7) })).toBe('propietario-distinto')
  })
})

describe('Estado remoto previo', () => {
  it('crea una deuda de 100 y un abono de 60 en el espacio de la sesión', () => {
    const ops = operacionesRemotasSyncQa(owner, { debtId: uuid(4), remotePaymentId: uuid(5) }, '2026-10-30T00:00:00.000Z')
    expect(ops.map((op) => [op.table, op.id])).toEqual([['deuda', uuid(4)], ['pago', uuid(5)]])
    expect(new Set(ops.map((op) => op.data.espacio_id))).toEqual(new Set([owner.espacioId]))
    expect(ops[0]?.data.monto_inicial).toBe('100.00')
    expect(ops[1]).toMatchObject({ data: { deuda_id: uuid(4), monto: '60.00' } })
  })
  it('rechaza IDs repetidos o inválidos', () => {
    expect(() => operacionesRemotasSyncQa(owner, { debtId: uuid(4), remotePaymentId: uuid(4) }, 'x')).toThrow()
    expect(() => operacionesRemotasSyncQa(owner, { debtId: 'x', remotePaymentId: uuid(5) }, 'x')).toThrow()
  })
})

describe('Línea de tiempo y veredicto', () => {
  it('registra cambios sin duplicar el último evento y rechaza texto libre', () => {
    const ahora = new Date('2026-10-30T00:00:00Z')
    let timeline = registrarEvento([], 'connected:true', ahora)
    timeline = registrarEvento(timeline, 'connected:true', ahora)
    timeline = registrarEvento(timeline, 'decision:blocked', ahora)
    expect(timeline.map((item) => item.event)).toEqual(['connected:true', 'decision:blocked'])
    expect(() => registrarEvento(timeline, 'Authorization: Bearer x', ahora)).toThrow()
  })
  it('exige anulación, cola vacía, un abono de 60 y saldo 40', () => {
    const base = { decision: 'cancelled', outbox: 0, remotePagos: 1, remoteSaldo: '40.00', events: [] as string[] }
    expect(evaluarSyncQa(base).passed).toBe(true)
    expect(evaluarSyncQa({ ...base, decision: 'requested' }).passed).toBe(false)
    expect(evaluarSyncQa({ ...base, outbox: 2 }).passed).toBe(false)
    expect(evaluarSyncQa({ ...base, remotePagos: 2 }).passed).toBe(false)
    expect(evaluarSyncQa({ ...base, remoteSaldo: '100.00' }).passed).toBe(false)
  })
  it('reporta la reconexión en el mismo proceso solo si ocurre después de la solicitud', () => {
    const antes = ['connected:false', 'connected:true', 'requested']
    const despues = ['requested', 'connected:false', 'connected:true', 'decision:cancelled']
    const input = { decision: 'cancelled', outbox: 0, remotePagos: 1, remoteSaldo: '40.00' }
    expect(evaluarSyncQa({ ...input, events: antes }).reconnectAfterRequestedInProcess).toBe(false)
    expect(evaluarSyncQa({ ...input, events: despues }).reconnectAfterRequestedInProcess).toBe(true)
  })
})
