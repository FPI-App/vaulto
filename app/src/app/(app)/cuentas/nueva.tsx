import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import { Alert } from 'react-native'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { crearCuenta, type DatosCuenta } from '@/features/cuentas/data/cuentasRepo'
import { FormularioCuenta } from '@/features/cuentas/FormularioCuenta'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'

export default function NuevaCuentaScreen() {
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const [guardando, setGuardando] = useState(false)

  function onSubmit(datos: DatosCuenta) {
    if (!espacioId) {
      Alert.alert('Sin espacio', 'No hay un espacio activo todavía.')
      return
    }
    setGuardando(true)
    crearCuenta(db, espacioId, datos)
      .then(() => router.back())
      .catch((e) => {
        Alert.alert('No se pudo guardar', String(e))
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
