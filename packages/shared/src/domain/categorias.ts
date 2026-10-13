// Catálogo de categorías: íconos y colores permitidos + set sugerido por defecto.
//
// El ícono se guarda como nombre Lucide en kebab-case (columna `icono`) y el
// color como hex (columna `color`). Se restringen a un catálogo cerrado para que
// la UI pueda mapear cada nombre a un componente sin cargar los ~1.600 íconos y
// para garantizar contraste ≥ 3:1 (WCAG 1.4.11) en tema claro y oscuro.

import type { TipoCategoria } from '../types'
import { uuidV5 } from './uuid'

export const ICONOS_CATEGORIA = [
  'shopping-cart',
  'house',
  'zap',
  'bus',
  'car',
  'utensils',
  'heart-pulse',
  'film',
  'graduation-cap',
  'shirt',
  'smartphone',
  'plane',
  'paw-print',
  'dumbbell',
  'baby',
  'wrench',
  'receipt',
  'gift',
  'briefcase',
  'hand-coins',
  'trending-up',
  'piggy-bank',
  'banknote',
  'ellipsis',
] as const

export type IconoCategoria = (typeof ICONOS_CATEGORIA)[number]

/** Paleta validada: contraste ≥ 3:1 sobre #FFFFFF y sobre la superficie oscura #141A24. */
export const COLORES_CATEGORIA = [
  '#DC2626',
  '#EA580C',
  '#B45309',
  '#16A34A',
  '#0D9488',
  '#0891B2',
  '#2563EB',
  '#8B5CF6',
  '#DB2777',
  '#64748B',
] as const

export const ICONO_CATEGORIA_FALLBACK: IconoCategoria = 'ellipsis'
export const COLOR_CATEGORIA_FALLBACK = '#64748B'

export function esIconoCategoria(valor: string | null | undefined): valor is IconoCategoria {
  return (ICONOS_CATEGORIA as readonly string[]).includes(valor ?? '')
}

export interface CategoriaSugerida {
  /** Clave estable de la sugerencia: alimenta el id determinista. No cambiarla. */
  slug: string
  nombre: string
  tipo: TipoCategoria
  icono: IconoCategoria
  color: string
}

export const CATEGORIAS_POR_DEFECTO: readonly CategoriaSugerida[] = [
  { slug: 'egreso/mercado', nombre: 'Mercado', tipo: 'egreso', icono: 'shopping-cart', color: '#16A34A' },
  { slug: 'egreso/arriendo', nombre: 'Arriendo', tipo: 'egreso', icono: 'house', color: '#2563EB' },
  { slug: 'egreso/servicios', nombre: 'Servicios', tipo: 'egreso', icono: 'zap', color: '#B45309' },
  { slug: 'egreso/transporte', nombre: 'Transporte', tipo: 'egreso', icono: 'bus', color: '#0891B2' },
  { slug: 'egreso/restaurantes', nombre: 'Restaurantes', tipo: 'egreso', icono: 'utensils', color: '#EA580C' },
  { slug: 'egreso/salud', nombre: 'Salud', tipo: 'egreso', icono: 'heart-pulse', color: '#DC2626' },
  { slug: 'egreso/entretenimiento', nombre: 'Entretenimiento', tipo: 'egreso', icono: 'film', color: '#8B5CF6' },
  { slug: 'egreso/educacion', nombre: 'Educación', tipo: 'egreso', icono: 'graduation-cap', color: '#0D9488' },
  { slug: 'egreso/ropa', nombre: 'Ropa', tipo: 'egreso', icono: 'shirt', color: '#DB2777' },
  { slug: 'egreso/otros', nombre: 'Otros gastos', tipo: 'egreso', icono: 'ellipsis', color: '#64748B' },
  { slug: 'ingreso/salario', nombre: 'Salario', tipo: 'ingreso', icono: 'briefcase', color: '#16A34A' },
  { slug: 'ingreso/negocio', nombre: 'Negocio', tipo: 'ingreso', icono: 'hand-coins', color: '#0D9488' },
  { slug: 'ingreso/inversiones', nombre: 'Inversiones', tipo: 'ingreso', icono: 'trending-up', color: '#2563EB' },
  { slug: 'ingreso/regalos', nombre: 'Regalos', tipo: 'ingreso', icono: 'gift', color: '#DB2777' },
  { slug: 'ingreso/otros', nombre: 'Otros ingresos', tipo: 'ingreso', icono: 'ellipsis', color: '#64748B' },
]

/**
 * Id determinista de una categoría sugerida dentro de un espacio. Dos
 * dispositivos que siembren offline el mismo espacio generan los mismos ids, y
 * el upsert del sync los funde en vez de duplicar categorías.
 */
export function idCategoriaSugerida(espacioId: string, slug: string): string {
  return uuidV5(`vaulto:categoria:${slug}`, espacioId)
}
