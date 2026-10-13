// Hooks reactivos de lectura de Categorías.
import { useEffect } from 'react'
import { usePowerSync, useQuery, useStatus } from '@powersync/react-native'
import type { TipoCategoria } from '@vaulto/shared'

import { sembrarCategoriasPorDefecto } from './categoriasRepo'

export interface CategoriaRow {
  id: string
  nombre: string
  tipo: TipoCategoria
  icono: string | null
  color: string | null
}

const COLUMNAS = 'id, nombre, tipo, icono, color'

/** Categorías activas del espacio de un tipo, ordenadas por nombre. */
export function useCategorias(
  espacioId: string | null,
  tipo: TipoCategoria,
): { categorias: CategoriaRow[]; cargando: boolean } {
  const { data, isLoading } = useQuery<CategoriaRow>(
    `SELECT ${COLUMNAS} FROM categoria
     WHERE espacio_id = ? AND tipo = ? AND deleted_at IS NULL
     ORDER BY nombre COLLATE NOCASE ASC`,
    [espacioId ?? '', tipo],
  )
  return { categorias: data, cargando: isLoading }
}

/** Una categoría activa por id (pantalla de edición). */
export function useCategoria(id: string): { categoria: CategoriaRow | null; cargando: boolean } {
  const { data, isLoading } = useQuery<CategoriaRow>(
    `SELECT ${COLUMNAS} FROM categoria WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  )
  return { categoria: data[0] ?? null, cargando: isLoading }
}

/**
 * Categoría por id aunque esté borrada: al editar un movimiento viejo hay que
 * seguir mostrando la que tenía. null si no hay id o no existe.
 */
export function useCategoriaHistorica(id: string | null): CategoriaRow | null {
  const { data } = useQuery<CategoriaRow>(`SELECT ${COLUMNAS} FROM categoria WHERE id = ? LIMIT 1`, [id ?? ''])
  return id ? (data[0] ?? null) : null
}

/**
 * Siembra las categorías sugeridas la primera vez, pero SOLO después del primer
 * sync completo: un dispositivo recién instalado ve la réplica vacía hasta
 * descargar, y sembrar antes haría que el upsert pisara las categorías que el
 * usuario ya editó o borró en otro dispositivo.
 */
export function useSembrarCategoriasAlSincronizar(espacioId: string | null): void {
  const db = usePowerSync()
  const { hasSynced } = useStatus()

  useEffect(() => {
    if (!espacioId || !hasSynced) return
    sembrarCategoriasPorDefecto(db, espacioId).catch((e) =>
      console.warn('[categorias] no se pudieron sembrar las sugeridas', e),
    )
  }, [db, espacioId, hasSynced])
}
