import { describe, expect, it } from 'vitest'

import { categoriasQa, leerEstadoQa, resolverPropietarioQa, validarMismoPropietario, type QaRemoteState } from './qaStorageRemote'

const usuario = '11111111-1111-4111-8111-111111111111'
const espacio = '22222222-2222-4222-8222-222222222222'
const ids: [string, string] = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
const membresia = { user_id: usuario, espacio_id: espacio, deleted_at: null }

describe('Propietario del fixture remoto', () => {
  it('toma el espacio de la única membresía viva de la sesión', () => {
    expect(resolverPropietarioQa(usuario, [membresia])).toEqual({ userId: usuario, espacioId: espacio })
  })
  it.each([
    ['sin sesión', undefined, [membresia]],
    ['sin membresía', usuario, []],
    ['membresía de otro usuario', usuario, [{ ...membresia, user_id: '55555555-5555-4555-8555-555555555555' }]],
    ['membresía borrada', usuario, [{ ...membresia, deleted_at: '2026-10-30T00:00:00Z' }]],
    ['dos espacios vivos', usuario, [membresia, { ...membresia, espacio_id: '66666666-6666-4666-8666-666666666666' }]],
    ['espacio no UUID', usuario, [{ ...membresia, espacio_id: 'qa-space' }]],
  ] as const)('rechaza %s', (_caso, sesion, membresias) => {
    expect(() => resolverPropietarioQa(sesion, membresias)).toThrow()
  })
})

describe('Payload de dominio del fixture', () => {
  const owner = { userId: usuario, espacioId: espacio }
  it('crea dos categorías válidas en el espacio de la sesión, con IDs fixture propios', () => {
    const categorias = categoriasQa(owner, ids)
    expect(categorias.map((item) => item.id)).toEqual(ids)
    expect(new Set(categorias.map((item) => item.espacio_id))).toEqual(new Set([espacio]))
    expect(categorias.map((item) => item.tipo).sort()).toEqual(['egreso', 'ingreso'])
    expect(categorias.every((item) => item.nombre.length > 0)).toBe(true)
  })
  it('rechaza IDs repetidos o que no son UUID', () => {
    expect(() => categoriasQa(owner, [ids[0], ids[0]])).toThrow()
    expect(() => categoriasQa(owner, ['qa-categoria', ids[1]])).toThrow()
  })
})

describe('Estado persistido entre create y resume', () => {
  const estado: QaRemoteState = {
    version: 1, user: usuario, espacioId: espacio, directoryUri: 'file:///qa/', filename: 'qa.sqlite', clientId: 'cliente',
    queueHash: 'abc', queueEntries: 2, categoryIds: ids, scenario: 'escenario', replayed: false,
  }
  it('lee un estado completo y exige el mismo propietario que la sesión actual', () => {
    const leido = leerEstadoQa(JSON.stringify(estado))
    expect(() => validarMismoPropietario(leido, { userId: usuario, espacioId: espacio })).not.toThrow()
    expect(() => validarMismoPropietario(leido, { userId: '55555555-5555-4555-8555-555555555555', espacioId: espacio })).toThrow()
    expect(() => validarMismoPropietario(leido, { userId: usuario, espacioId: '66666666-6666-4666-8666-666666666666' })).toThrow()
  })
  it.each([
    ['vacío', null],
    ['no JSON', '{'],
    ['campo extra (owner arbitrario)', JSON.stringify({ ...estado, owner: usuario })],
    ['falta un campo', JSON.stringify({ ...estado, clientId: undefined })],
    ['usuario inválido', JSON.stringify({ ...estado, user: 'qa-user' })],
    ['categorías repetidas', JSON.stringify({ ...estado, categoryIds: [ids[0], ids[0]] })],
  ])('rechaza un estado %s', (_caso, texto) => {
    expect(() => leerEstadoQa(texto)).toThrow()
  })
})
