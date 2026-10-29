import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { usePowerSync } from '@powersync/react-native'
import { noopDeudasSelectors, type DeudasSelectors } from '@vaulto/shared'

import { SQLiteDeudasSelectors } from '@/features/deudas/data/deudasSelectors'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'

const DeudasSelectorsContext = createContext<DeudasSelectors>(noopDeudasSelectors)

export function DeudasSelectorsProvider({ children }: { children: ReactNode }) {
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const selectors = useMemo(
    () => (espacioId ? new SQLiteDeudasSelectors(db, espacioId) : noopDeudasSelectors),
    [db, espacioId],
  )

  return (
    <DeudasSelectorsContext.Provider value={selectors}>
      {children}
    </DeudasSelectorsContext.Provider>
  )
}

export const useDeudasSelectors = () => useContext(DeudasSelectorsContext)
