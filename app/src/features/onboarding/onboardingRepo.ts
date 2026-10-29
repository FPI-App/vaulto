import * as Crypto from 'expo-crypto'

import type { DatabaseWriter } from '@/lib/db/DatabaseWriter'
import { normalizarDatosPerfil, type DatosPerfil } from '@/features/perfil/datosPerfil'
import { comprobarUsername } from '@/features/perfil/perfilRepo'

export async function completarOnboarding(db: DatabaseWriter, userId: string, datos: DatosPerfil) {
  if (!userId) throw new Error('Inicia sesión para continuar.')
  const perfil = normalizarDatosPerfil(datos)
  return db.writeTransaction(async (tx) => {
    await comprobarUsername(tx, userId, perfil.username)
    const existente = await tx.getOptional<{ espacio_id: string; deleted_at: string | null }>(
      'SELECT espacio_id, deleted_at FROM perfil WHERE id = ?', [userId],
    )
    if (existente?.deleted_at) throw new Error('Este perfil ya no está disponible.')

    // Un reintento reutiliza el espacio vigente del perfil o un espacio propio.
    let espacio = existente ? await tx.getOptional<{ id: string }>(
      `SELECT e.id FROM espacio e WHERE e.id = ? AND e.deleted_at IS NULL
       AND (e.owner_user_id = ? OR EXISTS (
         SELECT 1 FROM espacio_miembro m WHERE m.espacio_id = e.id AND m.user_id = ? AND m.deleted_at IS NULL
       )) LIMIT 1`,
      [existente.espacio_id, userId, userId],
    ) : null
    if (existente && !espacio) throw new Error('Tu perfil pertenece a un espacio no disponible. Conservamos tus datos; revisa el acceso antes de continuar.')
    espacio ??= await tx.getOptional<{ id: string }>(
      `SELECT id FROM espacio WHERE owner_user_id = ? AND deleted_at IS NULL
       ORDER BY created_at, id LIMIT 1`, [userId],
    )
    const now = new Date().toISOString()
    const espacioId = espacio?.id ?? Crypto.randomUUID()
    if (!espacio) {
      await tx.execute(
        `INSERT INTO espacio (id, nombre, owner_user_id, base_currency, country, created_at, updated_at)
         VALUES (?, 'Personal', ?, 'COP', 'CO', ?, ?)`, [espacioId, userId, now, now],
      )
    }
    const miembro = await tx.getOptional<{ id: string }>(
      `SELECT id FROM espacio_miembro
       WHERE espacio_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1`, [espacioId, userId],
    )
    if (!miembro) {
      await tx.execute(
        `INSERT INTO espacio_miembro (id, espacio_id, user_id, rol, created_at, updated_at)
         VALUES (?, ?, ?, 'owner', ?, ?)`, [Crypto.randomUUID(), espacioId, userId, now, now],
      )
    }
    if (existente) {
      await tx.execute(
        `UPDATE perfil SET espacio_id = ?, nombre = ?, apellido = ?, username = ?,
           onboarding_completo = 1, updated_at = ? WHERE id = ?`,
        [espacioId, perfil.nombre, perfil.apellido, perfil.username, now, userId],
      )
    } else {
      await tx.execute(
        `INSERT INTO perfil (id, espacio_id, nombre, apellido, username, country,
           onboarding_completo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'CO', 1, ?, ?)`,
        [userId, espacioId, perfil.nombre, perfil.apellido, perfil.username, now, now],
      )
    }
    return espacioId
  })
}
