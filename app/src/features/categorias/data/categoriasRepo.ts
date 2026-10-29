// Capa de datos de Categorías: escrituras contra la SQLite local de PowerSync.
// Mismas reglas que cuentasRepo: updated_at a mano, borrado = soft delete.
import * as Crypto from 'expo-crypto'
import {
  CATEGORIAS_POR_DEFECTO,
  idCategoriaSugerida,
  esIconoCategoria,
  COLORES_CATEGORIA,
  type IconoCategoria,
} from '@vaulto/shared/domain'
import type { TipoCategoria } from '@vaulto/shared/types'
import type { DatabaseWriter } from '@/lib/db/DatabaseWriter'
import { CATEGORY_SEED_TABLE } from '@/lib/sync/CategorySeedIntent'

/** Datos que el usuario define de una categoría. El tipo solo se fija al crear. */
export interface DatosCategoria {
  nombre: string
  icono: IconoCategoria
  color: string
}

function normalizar(datos: DatosCategoria): DatosCategoria {
  if (!datos.nombre.trim() || !esIconoCategoria(datos.icono) || !COLORES_CATEGORIA.some((color) => color === datos.color)) {
    throw new Error('Revisa el nombre, el icono y el color de la categoría')
  }
  return { ...datos, nombre: datos.nombre.trim() }
}

async function modificar(db: DatabaseWriter, espacioId: string, id: string, campos: string, valores: unknown[]) {
  await db.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ id: string }>('SELECT id FROM categoria WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL', [id, espacioId])
    if (!row) throw new Error('La categoría no está disponible en este espacio')
    await tx.execute(`UPDATE categoria SET ${campos} WHERE id = ? AND espacio_id = ? AND deleted_at IS NULL`, [...valores, id, espacioId])
  })
}

export async function crearCategoria(
  db: DatabaseWriter,
  espacioId: string,
  tipo: TipoCategoria,
  entrada: DatosCategoria,
): Promise<string> {
  if (!espacioId || !['ingreso', 'egreso'].includes(tipo)) throw new Error('Selecciona un espacio y un tipo válidos')
  const datos = normalizar(entrada)
  const id = Crypto.randomUUID()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO categoria (id, espacio_id, nombre, tipo, icono, color, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, espacioId, datos.nombre, tipo, datos.icono, datos.color, now, now],
  )
  return id
}

export async function actualizarCategoria(
  db: DatabaseWriter,
  espacioId: string,
  id: string,
  entrada: DatosCategoria,
): Promise<void> {
  const datos = normalizar(entrada)
  await modificar(db, espacioId, id,
    'nombre = ?, icono = ?, color = ?, updated_at = ?',
    [datos.nombre, datos.icono, datos.color, new Date().toISOString()],
  )
}

/** Borrado lógico. Los movimientos que la usan conservan el id y la muestran como eliminada. */
export async function eliminarCategoria(db: DatabaseWriter, espacioId: string, id: string): Promise<void> {
  const now = new Date().toISOString()
  await modificar(db, espacioId, id, 'deleted_at = ?, updated_at = ?', [now, now])
}

/**
 * Siembra las categorías sugeridas si el espacio nunca tuvo ninguna (cuenta
 * también las borradas: si el usuario las eliminó todas, no se las devolvemos).
 * Idempotente: ids deterministas por espacio, así dos dispositivos que siembran
 * offline convergen a las mismas filas al sincronizar.
 * @returns cuántas categorías insertó.
 */
export async function sembrarCategoriasPorDefecto(
  db: DatabaseWriter,
  espacioId: string,
): Promise<number> {
  if (!espacioId) throw new Error('Selecciona un espacio antes de sembrar categorías')
  return db.writeTransaction(async (tx) => {
    const existentes = await tx.getOptional<{ n: number }>(
      'SELECT COUNT(*) AS n FROM categoria WHERE espacio_id = ?',
      [espacioId],
    )
    if (existentes && existentes.n > 0) return 0
    await tx.execute(CATEGORY_SEED_TABLE)

    const now = new Date().toISOString()
    for (const c of CATEGORIAS_POR_DEFECTO) {
      await tx.execute(
        `INSERT INTO categoria (id, espacio_id, nombre, tipo, icono, color, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [idCategoriaSugerida(espacioId, c.slug), espacioId, c.nombre, c.tipo, c.icono, c.color, now, now],
      )
      await tx.execute('INSERT OR IGNORE INTO vaulto_category_seed (id, created_at) VALUES (?, ?)', [idCategoriaSugerida(espacioId, c.slug), now])
    }
    return CATEGORIAS_POR_DEFECTO.length
  })
}
