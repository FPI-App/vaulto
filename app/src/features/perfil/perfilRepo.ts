import type { DatabaseWriter, QueryExecutor } from '@/lib/db/DatabaseWriter'

import { normalizarDatosPerfil, type DatosPerfil } from './datosPerfil'

export async function comprobarUsername(tx: QueryExecutor, userId: string, username: string) {
  const ocupado = await tx.getOptional<{ id: string }>(
    'SELECT id FROM perfil WHERE lower(username) = ? AND id != ? LIMIT 1',
    [username, userId],
  )
  if (ocupado) throw new Error('Ese nombre de usuario ya está ocupado.')
}

export async function guardarPerfil(db: DatabaseWriter, userId: string, datos: DatosPerfil) {
  const perfil = normalizarDatosPerfil(datos)
  await db.writeTransaction(async (tx) => {
    const existente = await tx.getOptional<{ id: string }>(
      'SELECT id FROM perfil WHERE id = ? AND deleted_at IS NULL', [userId],
    )
    if (!existente) throw new Error('No encontramos tu perfil. Completa el registro inicial.')
    await comprobarUsername(tx, userId, perfil.username)
    await tx.execute(
      `UPDATE perfil SET nombre = ?, apellido = ?, username = ?, foto_url = ?, descripcion = ?,
         ocupacion = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [perfil.nombre, perfil.apellido, perfil.username, perfil.foto_url, perfil.descripcion,
        perfil.ocupacion, new Date().toISOString(), userId],
    )
  })
}
