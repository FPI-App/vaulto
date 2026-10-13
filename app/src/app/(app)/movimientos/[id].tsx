import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatCOP, formatMontoInput } from '@vaulto/shared'

import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import {
  actualizarMovimiento,
  eliminarMovimiento,
  type DatosMovimiento,
} from '@/features/movimientos/data/movimientosRepo'
import { useMovimiento } from '@/features/movimientos/data/useMovimientos'
import { etiquetaDia, parseFecha } from '@/features/movimientos/fechas'
import { FormularioMovimiento } from '@/features/movimientos/FormularioMovimiento'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

export default function EditarMovimientoScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { movimiento, cargando } = useMovimiento(id)
  const [guardando, setGuardando] = useState(false)

  function onSubmit(datos: DatosMovimiento) {
    setGuardando(true)
    actualizarMovimiento(db, id, datos)
      .then(() => router.back())
      .catch((e) => {
        Alert.alert('No se pudo guardar', String(e))
        setGuardando(false)
      })
  }

  function confirmarEliminar() {
    Alert.alert('Eliminar movimiento', 'Los saldos de las cuentas se recalculan sin él.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          eliminarMovimiento(db, id)
            .then(() => router.back())
            .catch((e) => Alert.alert('Error', String(e))),
      },
    ])
  }

  const texto = { fontFamily: theme.typography.fontFamily, color: theme.colors.text }

  return (
    <Screen>
      <ModalHeader
        title={movimiento?.pago_id ? 'Abono de deuda' : 'Editar movimiento'}
        onClose={() => router.back()}
      />
      {!movimiento ? (
        <View style={styles.center}>
          {cargando ? (
            <ActivityIndicator color={theme.colors.brand[600]} />
          ) : (
            <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
              Movimiento no encontrado.
            </Text>
          )}
        </View>
      ) : movimiento.pago_id ? (
        // Lo creó Deudas al registrar un abono: se edita desde la deuda, no aquí.
        <View style={{ gap: theme.space.sm, paddingVertical: theme.space.lg }}>
          <Text style={{ ...theme.typography.scale.display, ...texto, fontVariant: ['tabular-nums'] }}>
            {formatCOP(movimiento.monto)}
          </Text>
          <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
            {etiquetaDia(parseFecha(movimiento.fecha))}
            {movimiento.nota ? ` · ${movimiento.nota}` : ''}
          </Text>
          <Text style={{ ...theme.typography.scale.body, ...texto, marginTop: theme.space.md }}>
            Este movimiento se generó al registrar un abono. Para cambiarlo o anularlo, hazlo desde la deuda.
          </Text>
        </View>
      ) : (
        <>
          <FormularioMovimiento
            espacioId={espacioId}
            guardando={guardando}
            ctaLabel="Guardar cambios"
            onSubmit={onSubmit}
            inicial={{
              tipo: movimiento.tipo,
              montoTexto: formatMontoInput(movimiento.monto),
              cuenta_id: movimiento.cuenta_id,
              cuenta_destino_id: movimiento.cuenta_destino_id,
              categoria_id: movimiento.categoria_id,
              fecha: parseFecha(movimiento.fecha),
              nota: movimiento.nota,
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
              Eliminar movimiento
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
