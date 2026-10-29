import { describe, expect, it } from 'vitest'

import {
  CATEGORIAS_POR_DEFECTO,
  COLORES_CATEGORIA,
  ICONOS_CATEGORIA,
  esIconoCategoria,
  idCategoriaSugerida,
} from './categorias'
import { uuidV5 } from './uuid'

describe('uuidV5', () => {
  it('cumple el vector de prueba de RFC 4122 (namespace DNS)', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    )
  })

  it('soporta nombres multibyte y largos (> 1 bloque SHA-1)', () => {
    const id = uuidV5('Educación'.repeat(20), '6ba7b810-9dad-11d1-80b4-00c04fd430c8')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('rechaza namespaces que no son UUID', () => {
    expect(() => uuidV5('x', 'no-es-uuid')).toThrow(TypeError)
  })
})

describe('idCategoriaSugerida', () => {
  const espacioA = 'e0000000-0000-0000-0000-00000000000a'
  const espacioB = 'e0000000-0000-0000-0000-00000000000b'

  it('es determinista por espacio + slug', () => {
    expect(idCategoriaSugerida(espacioA, 'egreso/mercado')).toBe(
      idCategoriaSugerida(espacioA, 'egreso/mercado'),
    )
  })

  it('no colisiona entre espacios ni entre slugs', () => {
    const ids = new Set(
      [espacioA, espacioB].flatMap((e) => CATEGORIAS_POR_DEFECTO.map((c) => idCategoriaSugerida(e, c.slug))),
    )
    expect(ids.size).toBe(CATEGORIAS_POR_DEFECTO.length * 2)
  })
})

describe('CATEGORIAS_POR_DEFECTO', () => {
  it('solo usa íconos y colores del catálogo, con slugs únicos', () => {
    for (const c of CATEGORIAS_POR_DEFECTO) {
      expect(ICONOS_CATEGORIA).toContain(c.icono)
      expect(COLORES_CATEGORIA).toContain(c.color)
      expect(c.slug.startsWith(`${c.tipo}/`)).toBe(true)
    }
    expect(new Set(CATEGORIAS_POR_DEFECTO.map((c) => c.slug)).size).toBe(CATEGORIAS_POR_DEFECTO.length)
  })

  it('trae sugerencias de ingreso y de egreso', () => {
    const tipos = new Set(CATEGORIAS_POR_DEFECTO.map((c) => c.tipo))
    expect(tipos).toEqual(new Set(['ingreso', 'egreso']))
  })
})

describe('esIconoCategoria', () => {
  it('acepta solo nombres del catálogo', () => {
    expect(esIconoCategoria('house')).toBe(true)
    expect(esIconoCategoria('cart')).toBe(false)
    expect(esIconoCategoria(null)).toBe(false)
  })
})
