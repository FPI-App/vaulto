import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'
import { diasHastaVencimiento, etiquetaVencimiento, formatCOP, sumarANumero } from '@vaulto/shared'
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left'
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import Handshake from 'lucide-react-native/icons/handshake'
import Plus from 'lucide-react-native/icons/plus'

import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { IconBadge } from '@/components/IconBadge'
import { ListRow } from '@/components/ListRow'
import { Screen, TAB_BAR_CLEARANCE } from '@/components/Screen'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Text } from '@/components/Text'
import { useTheme } from '@/theme'

import { useDeudas } from './data/useDeudas'

export function DeudasScreen() {
  const theme = useTheme()
  const router = useRouter()
  const [direccion, setDireccion] = useState<'yo_debo' | 'me_deben' | null>(null)
  // Se consulta todo una vez: el resumen de arriba suma ambas direcciones
  // aunque la lista esté filtrada.
  const { deudas: todas, cargando, error } = useDeudas(null)
  const deudas = useMemo(
    () => (direccion ? todas.filter((d) => d.direccion === direccion) : todas),
    [todas, direccion],
  )
  // Totales en centavos enteros (money.ts); solo deudas activas con saldo conocido.
  const totales = useMemo(() => {
    const saldos = (dir: 'me_deben' | 'yo_debo') =>
      todas.flatMap((d) => (d.estado === 'activa' && d.direccion === dir && d.saldo_pendiente !== null ? [d.saldo_pendiente] : []))
    return { me_deben: sumarANumero(saldos('me_deben')), yo_debo: sumarANumero(saldos('yo_debo')) }
  }, [todas])

  return (
    <Screen
      title="Deudas"
      tabBar
      headerRight={
        <Button label="Nueva" variant="ghost" icon={Plus} size="md" onPress={() => router.push('/deudas/nueva')} />
      }
    >
      <View style={[styles.fila, { gap: theme.space.md, marginBottom: theme.space.lg }]}>
        <Resumen titulo="Me deben" icon={ArrowDownLeft} valor={totales.me_deben} />
        <Resumen titulo="Yo debo" icon={ArrowUpRight} valor={totales.yo_debo} />
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
      {error ? (
        <Text accessibilityRole="alert" tone="muted" style={{ marginTop: theme.space.lg }}>
          No pudimos consultar tus deudas. Vuelve a abrir esta pantalla para reintentar.
        </Text>
      ) : null}
      <FlatList
        data={deudas}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: theme.space.lg, paddingBottom: TAB_BAR_CLEARANCE, flexGrow: 1 }}
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator accessibilityLabel="Cargando deudas" color={theme.colors.actionText} />
          ) : error ? undefined : (
            <EmptyState
              icon={Handshake}
              title="Sin deudas por ahora"
              hint="Aún no tienes deudas registradas. Cuando agregues una, la verás aquí."
            />
          )
        }
        renderItem={({ item }) => {
          const meDeben = item.direccion === 'me_deben'
          const saldada = item.estado === 'saldada'
          const conflicto = item.saldo_pendiente === null
          const proxima = !saldada && !conflicto && item.fecha_limite !== null && diasHastaVencimiento(item.fecha_limite) <= 1
          return (
            <Card padded={false} style={{ paddingHorizontal: theme.space.lg, marginBottom: theme.space.md }}>
              <ListRow
                accessibilityLabel={`${meDeben ? 'Te debe' : 'Debes a'} ${item.contraparte}, ${conflicto ? 'requiere revisión' : formatCOP(item.saldo_pendiente, item.currency)}`}
                onPress={() => router.push(`/deudas/${item.id}`)}
                leading={
                  <IconBadge
                    icon={saldada ? CircleCheck : meDeben ? ArrowDownLeft : ArrowUpRight}
                    color={saldada ? theme.colors.financial.success : theme.colors.financial.debt}
                  />
                }
                title={meDeben ? `${item.contraparte} te debe` : `Le debes a ${item.contraparte}`}
                subtitle={saldada ? 'Saldada' : conflicto ? 'Requiere revisión' : etiquetaVencimiento(item.fecha_limite)}
                trailing={
                  conflicto ? (
                    <Text tone="muted">Por revisar</Text>
                  ) : (
                    <>
                      <Amount
                        value={item.saldo_pendiente}
                        currency={item.currency}
                        variant="bodyLg"
                        tone={saldada ? 'success' : 'debt'}
                        style={{ fontFamily: theme.typography.fonts.semibold }}
                      />
                      {proxima ? (
                        <Text variant="caption" tone="warning" style={{ marginTop: 2 }}>
                          Pronto
                        </Text>
                      ) : null}
                    </>
                  )
                }
              />
            </Card>
          )
        }}
      />
    </Screen>
  )
}

function Resumen({ titulo, icon, valor }: { titulo: string; icon: typeof ArrowDownLeft; valor: number }) {
  const theme = useTheme()
  return (
    <Card style={{ flex: 1, gap: theme.space.md }}>
      <View style={styles.cabeza}>
        <IconBadge icon={icon} color={theme.colors.financial.debt} size={32} />
        <Text variant="label" tone="muted">
          {titulo}
        </Text>
      </View>
      <Amount value={valor} variant="h3" adjustsFontSizeToFit />
    </Card>
  )
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row' },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
