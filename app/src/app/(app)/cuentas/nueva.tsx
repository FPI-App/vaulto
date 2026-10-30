import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useRef, useState } from 'react'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { crearCuenta, type DatosCuenta } from '@/features/cuentas/data/cuentasRepo'
import { FormularioCuenta } from '@/features/cuentas/FormularioCuenta'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { showAlert } from '@/lib/ui/alert'

export default function NuevaCuentaScreen() {
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const [guardando, setGuardando] = useState(false)
  const operacionPendiente = useRef(false)

  function onSubmit(datos: DatosCuenta) {
    if (operacionPendiente.current) return
    if (!espacioId) {
      showAlert('Sin espacio', 'No hay un espacio activo todavía.')
      return
    }
    operacionPendiente.current = true
    setGuardando(true)
    crearCuenta(db, espacioId, datos)
      .then(() => router.back())
      .catch(() => showAlert('No se pudo guardar', 'Revisa los datos de la cuenta e inténtalo de nuevo.'))
      .finally(() => {
        operacionPendiente.current = false
        setGuardando(false)
      })
  }

  return (
    <Screen>
      <ModalHeader title="Nueva cuenta" onClose={() => router.back()} />
      <FormularioCuenta guardando={guardando} ctaLabel="Crear cuenta" onSubmit={onSubmit} />
    </Screen>
  )
}
