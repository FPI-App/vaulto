import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { testDatabase } from '@/test/sqlite'
import { completarOnboarding } from '@/features/onboarding/onboardingRepo'
import { guardarPerfil } from './perfilRepo'

let fixture: ReturnType<typeof testDatabase>
const datos = { nombre: 'Ana', apellido: 'Pérez', username: 'ana_p' }
beforeEach(async () => {
  fixture = testDatabase()
  await completarOnboarding(fixture.db, 'ana', datos)
})
afterEach(() => fixture.close())

describe('Edición de perfil', () => {
  it('guarda foto y campos opcionales únicamente en el perfil indicado', async () => {
    await completarOnboarding(fixture.db, 'otro', { ...datos, username: 'otro_user' })
    await guardarPerfil(fixture.db, 'ana', { ...datos, foto_url: 'https://example.com/foto.jpg', descripcion: ' Hola ', ocupacion: 'Dev' })
    expect(await fixture.queries.getOptional('SELECT foto_url, descripcion, ocupacion FROM perfil WHERE id = ?', ['ana']))
      .toEqual({ foto_url: 'https://example.com/foto.jpg', descripcion: 'Hola', ocupacion: 'Dev' })
    expect(await fixture.queries.getOptional('SELECT foto_url, descripcion FROM perfil WHERE id = ?', ['otro']))
      .toEqual({ foto_url: null, descripcion: null })
  })
  it('permite vaciar una foto y los campos opcionales existentes', async () => {
    await guardarPerfil(fixture.db, 'ana', { ...datos, foto_url: 'https://example.com/foto.jpg', descripcion: 'Hola' })
    await guardarPerfil(fixture.db, 'ana', { ...datos, foto_url: '', descripcion: '' })
    expect(await fixture.queries.getOptional('SELECT foto_url, descripcion FROM perfil WHERE id = ?', ['ana']))
      .toEqual({ foto_url: null, descripcion: null })
  })
  it('un username ocupado o un perfil inexistente no modifica datos', async () => {
    await completarOnboarding(fixture.db, 'otro', { ...datos, username: 'otro_user' })
    await expect(guardarPerfil(fixture.db, 'ana', { ...datos, nombre: 'Cambio', username: 'OTRO_USER' })).rejects.toThrow('ocupado')
    await expect(guardarPerfil(fixture.db, 'ausente', datos)).rejects.toThrow('perfil')
    expect(await fixture.queries.getOptional('SELECT nombre, username FROM perfil WHERE id = ?', ['ana'])).toEqual({ nombre: 'Ana', username: 'ana_p' })
  })
})
