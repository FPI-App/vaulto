import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatCOP } from '@vaulto/shared'

import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useTheme } from '@/theme'

import { useDeudas } from './data/useDeudas'

export function DeudasScreen() {
  const theme = useTheme()
  const router = useRouter()
  const [direccion, setDireccion] = useState<'yo_debo' | 'me_deben' | null>(null)
  const { deudas, cargando, error } = useDeudas(direccion)

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={{ ...theme.typography.scale.h1, color: theme.colors.text, fontFamily: theme.typography.fontFamily }}>
          Deudas
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/deudas/nueva')} hitSlop={8} style={{ minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}>
          <Text style={{ ...theme.typography.scale.label, color: theme.colors.actionText }}>+ Nueva</Text>
        </Pressable>
      </View>
      <SegmentedControl
        value={direccion ?? 'todas'}
        onChange={(value) => setDireccion(value === 'todas' ? null : value)}
        options={[
          { value: 'todas', label: 'Todas' },
          { value: 'yo_debo', label: 'Yo debo' },
          { value: 'me_deben', label: 'Me deben' },
        ]}
      />
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>No pudimos consultar tus deudas. Vuelve a abrir esta pantalla para reintentar.</Text> : null}
      <FlatList
        data={deudas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: theme.space.lg, paddingBottom: theme.space['4xl'], flexGrow: 1 }}
        ListEmptyComponent={cargando ? <ActivityIndicator accessibilityLabel="Cargando deudas" color={theme.colors.actionText} /> : error ? undefined : <EmptyState title="Sin deudas" hint="Registra lo que debes o lo que te deben." />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.direccion === 'yo_debo' ? 'Debes a' : 'Te debe'} ${item.contraparte}, ${item.saldo_pendiente === null ? 'requiere revisión' : formatCOP(item.saldo_pendiente)}`}
            onPress={() => router.push(`/deudas/${item.id}`)}
            style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
          >
            <View style={styles.cardHeading}>
              <Text style={{ ...theme.typography.scale.label, color: theme.colors.text, fontFamily: theme.typography.fontFamily, flex: 1 }}>
                {item.direccion === 'yo_debo' ? 'Debo a' : 'Me debe'} {item.contraparte}
              </Text>
              <Text style={{ ...theme.typography.scale.caption, color: item.estado === 'saldada' ? theme.colors.financial.success : theme.colors.financial.debt }}>
                {item.estado === 'conflicto' ? 'Requiere revisión' : item.estado === 'saldada' ? 'Saldada' : 'Activa'}
              </Text>
            </View>
            <Text style={{ ...theme.typography.scale.h2, color: theme.colors.financial.debt, fontVariant: ['tabular-nums'], marginTop: theme.space.sm }}>
              {item.saldo_pendiente === null ? 'Saldo por revisar' : formatCOP(item.saldo_pendiente, item.currency)}
            </Text>
            {item.fecha_limite ? (
              <Text style={{ ...theme.typography.scale.caption, color: theme.colors.textMuted, marginTop: theme.space.xs }}>
                Vence {item.fecha_limite}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  card: { borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
