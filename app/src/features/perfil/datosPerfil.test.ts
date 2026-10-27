import { describe, expect, it } from 'vitest'

import { normalizarDatosPerfil } from './datosPerfil'

const datos = { nombre: ' Ana ', apellido: ' Pérez ', username: ' ANA_P ' }

describe('Datos del perfil', () => {
  it('normaliza la identidad y deja los campos opcionales vacíos como null', () => {
    expect(normalizarDatosPerfil(datos)).toEqual({ nombre: 'Ana', apellido: 'Pérez', username: 'ana_p', foto_url: null, descripcion: null, ocupacion: null })
  })
  it('rechaza identidades incompletas o usuarios fuera del formato permitido', () => {
    expect(() => normalizarDatosPerfil({ ...datos, nombre: ' ' })).toThrow()
    for (const username of ['ab', 'con espacios', 'ááá', 'x'.repeat(25)]) {
      expect(() => normalizarDatosPerfil({ ...datos, username })).toThrow()
    }
  })
  it('admite una foto HTTPS y permite quitarla', () => {
    expect(normalizarDatosPerfil({ ...datos, foto_url: ' https://example.com/foto.jpg ' }).foto_url).toBe('https://example.com/foto.jpg')
    expect(normalizarDatosPerfil({ ...datos, foto_url: '', descripcion: ' ' }).foto_url).toBeNull()
  })
  it('rechaza fotos inseguras, URLs con credenciales y contenido demasiado largo', () => {
    for (const foto_url of ['http://example.com/foto', 'file:///foto.jpg', 'javascript:alert(1)', 'https://usuario:clave@example.com/foto']) {
      expect(() => normalizarDatosPerfil({ ...datos, foto_url })).toThrow()
    }
    expect(() => normalizarDatosPerfil({ ...datos, descripcion: 'x'.repeat(501) })).toThrow()
  })
})
