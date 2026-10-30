import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatMontoInput } from '@vaulto/shared'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import {
  actualizarCuenta,
  archivarCuenta,
  eliminarCuenta,
  type DatosCuenta,
} from '@/features/cuentas/data/cuentasRepo'
import { useCuenta } from '@/features/cuentas/data/useCuentas'
import { FormularioCuenta } from '@/features/cuentas/FormularioCuenta'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

export default function EditarCuentaScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { espacioId } = useEspacioActual()
  const { cuenta, cargando, error } = useCuenta(espacioId, id)
  const [guardando, setGuardando] = useState(false)
  const operacionPendiente = useRef(false)

  async function ejecutarOperacion(operacion: () => Promise<void>, cerrar = false) {
    if (!espacioId || !cuenta || operacionPendiente.current) return
    operacionPendiente.current = true
    setGuardando(true)
    try {
      await operacion()
      if (cerrar) router.back()
    } catch {
      Alert.alert('No se pudo guardar', 'Revisa los datos de la cuenta e inténtalo de nuevo.')
    } finally {
      operacionPendiente.current = false
      setGuardando(false)
    }
  }

  function onSubmit(datos: DatosCuenta) {
    if (!espacioId) return
    void ejecutarOperacion(() => actualizarCuenta(db, espacioId, id, datos), true)
  }

  function toggleArchivar() {
    if (!cuenta || !espacioId) return
    void ejecutarOperacion(() => archivarCuenta(db, espacioId, id, cuenta.archivada !== 1))
  }

  function confirmarEliminar() {
    if (!cuenta || !espacioId || operacionPendiente.current) return
    Alert.alert('Eliminar cuenta', '¿Seguro? Dejará de aparecer en tus movimientos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => { void ejecutarOperacion(() => eliminarCuenta(db, espacioId, id), true) },
      },
    ])
  }

  return (
    <Screen>
      <ModalHeader title="Editar cuenta" onClose={() => router.back()} />
      {!cuenta ? (
        <View style={styles.center}>
          {cargando ? (
            <ActivityIndicator color={theme.colors.brand[600]} />
          ) : (
            <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
              {error ? 'No se pudo cargar la cuenta. Inténtalo de nuevo.' : 'Cuenta no encontrada en este espacio.'}
            </Text>
          )}
        </View>
      ) : (
        <>
          <FormularioCuenta
            key={`${espacioId}:${id}`}
            guardando={guardando}
            ctaLabel="Guardar cambios"
            onSubmit={onSubmit}
            inicial={{
              nombre: cuenta.nombre,
              tipo: cuenta.tipo,
              banco: cuenta.banco,
              saldoInicialTexto: formatMontoInput(cuenta.saldo_inicial),
            }}
          />
          <View style={styles.acciones}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: guardando }} disabled={guardando} onPress={toggleArchivar} hitSlop={8}>
              <Text
                style={{
                  ...theme.typography.scale.label,
                  color: theme.colors.actionText,
                  textAlign: 'center',
                }}
              >
                {cuenta.archivada === 1 ? 'Desarchivar cuenta' : 'Archivar cuenta'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: guardando }} disabled={guardando} onPress={confirmarEliminar} hitSlop={8}>
              <Text
                style={{
                  ...theme.typography.scale.label,
                  color: theme.colors.financial.expense,
                  textAlign: 'center',
                }}
              >
                Eliminar cuenta
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  acciones: { gap: 16, marginTop: 8, marginBottom: 24 },
})
