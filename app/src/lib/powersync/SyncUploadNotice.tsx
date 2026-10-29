import { usePowerSync, useQuery, useStatus } from '@powersync/react-native'
import { Alert, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SyncUploadError } from '@/lib/sync/SyncUploadError'
import { useTheme } from '@/theme'
import { Button } from '@/components/Button'
import { SyncRecoveryStore, esLoteAbono, type RecoveryRow, type SyncOperation } from '@/lib/sync/SyncRecoveryStore'

function resumir(row: RecoveryRow | undefined): { deudaId: string; monto: string; currency: string } | null {
  try {
    if (!row) return null
    const ops: SyncOperation[] = JSON.parse(row.operations_json)
    if (!esLoteAbono(ops)) return null
    const pago = ops.find((op) => op.table === 'pago')!
    if (typeof pago.data.deuda_id !== 'string' || typeof pago.data.monto !== 'string') return null
    return { deudaId: pago.data.deuda_id, monto: pago.data.monto, currency: typeof pago.data.currency === 'string' ? pago.data.currency : 'COP' }
  } catch { return null }
}

export function SyncUploadNotice() {
  const theme = useTheme()
  const { uploadError } = useStatus()
  const db = usePowerSync()
  const { data } = useQuery<RecoveryRow>("SELECT batch_id, operations_json, decision FROM vaulto_sync_recovery WHERE decision IN ('blocked', 'requested') ORDER BY created_at LIMIT 1")
  const pending = data[0]
  const summary = resumir(pending)
  const { data: deudas } = useQuery<{ contraparte: string }>('SELECT contraparte FROM deuda WHERE id = ? LIMIT 1', [summary?.deudaId ?? ''])
  if (!uploadError) return null

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface }}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{
        ...theme.typography.scale.body, color: theme.colors.text,
        paddingHorizontal: theme.layout.screenPadding, paddingVertical: theme.space.sm,
      }}>
        {uploadError instanceof SyncUploadError
          ? uploadError.message
          : 'Hay cambios pendientes de sincronizar. Siguen guardados en este dispositivo.'}
      </Text>
      {pending && summary ? (
        <View style={{ paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.space.sm }}>
          {pending.decision === 'requested' ? <Text style={{ color: theme.colors.textMuted }}>Anulación pendiente de conexión. Conservamos el registro del abono.</Text> : (
            <Button label="Revisar abono pendiente" variant="ghost" onPress={() => Alert.alert(
              'Anular abono pendiente',
              `Abono de ${summary.monto} ${summary.currency}${deudas[0]?.contraparte ? ` a ${deudas[0].contraparte}` : ''}. Se anulará este abono rechazado y su ajuste de saldo asociado. Conservaremos un registro en este dispositivo. Los pagos ya sincronizados no se eliminan.`,
              [
                { text: 'Volver', style: 'cancel' },
                { text: 'Anular abono', onPress: () => { void new SyncRecoveryStore(db).requestCancellation(pending.batch_id).catch(() => Alert.alert('No se pudo solicitar la anulación', 'Tus datos siguen guardados. Inténtalo de nuevo.')) } },
              ],
            )} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  )
}
