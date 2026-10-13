// Capa de datos de Categorías: escrituras contra la SQLite local de PowerSync.
// Mismas reglas que cuentasRepo: updated_at a mano, borrado = soft delete.
import type { AbstractPowerSyncDatabase } from '@powersync/react-native'
import * as Crypto from 'expo-crypto'
import {
  CATEGORIAS_POR_DEFECTO,
  idCategoriaSugerida,
  type IconoCategoria,
  type TipoCategoria,
} from '@vaulto/shared'

/** Datos que el usuario define de una categoría. El tipo solo se fija al crear. */
export interface DatosCategoria {
  nombre: string
  icono: IconoCategoria
  color: string
}

export async function crearCategoria(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
  tipo: TipoCategoria,
  datos: DatosCategoria,
): Promise<string> {
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
  db: AbstractPowerSyncDatabase,
  id: string,
  datos: DatosCategoria,
): Promise<void> {
  await db.execute(
    'UPDATE categoria SET nombre = ?, icono = ?, color = ?, updated_at = ? WHERE id = ?',
    [datos.nombre, datos.icono, datos.color, new Date().toISOString(), id],
  )
}

/** Borrado lógico. Los movimientos que la usan conservan el id y la muestran como eliminada. */
export async function eliminarCategoria(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.execute('UPDATE categoria SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id])
}

/**
 * Siembra las categorías sugeridas si el espacio nunca tuvo ninguna (cuenta
 * también las borradas: si el usuario las eliminó todas, no se las devolvemos).
 * Idempotente: ids deterministas por espacio, así dos dispositivos que siembran
 * offline convergen a las mismas filas al sincronizar.
 * @returns cuántas categorías insertó.
 */
export async function sembrarCategoriasPorDefecto(
  db: AbstractPowerSyncDatabase,
  espacioId: string,
): Promise<number> {
  return db.writeTransaction(async (tx) => {
    const existentes = await tx.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM categoria WHERE espacio_id = ?',
      [espacioId],
    )
    if (existentes.n > 0) return 0

    const now = new Date().toISOString()
    for (const c of CATEGORIAS_POR_DEFECTO) {
      await tx.execute(
        `INSERT INTO categoria (id, espacio_id, nombre, tipo, icono, color, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [idCategoriaSugerida(espacioId, c.slug), espacioId, c.nombre, c.tipo, c.icono, c.color, now, now],
      )
    }
    return CATEGORIAS_POR_DEFECTO.length
  })
}
