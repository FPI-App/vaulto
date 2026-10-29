import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { esIconoCategoria } from '@vaulto/shared'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import {
  actualizarCategoria,
  eliminarCategoria,
  type DatosCategoria,
} from '@/features/categorias/data/categoriasRepo'
import { useCategoria } from '@/features/categorias/data/useCategorias'
import { FormularioCategoria } from '@/features/categorias/FormularioCategoria'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

export default function EditarCategoriaScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { espacioId } = useEspacioActual()
  const { categoria, cargando } = useCategoria(espacioId, id)
  const [guardando, setGuardando] = useState(false)
  const pendiente = useRef(false)

  async function ejecutar(operacion: () => Promise<void>) {
    if (!espacioId || !categoria || pendiente.current) return
    pendiente.current = true
    setGuardando(true)
    try { await operacion(); router.back() } catch {
      Alert.alert('No se pudo guardar', 'Revisa los datos e inténtalo de nuevo.')
    } finally { pendiente.current = false; setGuardando(false) }
  }

  function onSubmit(datos: DatosCategoria) {
    if (!espacioId) return
    void ejecutar(() => actualizarCategoria(db, espacioId, id, datos))
  }

  function confirmarEliminar() {
    if (!espacioId || pendiente.current) return
    Alert.alert(
      'Eliminar categoría',
      'Los movimientos que la usan se conservan, pero ya no podrás elegirla en movimientos nuevos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => { void ejecutar(() => eliminarCategoria(db, espacioId, id)) },
        },
      ],
    )
  }

  return (
    <Screen>
      <ModalHeader title="Editar categoría" onClose={() => router.back()} />
      {!categoria ? (
        <View style={styles.center}>
          {cargando ? (
            <ActivityIndicator color={theme.colors.brand[600]} />
          ) : (
            <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
              Categoría no encontrada.
            </Text>
          )}
        </View>
      ) : (
        <>
          <FormularioCategoria
            key={`${espacioId}:${id}`}
            tipo={categoria.tipo}
            guardando={guardando}
            ctaLabel="Guardar cambios"
            onSubmit={onSubmit}
            inicial={{
              nombre: categoria.nombre,
              icono: esIconoCategoria(categoria.icono) ? categoria.icono : undefined,
              color: categoria.color ?? undefined,
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={confirmarEliminar}
            hitSlop={8}
            style={[styles.eliminar, { minHeight: theme.layout.minTouchTarget }]}
          >
            <Text
              style={{
                ...theme.typography.scale.label,
                fontFamily: theme.typography.fontFamily,
                color: theme.colors.financial.expense,
              }}
            >
              Eliminar categoría
            </Text>
          </Pressable>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eliminar: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
})
