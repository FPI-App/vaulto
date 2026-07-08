import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatNumero } from '@vaulto/shared'

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
import { useTheme } from '@/theme'

export default function EditarCuentaScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { cuenta, cargando } = useCuenta(id)
  const [guardando, setGuardando] = useState(false)

  function onSubmit(datos: DatosCuenta) {
    setGuardando(true)
    actualizarCuenta(db, id, datos)
      .then(() => router.back())
      .catch((e) => {
        Alert.alert('No se pudo guardar', String(e))
        setGuardando(false)
      })
  }

  function toggleArchivar() {
    if (!cuenta) return
    archivarCuenta(db, id, cuenta.archivada !== 1).catch((e) => Alert.alert('Error', String(e)))
  }

  function confirmarEliminar() {
    Alert.alert('Eliminar cuenta', '¿Seguro? Dejará de aparecer en tus movimientos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          eliminarCuenta(db, id)
            .then(() => router.back())
            .catch((e) => Alert.alert('Error', String(e))),
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
              Cuenta no encontrada.
            </Text>
          )}
        </View>
      ) : (
        <>
          <FormularioCuenta
            guardando={guardando}
            ctaLabel="Guardar cambios"
            onSubmit={onSubmit}
            inicial={{
              nombre: cuenta.nombre,
              tipo: cuenta.tipo,
              banco: cuenta.banco,
              saldoInicialTexto: formatNumero(cuenta.saldo_inicial),
            }}
          />
          <View style={styles.acciones}>
            <Pressable accessibilityRole="button" onPress={toggleArchivar} hitSlop={8}>
              <Text
                style={{
                  ...theme.typography.scale.label,
                  fontFamily: theme.typography.fontFamily,
                  color: theme.colors.brand[600],
                  textAlign: 'center',
                }}
              >
                {cuenta.archivada === 1 ? 'Desarchivar cuenta' : 'Archivar cuenta'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmarEliminar} hitSlop={8}>
              <Text
                style={{
                  ...theme.typography.scale.label,
                  fontFamily: theme.typography.fontFamily,
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
