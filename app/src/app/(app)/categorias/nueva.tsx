import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import { Alert } from 'react-native'
import type { TipoCategoria } from '@vaulto/shared'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { crearCategoria, type DatosCategoria } from '@/features/categorias/data/categoriasRepo'
import { FormularioCategoria } from '@/features/categorias/FormularioCategoria'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'

export default function NuevaCategoriaScreen() {
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const params = useLocalSearchParams<{ tipo?: string }>()
  const [tipo, setTipo] = useState<TipoCategoria>(params.tipo === 'ingreso' ? 'ingreso' : 'egreso')
  const [guardando, setGuardando] = useState(false)

  function onSubmit(datos: DatosCategoria) {
    if (!espacioId) {
      Alert.alert('Sin espacio', 'No hay un espacio activo todavía.')
      return
    }
    setGuardando(true)
    crearCategoria(db, espacioId, tipo, datos)
      .then(() => router.back())
      .catch((e) => {
        Alert.alert('No se pudo guardar', String(e))
        setGuardando(false)
      })
  }

  return (
    <Screen>
      <ModalHeader title="Nueva categoría" onClose={() => router.back()} />
      <FormularioCategoria
        tipo={tipo}
        onCambiarTipo={setTipo}
        guardando={guardando}
        ctaLabel="Crear categoría"
        onSubmit={onSubmit}
      />
    </Screen>
  )
}
