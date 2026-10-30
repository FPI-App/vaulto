import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { crearMovimiento, type DatosMovimiento } from '@/features/movimientos/data/movimientosRepo'
import { FormularioMovimiento } from '@/features/movimientos/FormularioMovimiento'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { showAlert } from '@/lib/ui/alert'

export default function NuevoMovimientoScreen() {
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const [guardando, setGuardando] = useState(false)

  function onSubmit(datos: DatosMovimiento) {
    if (!espacioId) {
      showAlert('Sin espacio', 'No hay un espacio activo todavía.')
      return
    }
    setGuardando(true)
    crearMovimiento(db, espacioId, datos)
      .then(() => router.back())
      .catch((e) => {
        showAlert('No se pudo guardar', String(e))
        setGuardando(false)
      })
  }

  return (
    <Screen>
      <ModalHeader title="Nuevo movimiento" onClose={() => router.back()} />
      <FormularioMovimiento espacioId={espacioId} guardando={guardando} ctaLabel="Guardar" onSubmit={onSubmit} />
    </Screen>
  )
}
