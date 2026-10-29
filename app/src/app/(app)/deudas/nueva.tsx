import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import { Alert } from 'react-native'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { FormularioDeuda } from '@/features/deudas/FormularioDeuda'
import { crearDeuda, type DatosDeuda } from '@/features/deudas/data/deudasRepo'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'

export default function NuevaDeudaScreen() {
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const [guardando, setGuardando] = useState(false)

  async function guardar(datos: DatosDeuda) {
    if (!espacioId) {
      Alert.alert('Sin espacio', 'No hay un espacio activo todavía.')
      return
    }
    setGuardando(true)
    try {
      await crearDeuda(db, espacioId, datos)
      router.back()
    } catch (error) {
      Alert.alert('No se pudo guardar', String(error))
      setGuardando(false)
    }
  }

  return (
    <Screen>
      <ModalHeader title="Nueva deuda" onClose={() => router.back()} />
      <FormularioDeuda guardando={guardando} ctaLabel="Crear deuda" onSubmit={guardar} />
    </Screen>
  )
}
