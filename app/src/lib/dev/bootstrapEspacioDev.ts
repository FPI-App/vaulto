// ⚠️ TEMPORAL — SOLO DESARROLLO. Reemplazado por el onboarding real (Track B, #14, edav).
//
// Crea un `espacio` + `espacio_miembro` mínimos para poder desarrollar Track A
// (cuentas/movimientos) contra Supabase local SIN esperar a que exista el
// onboarding. NO es la implementación final:
//   - El onboarding real crea además el `perfil` y aplica reglas de negocio.
//   - Con RLS activa en Supabase, el INSERT de `espacio` necesita una política de
//     inserción por dueño (owner_user_id = auth.uid()) que es parte de #14. En
//     local se puede correr con esa política ya creada o con RLS relajada.
//
// Cuando el onboarding aterrice, borrar este archivo y su uso en CuentasScreen.
import type { AbstractPowerSyncDatabase } from '@powersync/react-native'
import * as Crypto from 'expo-crypto'

interface EspacioMiembroRow {
  espacio_id: string
}

/** Garantiza (idempotente) que el usuario tenga un espacio; devuelve su id. */
export async function asegurarEspacioDev(
  db: AbstractPowerSyncDatabase,
  userId: string,
): Promise<string> {
  const existentes = await db.getAll<EspacioMiembroRow>(
    'SELECT espacio_id FROM espacio_miembro WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
    [userId],
  )
  if (existentes.length > 0) return existentes[0].espacio_id

  const now = new Date().toISOString()
  const espacioId = Crypto.randomUUID()

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO espacio (id, nombre, owner_user_id, base_currency, country, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, 'COP', 'CO', ?, ?, NULL)`,
      [espacioId, 'Mi espacio', userId, now, now],
    )
    await tx.execute(
      `INSERT INTO espacio_miembro (id, espacio_id, user_id, rol, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, 'owner', ?, ?, NULL)`,
      [Crypto.randomUUID(), espacioId, userId, now, now],
    )
  })

  return espacioId
}
