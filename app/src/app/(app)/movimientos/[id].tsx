import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import Trash from 'lucide-react-native/icons/trash'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { formatMontoInput } from '@vaulto/shared'

import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { Text } from '@/components/Text'
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
import { showAlert } from '@/lib/ui/alert'

export default function EditarMovimientoScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { movimiento, cargando } = useMovimiento(espacioId, id)
  const [guardando, setGuardando] = useState(false)

  function onSubmit(datos: DatosMovimiento) {
    if (!espacioId) return
    setGuardando(true)
    actualizarMovimiento(db, espacioId, id, datos)
      .then(() => router.back())
      .catch((e) => {
        showAlert('No se pudo guardar', String(e))
        setGuardando(false)
      })
  }

  function confirmarEliminar() {
    if (!espacioId) return
    showAlert('Eliminar movimiento', 'Los saldos de las cuentas se recalculan sin él.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          eliminarMovimiento(db, espacioId, id)
            .then(() => router.back())
            .catch((e) => showAlert('Error', String(e))),
      },
    ])
  }

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
            <Text tone="muted">
              Movimiento no encontrado.
            </Text>
          )}
        </View>
      ) : movimiento.pago_id ? (
        // Lo creó Deudas al registrar un abono: se edita desde la deuda, no aquí.
        <Card style={{ gap: theme.space.sm, marginTop: theme.space.lg }}>
          <Text variant="label" tone="muted">
            Abono de deuda
          </Text>
          <Amount value={movimiento.monto} kind="debt" variant="display" adjustsFontSizeToFit />
          <Text tone="muted">
            {etiquetaDia(parseFecha(movimiento.fecha))}
            {movimiento.nota ? ` · ${movimiento.nota}` : ''}
          </Text>
          <Text style={{ marginTop: theme.space.md }}>
            Este movimiento se generó al registrar un abono. Para cambiarlo o anularlo, hazlo desde la deuda.
          </Text>
        </Card>
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
          <View style={styles.eliminar}>
            <Button label="Eliminar movimiento" variant="danger" icon={Trash} onPress={confirmarEliminar} />
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eliminar: { marginTop: 8, marginBottom: 24 },
})
