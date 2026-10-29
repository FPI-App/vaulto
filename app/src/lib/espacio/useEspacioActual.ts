// Resuelve el espacio activo del usuario en sesión. Costura compartida entre
// tracks: tanto Track A (cuentas/movimientos) como Track B (deudas) necesitan
// saber a qué `espacio_id` pertenecen las filas. Solo LEE (el espacio lo crea el
// onboarding de Track B, #14).
import { useQuery } from '@powersync/react-native'

import { useAuth } from '@/lib/auth/AuthProvider'

interface EspacioMiembroRow {
  espacio_id: string
}

export interface EspacioActual {
  /** id del espacio activo, o null si el usuario aún no tiene uno. */
  espacioId: string | null
  /** true mientras la consulta local resuelve. */
  cargando: boolean
}

/**
 * Devuelve el primer espacio del que el usuario es miembro. En el MVP un usuario
 * tiene exactamente un espacio; el modo pareja (futuro) permitirá más y aquí se
 * elegiría el activo. Reactivo: si el onboarding crea el espacio, se actualiza.
 */
export function useEspacioActual(): EspacioActual {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''

  const { data, isLoading } = useQuery<EspacioMiembroRow>(
    `SELECT espacio_id FROM espacio_miembro
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId],
  )

  return { espacioId: data[0]?.espacio_id ?? null, cargando: isLoading }
}
