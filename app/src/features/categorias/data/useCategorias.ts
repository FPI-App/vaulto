// Hooks reactivos de lectura de Categorías.
import { useEffect } from 'react'
import { usePowerSync, useQuery, useStatus } from '@powersync/react-native'
import type { TipoCategoria } from '@vaulto/shared'

import { sembrarCategoriasPorDefecto } from './categoriasRepo'
import { SELECT_CATEGORIAS, SELECT_CATEGORIA, SELECT_CATEGORIA_HISTORICA, type CategoriaRow } from './categoriasQueries'
export type { CategoriaRow } from './categoriasQueries'

/** Categorías activas del espacio de un tipo, ordenadas por nombre. */
export function useCategorias(
  espacioId: string | null,
  tipo: TipoCategoria,
): { categorias: CategoriaRow[]; cargando: boolean } {
  const { data, isLoading } = useQuery<CategoriaRow>(
    SELECT_CATEGORIAS,
    [espacioId ?? '', tipo],
  )
  return { categorias: data.filter((row) => row.espacio_id === espacioId && row.tipo === tipo), cargando: isLoading }
}

/** Una categoría activa por id (pantalla de edición). */
export function useCategoria(espacioId: string | null, id: string): { categoria: CategoriaRow | null; cargando: boolean } {
  const { data, isLoading } = useQuery<CategoriaRow>(
    SELECT_CATEGORIA,
    [id, espacioId ?? ''],
  )
  return { categoria: data.find((row) => row.id === id && row.espacio_id === espacioId) ?? null, cargando: isLoading }
}

/**
 * Categoría por id aunque esté borrada: al editar un movimiento viejo hay que
 * seguir mostrando la que tenía. null si no hay id o no existe.
 */
export function useCategoriaHistorica(espacioId: string | null, id: string | null): CategoriaRow | null {
  const { data } = useQuery<CategoriaRow>(SELECT_CATEGORIA_HISTORICA, [id ?? '', espacioId ?? ''])
  return id ? (data.find((row) => row.id === id && row.espacio_id === espacioId) ?? null) : null
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
    sembrarCategoriasPorDefecto(db, espacioId).catch(() =>
      console.warn('[categorias] no se pudieron sembrar las sugeridas'),
    )
  }, [db, espacioId, hasSynced])
}
