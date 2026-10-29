import type { TipoCategoria } from '@vaulto/shared/types'

export interface CategoriaRow {
  id: string
  espacio_id: string
  nombre: string
  tipo: TipoCategoria
  icono: string | null
  color: string | null
}
const COLUMNAS = 'id, espacio_id, nombre, tipo, icono, color'
export const SELECT_CATEGORIAS = `SELECT ${COLUMNAS} FROM categoria WHERE espacio_id = ? AND tipo = ? AND deleted_at IS NULL ORDER BY nombre COLLATE NOCASE ASC, id`
export const SELECT_CATEGORIA = `SELECT ${COLUMNAS} FROM categoria WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL LIMIT 1`
export const SELECT_CATEGORIA_HISTORICA = `SELECT ${COLUMNAS} FROM categoria WHERE id = ? AND espacio_id = ? LIMIT 1`
