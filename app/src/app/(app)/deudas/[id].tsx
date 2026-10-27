import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { formatCOP, formatMontoInput, normalizarMontoInput } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { FormularioDeuda } from '@/features/deudas/FormularioDeuda'
import { actualizarDeuda, eliminarDeuda, registrarAbono } from '@/features/deudas/data/deudasRepo'
import { useDeuda } from '@/features/deudas/data/useDeudas'
import { useTheme } from '@/theme'

export default function DeudaDetalleScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { deuda, cargando, espacioId } = useDeuda(id)
  const [editando, setEditando] = useState(false)
  const [abono, setAbono] = useState('')
  const [guardando, setGuardando] = useState(false)

  if (cargando || !deuda || !espacioId) {
    return (
      <Screen>
        <ModalHeader title="Deuda" onClose={() => router.back()} />
        <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted, marginTop: 24 }}>
          {cargando ? 'Cargando…' : 'No encontramos esta deuda.'}
        </Text>
      </Screen>
    )
  }

  const deudaActual = deuda
  const espacioActual = espacioId

  async function registrar() {
    const monto = normalizarMontoInput(abono)
    if (!monto || Number(monto) <= 0) {
      Alert.alert('Abono inválido', 'Escribe un monto mayor que cero.')
      return
    }
    setGuardando(true)
    try {
      await registrarAbono(db, espacioActual, deudaActual.id, monto)
      setAbono('')
    } catch (error) {
      Alert.alert('No se pudo registrar el abono', String(error))
    } finally {
      setGuardando(false)
    }
  }

  async function guardarCambios(datos: Parameters<typeof actualizarDeuda>[3]) {
    setGuardando(true)
    try {
      await actualizarDeuda(db, espacioActual, deudaActual.id, datos)
      setEditando(false)
    } catch (error) {
      Alert.alert('No se pudo actualizar', String(error))
    } finally {
      setGuardando(false)
    }
  }

  function confirmarEliminar() {
    Alert.alert('Eliminar deuda', 'Se ocultará de la lista; sus datos se conservan para sincronizar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => eliminarDeuda(db, espacioActual, deudaActual.id).then(() => router.back()).catch((error) => Alert.alert('No se pudo eliminar', String(error))),
      },
    ])
  }

  return (
    <Screen>
      <ModalHeader title={editando ? 'Editar deuda' : 'Detalle de deuda'} onClose={() => router.back()} />
      {editando ? (
        <FormularioDeuda
          inicial={{ ...deuda, monto_inicial: formatMontoInput(deuda.monto_inicial) }}
          guardando={guardando}
          ctaLabel="Guardar cambios"
          onSubmit={guardarCambios}
        />
      ) : (
        <View style={{ flex: 1, paddingTop: theme.space.lg }}>
          <Text style={{ ...theme.typography.scale.label, color: theme.colors.textMuted }}>
            {deuda.direccion === 'yo_debo' ? 'Debes a' : 'Te debe'}
          </Text>
          <Text style={{ ...theme.typography.scale.h1, color: theme.colors.text, marginTop: theme.space.xs }}>
            {deuda.contraparte}
          </Text>
          <Text style={{ ...theme.typography.scale.display, color: theme.colors.financial.debt, fontVariant: ['tabular-nums'], marginTop: theme.space.lg }}>
            {formatCOP(deuda.saldo_pendiente, deuda.currency)}
          </Text>
          <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted, marginTop: theme.space.xs }}>
            {deuda.estado === 'saldada' ? 'Deuda saldada' : `Saldo de ${formatCOP(deuda.monto_inicial, deuda.currency)}`}
            {deuda.fecha_limite ? ` · Vence ${deuda.fecha_limite}` : ''}
          </Text>
          {deuda.nota ? <Text style={{ ...theme.typography.scale.body, color: theme.colors.text, marginTop: theme.space.lg }}>{deuda.nota}</Text> : null}
          {deuda.estado === 'activa' ? (
            <View style={{ marginTop: theme.space['2xl'] }}>
              <Field label="Registrar abono" value={abono} onChangeText={setAbono} placeholder="Monto" keyboardType="decimal-pad" />
              <Button label="Aplicar abono" onPress={registrar} loading={guardando} />
            </View>
          ) : null}
          <View style={{ gap: theme.space.sm, marginTop: theme.space['2xl'] }}>
            <Button label="Editar" variant="ghost" onPress={() => setEditando(true)} />
            <Button label="Eliminar" variant="ghost" onPress={confirmarEliminar} />
          </View>
        </View>
      )}
    </Screen>
  )
}
