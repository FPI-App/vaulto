import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { testDatabase } from '@/test/sqlite'
import { completarOnboarding } from './onboardingRepo'

let fixture: ReturnType<typeof testDatabase>
const identidad = { nombre: ' Ana ', apellido: ' Pérez ', username: ' ANA_P ' }
beforeEach(() => { fixture = testDatabase() })
afterEach(() => fixture.close())

async function counts() {
  return fixture.queries.getOptional<{ espacios: number; miembros: number; perfiles: number }>(
    'SELECT (SELECT count(*) FROM espacio) espacios, (SELECT count(*) FROM espacio_miembro) miembros, (SELECT count(*) FROM perfil) perfiles',
  )
}

describe('Registro inicial transaccional', () => {
  it('crea espacio, miembro owner y perfil completo en una transacción', async () => {
    const espacio = await completarOnboarding(fixture.db, 'ana', identidad)
    expect(await counts()).toEqual({ espacios: 1, miembros: 1, perfiles: 1 })
    expect(await fixture.queries.getOptional('SELECT espacio_id, username, onboarding_completo FROM perfil WHERE id = ?', ['ana']))
      .toEqual({ espacio_id: espacio, username: 'ana_p', onboarding_completo: 1 })
    expect(await fixture.queries.getOptional('SELECT user_id, rol FROM espacio_miembro')).toEqual({ user_id: 'ana', rol: 'owner' })
  })
  it('un reintento conserva el mismo espacio, membresía y datos opcionales', async () => {
    const espacio = await completarOnboarding(fixture.db, 'ana', identidad)
    await fixture.db.execute('UPDATE perfil SET foto_url = ? WHERE id = ?', ['https://example.com/foto.jpg', 'ana'])
    expect(await completarOnboarding(fixture.db, 'ana', { ...identidad, nombre: 'Anita' })).toBe(espacio)
    expect(await counts()).toEqual({ espacios: 1, miembros: 1, perfiles: 1 })
    expect(await fixture.queries.getOptional('SELECT nombre, foto_url FROM perfil WHERE id = ?', ['ana']))
      .toEqual({ nombre: 'Anita', foto_url: 'https://example.com/foto.jpg' })
  })
  it('reutiliza un espacio propio previo sin generar otro', async () => {
    await fixture.db.execute("INSERT INTO espacio (id, owner_user_id) VALUES ('previo', 'ana')")
    expect(await completarOnboarding(fixture.db, 'ana', identidad)).toBe('previo')
    expect(await counts()).toEqual({ espacios: 1, miembros: 1, perfiles: 1 })
  })
  it('no se reinscribe ni mueve el perfil de un espacio con membresía revocada', async () => {
    await fixture.db.execute("INSERT INTO espacio (id, owner_user_id) VALUES ('ajeno', 'otro')")
    await fixture.db.execute("INSERT INTO espacio_miembro (id, espacio_id, user_id, deleted_at) VALUES ('revocado', 'ajeno', 'ana', '2026-01-01')")
    await fixture.db.execute("INSERT INTO perfil (id, espacio_id, username) VALUES ('ana', 'ajeno', 'ana_p')")
    await expect(completarOnboarding(fixture.db, 'ana', identidad)).rejects.toThrow('espacio no disponible')
    expect(await counts()).toEqual({ espacios: 1, miembros: 1, perfiles: 1 })
    expect(await fixture.queries.getOptional('SELECT deleted_at FROM espacio_miembro WHERE id = ?', ['revocado'])).toEqual({ deleted_at: '2026-01-01' })
  })
  it('revierte toda la transacción si falla el perfil, sin dejar huérfanos', async () => {
    fixture.sqlite.exec("CREATE TRIGGER rechazar_perfil BEFORE INSERT ON perfil BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END")
    await expect(completarOnboarding(fixture.db, 'ana', identidad)).rejects.toThrow('fallo simulado')
    expect(await counts()).toEqual({ espacios: 0, miembros: 0, perfiles: 0 })
  })
  it('rechaza un usuario ocupado localmente antes de crear espacios', async () => {
    await fixture.db.execute("INSERT INTO perfil (id, username) VALUES ('otro', 'ANA_P')")
    await expect(completarOnboarding(fixture.db, 'ana', identidad)).rejects.toThrow('ocupado')
    expect(await counts()).toEqual({ espacios: 0, miembros: 0, perfiles: 1 })
  })
})
