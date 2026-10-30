import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useRef, useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left'
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import Pencil from 'lucide-react-native/icons/pencil'
import { etiquetaVencimiento, formatCOP, formatMontoInput, normalizarMontoInput } from '@vaulto/shared'

import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { IconBadge } from '@/components/IconBadge'
import { ListRow } from '@/components/ListRow'
import { Text } from '@/components/Text'
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
  const { deuda, abonos, cargando, error, espacioId } = useDeuda(id)
  const [editando, setEditando] = useState(false)
  const [abono, setAbono] = useState('')
  const [notaAbono, setNotaAbono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const submitting = useRef(false)

  if (cargando || error || !deuda || !espacioId) {
    return (
      <Screen>
        <ModalHeader title="Deuda" onClose={() => router.back()} />
        <Text tone="muted" style={{ marginTop: theme.space.xl }}>
          {error ? 'No pudimos consultar esta deuda. Vuelve a abrir la pantalla para reintentar.' : cargando ? 'Cargando…' : 'No encontramos esta deuda.'}
        </Text>
      </Screen>
    )
  }

  const deudaActual = deuda
  const espacioActual = espacioId

  async function registrar() {
    if (submitting.current) return
    const monto = normalizarMontoInput(abono)
    if (!monto || Number(monto) <= 0) {
      Alert.alert('Abono inválido', 'Escribe un monto mayor que cero.')
      return
    }
    submitting.current = true
    setGuardando(true)
    try {
      await registrarAbono(db, espacioActual, deudaActual.id, monto, notaAbono)
      setAbono('')
      setNotaAbono('')
    } catch (error) {
      Alert.alert('No se pudo registrar el abono', String(error))
    } finally {
      submitting.current = false
      setGuardando(false)
    }
  }

  async function guardarCambios(datos: Parameters<typeof actualizarDeuda>[3]) {
    if (submitting.current) return
    submitting.current = true
    setGuardando(true)
    try {
      await actualizarDeuda(db, espacioActual, deudaActual.id, datos)
      setEditando(false)
    } catch (error) {
      Alert.alert('No se pudo actualizar', String(error))
    } finally {
      submitting.current = false
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

  const meDeben = deuda.direccion === 'me_deben'
  const inicial = Number(deuda.monto_inicial)
  const progreso =
    deuda.saldo_pendiente !== null && inicial > 0
      ? Math.min(1, Math.max(0, (inicial - Number(deuda.saldo_pendiente)) / inicial))
      : null

  return (
    <Screen>
      <ModalHeader title={editando && deuda.estado !== 'conflicto' ? 'Editar deuda' : 'Detalle de deuda'} onClose={() => router.back()} />
      {editando && deuda.estado !== 'conflicto' ? (
        <FormularioDeuda
          inicial={{ ...deuda, monto_inicial: formatMontoInput(deuda.monto_inicial) }}
          guardando={guardando}
          ctaLabel="Guardar cambios"
          onSubmit={guardarCambios}
        />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: theme.space.sm, paddingBottom: theme.space['4xl'] }}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
              <IconBadge
                icon={deuda.estado === 'saldada' ? CircleCheck : meDeben ? ArrowDownLeft : ArrowUpRight}
                color={deuda.estado === 'saldada' ? theme.colors.financial.success : theme.colors.financial.debt}
              />
              <View style={{ flex: 1 }}>
                <Text variant="label" tone="muted">
                  {meDeben ? 'Te debe' : 'Le debes a'}
                </Text>
                <Text variant="h3" numberOfLines={1}>
                  {deuda.contraparte}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: theme.space.xl }}>
              {deuda.saldo_pendiente === null ? (
                <Text variant="h2" tone="muted">
                  Saldo por revisar
                </Text>
              ) : (
                <Amount
                  value={deuda.saldo_pendiente}
                  variant="display"
                  tone={deuda.estado === 'saldada' ? 'success' : 'debt'}
                  adjustsFontSizeToFit
                />
              )}
              <Text tone="muted" style={{ marginTop: theme.space.xs }}>
                {deuda.estado === 'conflicto'
                  ? 'Esta deuda requiere revisión'
                  : deuda.estado === 'saldada'
                    ? 'Deuda saldada'
                    : 'Saldo pendiente'}
                {deuda.fecha_limite && deuda.estado !== 'saldada' ? ` · ${etiquetaVencimiento(deuda.fecha_limite)}` : ''}
              </Text>
            </View>
            {progreso !== null ? (
              <View style={{ marginTop: theme.space.xl }}>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={`Pagado ${Math.round(progreso * 100)} por ciento`}
                  style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.surface2, overflow: 'hidden' }}
                >
                  <View
                    style={{
                      height: 8,
                      width: `${Math.round(progreso * 100)}%`,
                      borderRadius: 4,
                      backgroundColor: deuda.estado === 'saldada' ? theme.colors.financial.success : theme.colors.financial.debt,
                    }}
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.space.sm, gap: theme.space.md }}>
                  <Text variant="caption" tone="muted">
                    Pagado {Math.round(progreso * 100)} %
                  </Text>
                  <Amount value={deuda.monto_inicial} variant="caption" tone="muted" accessibilityLabel={`de ${formatCOP(deuda.monto_inicial, deuda.currency)}`} />
                </View>
              </View>
            ) : null}
          </Card>
          {deuda.conflicto ? (
            <Text accessibilityRole="alert" style={{ marginTop: theme.space.lg }}>
              {deuda.conflicto}
            </Text>
          ) : null}
          {deuda.nota ? (
            <Text tone="muted" style={{ marginTop: theme.space.lg }}>
              {deuda.nota}
            </Text>
          ) : null}
          {deuda.estado === 'activa' ? (
            <Card style={{ marginTop: theme.space.xl }}>
              <Text variant="h3" accessibilityRole="header" style={{ marginBottom: theme.space.lg }}>
                Registrar abono
              </Text>
              <Field label="Monto" value={abono} onChangeText={setAbono} placeholder="0" keyboardType="decimal-pad" editable={!guardando} />
              <Field label="Nota del abono (opcional)" value={notaAbono} onChangeText={setNotaAbono} multiline maxLength={500} editable={!guardando} />
              <Button label="Aplicar abono" onPress={registrar} loading={guardando} />
            </Card>
          ) : null}
          <Text variant="h3" accessibilityRole="header" style={{ marginTop: theme.space['2xl'], marginBottom: theme.space.md }}>
            Historial de abonos
          </Text>
          <Card padded={false} style={{ paddingHorizontal: theme.space.lg }}>
            {abonos.length === 0 ? (
              <Text tone="muted" style={{ paddingVertical: theme.space.lg }}>
                Aún no has registrado abonos.
              </Text>
            ) : (
              abonos.map((pago, i) => (
                <ListRow
                  key={pago.id}
                  divider={i < abonos.length - 1}
                  title={new Date(pago.fecha).toLocaleDateString('es-CO')}
                  subtitle={pago.nota ?? undefined}
                  trailing={<Amount value={pago.monto} variant="bodyLg" />}
                />
              ))
            )}
          </Card>
          <View style={{ gap: theme.space.md, marginTop: theme.space['2xl'] }}>
            <Button label="Editar" variant="secondary" icon={Pencil} onPress={() => setEditando(true)} disabled={guardando || deuda.estado === 'conflicto'} />
            <Button label="Eliminar" variant="danger" onPress={confirmarEliminar} disabled={guardando || deuda.estado === 'conflicto'} />
          </View>
        </ScrollView>
      )}
    </Screen>
  )
}
