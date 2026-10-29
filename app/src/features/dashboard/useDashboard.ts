// Datos de los 4 KPIs del dashboard (issue #11).
//
// Deudas SOLO por el contrato `DeudasSelectors` de @vaulto/shared: este módulo no
// conoce tablas ni carpetas de Track B (lo vigila la regla de ESLint). Como el
// contrato es async y no reactivo, se refresca al enfocar la pantalla.
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { sumarSaldos, type DeudasSelectors, type VencimientoResumen } from '@vaulto/shared'

import { useCuentas } from '@/features/cuentas/data/useCuentas'
import { useDeudasSelectors } from '@/lib/deudas/DeudasSelectorsProvider'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'

const MAX_VENCIMIENTOS = 3

export interface KpisDeudas {
  meDeben: number
  yoDebo: number
  vencimientos: VencimientoResumen[]
}

export interface Dashboard {
  /** Saldo total de cuentas NO archivadas (definición fija del plan). */
  disponible: string
  cuentasActivas: number
  /** null mientras carga o si la impl de deudas falló. */
  deudas: KpisDeudas | null
  errorDeudas: boolean
  cargandoCuentas: boolean
  refrescarDeudas: () => void
}

export function useDashboard(): Dashboard {
  const { espacioId } = useEspacioActual()
  const { cuentas, cargando } = useCuentas(espacioId)
  // El provider de Track B tipa el contexto como `any`: se fija aquí el contrato
  // para que un cambio de interfaz rompa en compilación y no en runtime.
  const selectors: DeudasSelectors = useDeudasSelectors()

  const [deudas, setDeudas] = useState<KpisDeudas | null>(null)
  const [errorDeudas, setErrorDeudas] = useState(false)

  const cargarDeudas = useCallback(() => {
    let activo = true
    Promise.all([
      selectors.getTotalPorDireccion('me_deben'),
      selectors.getTotalPorDireccion('yo_debo'),
      selectors.getProximosVencimientos(MAX_VENCIMIENTOS),
    ])
      .then(([meDeben, yoDebo, vencimientos]) => {
        if (!activo) return
        setDeudas({ meDeben, yoDebo, vencimientos })
        setErrorDeudas(false)
      })
      .catch((e) => {
        console.warn('[dashboard] DeudasSelectors falló', e)
        if (activo) setErrorDeudas(true)
      })
    // Si la pantalla pierde el foco antes de resolver, se descarta el resultado.
    return () => {
      activo = false
    }
  }, [selectors])

  useFocusEffect(cargarDeudas)

  const activas = cuentas.filter((c) => !c.archivada)
  return {
    disponible: sumarSaldos(activas.map((c) => c.saldo)),
    cuentasActivas: activas.length,
    deudas,
    errorDeudas,
    cargandoCuentas: cargando,
    refrescarDeudas: () => {
      cargarDeudas()
    },
  }
}
