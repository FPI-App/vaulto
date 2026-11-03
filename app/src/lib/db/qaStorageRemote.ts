// Contrato puro del fixture remoto de qa-storage (#21). Sin cifrado ni red: solo valida el propietario
// de la sesión, construye el payload de dominio y sanea el reporte. Solo lo usan development builds.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const esUuidQa = (valor: string) => UUID.test(valor)

export interface QaMembership {
  user_id: string
  espacio_id: string
  deleted_at: string | null
}

export interface QaOwner {
  userId: string
  espacioId: string
}

/** El propietario sale solo de la sesión actual y de su única membresía viva; nunca de parámetros. */
export function resolverPropietarioQa(sessionUserId: string | undefined, membresias: readonly QaMembership[]): QaOwner {
  if (!sessionUserId || !UUID.test(sessionUserId)) throw new Error('qa-sesion')
  const propias = membresias.filter((item) => item.user_id === sessionUserId && item.deleted_at === null)
  if (propias.length !== 1) throw new Error('qa-espacio')
  const espacioId = propias[0]!.espacio_id
  if (!UUID.test(espacioId)) throw new Error('qa-espacio')
  return { userId: sessionUserId, espacioId }
}

export interface QaCategoria {
  id: string
  espacio_id: string
  nombre: string
  tipo: 'ingreso' | 'egreso'
  icono: string
  color: string
}

/** Dos categorías en una misma transacción local: un lote atómico válido en remoto y fácil de contar. */
export function categoriasQa(owner: QaOwner, ids: readonly [string, string]): [QaCategoria, QaCategoria] {
  if (ids[0] === ids[1] || ids.some((id) => !UUID.test(id))) throw new Error('qa-ids')
  const base = { espacio_id: owner.espacioId, icono: 'flask-conical', color: '#6D28D9' }
  return [
    { ...base, id: ids[0], nombre: `QA 21 replay ${ids[0].slice(0, 8)}`, tipo: 'egreso' },
    { ...base, id: ids[1], nombre: `QA 21 replay ${ids[1].slice(0, 8)}`, tipo: 'ingreso' },
  ]
}

export interface QaRemoteState {
  version: 1
  user: string
  espacioId: string
  directoryUri: string
  filename: string
  clientId: string
  queueHash: string
  queueEntries: number
  categoryIds: [string, string]
  scenario: string
  replayed: boolean
}

/** Rechaza estados con campos de más o identificadores inválidos: el resume no acepta otro propietario. */
export function leerEstadoQa(texto: string | null): QaRemoteState {
  let valor: unknown
  try { valor = JSON.parse(texto ?? '') } catch { throw new Error('qa-estado') }
  if (!valor || typeof valor !== 'object') throw new Error('qa-estado')
  const state = valor as Record<string, unknown>
  const claves = ['version', 'user', 'espacioId', 'directoryUri', 'filename', 'clientId', 'queueHash', 'queueEntries', 'categoryIds', 'scenario', 'replayed']
  if (Object.keys(state).sort().join() !== [...claves].sort().join() || state.version !== 1) throw new Error('qa-estado')
  const ids = state.categoryIds
  if (typeof state.user !== 'string' || !UUID.test(state.user) || typeof state.espacioId !== 'string' || !UUID.test(state.espacioId)
    || !Array.isArray(ids) || ids.length !== 2 || ids.some((id) => typeof id !== 'string' || !UUID.test(id)) || ids[0] === ids[1]
    || typeof state.directoryUri !== 'string' || typeof state.filename !== 'string' || typeof state.clientId !== 'string'
    || typeof state.queueHash !== 'string' || !Number.isInteger(state.queueEntries) || typeof state.scenario !== 'string'
    || typeof state.replayed !== 'boolean') throw new Error('qa-estado')
  return state as unknown as QaRemoteState
}

export function validarMismoPropietario(state: QaRemoteState, actual: QaOwner): void {
  if (state.user !== actual.userId || state.espacioId !== actual.espacioId) throw new Error('qa-propietario')
}
