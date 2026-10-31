// Contrato puro del fixture qa-sync-recovery (#25): estado persistido, payload remoto, acceso en resume
// y línea de tiempo saneada. Sin red, cifrado ni SDK; solo lo usan development builds.
import { esUuidQa, type QaOwner } from './qaStorageRemote'

export type QaSyncPhase = 'init' | 'prepared' | 'blocked' | 'requested' | 'passed'

export interface QaSyncState {
  version: 1
  fixtureId: string
  user: string
  espacioId: string
  directoryUri: string
  filename: string
  keyName: string
  debtId: string
  remotePaymentId: string
  localPaymentId: string
  remoteBatchId: string
  batchId: string
  clientId: string
  queueHash: string
  queueEntries: number
  phase: QaSyncPhase
  processId: string
}

const FASES: readonly QaSyncPhase[] = ['init', 'prepared', 'blocked', 'requested', 'passed']
const TEXTOS = ['directoryUri', 'filename', 'keyName', 'remoteBatchId', 'batchId', 'clientId', 'queueHash', 'processId'] as const
const UUIDS = ['fixtureId', 'user', 'espacioId', 'debtId', 'remotePaymentId', 'localPaymentId'] as const

export function leerEstadoSyncQa(texto: string | null): QaSyncState {
  let valor: unknown
  try { valor = JSON.parse(texto ?? '') } catch { throw new Error('qa-estado') }
  if (!valor || typeof valor !== 'object') throw new Error('qa-estado')
  const state = valor as Record<string, unknown>
  const claves = ['version', 'phase', 'queueEntries', ...TEXTOS, ...UUIDS]
  if (Object.keys(state).sort().join() !== [...claves].sort().join() || state.version !== 1) throw new Error('qa-estado')
  if (!FASES.includes(state.phase as QaSyncPhase) || !Number.isInteger(state.queueEntries)) throw new Error('qa-estado')
  if (UUIDS.some((clave) => typeof state[clave] !== 'string' || !esUuidQa(state[clave] as string))) throw new Error('qa-estado')
  if (TEXTOS.some((clave) => typeof state[clave] !== 'string')) throw new Error('qa-estado')
  return state as unknown as QaSyncState
}

/** Un fixture sin terminar nunca se sobrescribe: su llave y su cola siguen siendo la evidencia. */
export function puedePrepararSyncQa(existente: string | null): boolean {
  if (existente === null) return true
  try { return leerEstadoSyncQa(existente).phase === 'passed' } catch { return false }
}

/** Decide antes de abrir la base o leer su llave: solo el propietario original continúa. */
export function accesoResumeSyncQa(state: QaSyncState, actual: QaOwner): 'permitido' | 'propietario-distinto' {
  return state.user === actual.userId && state.espacioId === actual.espacioId ? 'permitido' : 'propietario-distinto'
}

export interface QaRemoteOperation {
  table: 'deuda' | 'pago'
  id: string
  op: 'PUT'
  data: Record<string, string>
}

/** Estado remoto previo: deuda de 100 y un abono de 60 ya aplicado (el servidor deja saldo 40). */
export function operacionesRemotasSyncQa(owner: QaOwner, ids: { debtId: string; remotePaymentId: string }, ahora: string): QaRemoteOperation[] {
  if (ids.debtId === ids.remotePaymentId || !esUuidQa(ids.debtId) || !esUuidQa(ids.remotePaymentId)) throw new Error('qa-ids')
  return [
    {
      table: 'deuda', id: ids.debtId, op: 'PUT',
      data: {
        espacio_id: owner.espacioId, direccion: 'yo_debo', contraparte: 'QA recuperación', monto_inicial: '100.00',
        saldo_pendiente: '100.00', currency: 'COP', estado: 'activa', created_at: ahora, updated_at: ahora,
      },
    },
    {
      table: 'pago', id: ids.remotePaymentId, op: 'PUT',
      data: { espacio_id: owner.espacioId, deuda_id: ids.debtId, monto: '60.00', currency: 'COP', fecha: ahora, created_at: ahora, updated_at: ahora },
    },
  ]
}

export interface QaTimelineEntry {
  t: string
  event: string
}

const MAX_TIMELINE = 200

/** Solo registra cambios y eventos sin datos: nada de payloads, filas ni mensajes del servidor. */
export function registrarEvento(timeline: readonly QaTimelineEntry[], event: string, ahora: Date): QaTimelineEntry[] {
  if (!/^[a-z0-9:_-]{1,60}$/.test(event)) throw new Error('qa-evento')
  if (timeline.at(-1)?.event === event) return [...timeline]
  return [...timeline, { t: ahora.toISOString(), event }].slice(-MAX_TIMELINE)
}

export interface QaEvidenceInput {
  decision: string | null
  outbox: number
  remotePagos: number
  remoteSaldo: string | null
  events: readonly string[]
}

/** passed exige anulación confirmada, cola vacía, un solo abono remoto de 60 y saldo 40; la reconexión se reporta aparte. */
export function evaluarSyncQa(input: QaEvidenceInput) {
  const reconexion = input.events.indexOf('requested') >= 0
    && input.events.indexOf('connected:false', input.events.indexOf('requested')) >= 0
    && input.events.indexOf('connected:true', input.events.indexOf('connected:false', input.events.indexOf('requested'))) >= 0
  const passed = input.decision === 'cancelled' && input.outbox === 0 && input.remotePagos === 1 && input.remoteSaldo === '40.00'
  return { passed, reconnectAfterRequestedInProcess: reconexion }
}
