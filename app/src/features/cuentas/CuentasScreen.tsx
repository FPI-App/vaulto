// Lista de cuentas con saldo en vivo (issue #7). Dueño: lmilo (Track A).
// Sienta el patrón que copian Categorías y Movimientos: hook reactivo de datos +
// pantalla que solo pinta y navega.
import { useRouter } from 'expo-router'
import ArrowLeft from 'lucide-react-native/icons/arrow-left'
import Banknote from 'lucide-react-native/icons/banknote'
import Landmark from 'lucide-react-native/icons/landmark'
import Plus from 'lucide-react-native/icons/plus'
import { Pressable, StyleSheet, View } from 'react-native'
import { sumarSaldos } from '@vaulto/shared'

import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { IconBadge } from '@/components/IconBadge'
import { ListRow } from '@/components/ListRow'
import { Screen } from '@/components/Screen'
import { Text } from '@/components/Text'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { useCuentas, type CuentaConSaldo } from './data/useCuentas'

export function CuentasScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { espacioId, cargando: cargandoEspacio } = useEspacioActual()
  const { cuentas, cargando, error } = useCuentas(espacioId)

  function volver() {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  if (error) {
    return (
      <Screen tabBar>
        <EmptyState
          title="No se pudieron cargar las cuentas"
          hint="Tus datos se conservan. Vuelve a abrir esta pantalla para reintentar."
        />
      </Screen>
    )
  }

  // El onboarding (Track B) crea el espacio; el layout redirige ahí si falta.
  // Este estado solo se ve el instante en que la réplica local aún no lo trae.
  if (!cargandoEspacio && !espacioId) {
    return (
      <Screen tabBar>
        <EmptyState title="Preparando tu espacio" hint="Sincronizando tus datos…" />
      </Screen>
    )
  }

  const activas = cuentas.filter((c) => !c.archivada)
  const archivadas = cuentas.filter((c) => c.archivada)
  const totalDisponible = sumarSaldos(activas.map((c) => c.saldo))

  return (
    <Screen scroll tabBar>
      <View style={[styles.header, { paddingTop: theme.space.lg, paddingBottom: theme.space.xl, gap: theme.space.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={volver}
          hitSlop={4}
          style={({ pressed }) => [
            styles.volver,
            { backgroundColor: theme.colors.surface2, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ArrowLeft size={20} color={theme.colors.text} strokeWidth={2} />
        </Pressable>
        <Text variant="h1" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
          Cuentas
        </Text>
        <Button
          label="Nueva"
          variant="ghost"
          size="md"
          icon={Plus}
          onPress={() => router.push('/cuentas/nueva')}
        />
      </View>

      {cuentas.length > 0 ? (
        <Card style={{ gap: theme.space.sm, marginBottom: theme.space['2xl'] }}>
          <Text variant="label" tone="muted">
            Disponible total
          </Text>
          <Amount value={totalDisponible} variant="display" adjustsFontSizeToFit />
          <Text variant="caption" tone="muted">
            {activas.length === 0
              ? 'Sin cuentas activas'
              : `En ${activas.length} ${activas.length === 1 ? 'cuenta activa' : 'cuentas activas'}`}
          </Text>
        </Card>
      ) : null}

      {cuentas.length === 0 ? (
        cargando ? null : (
          <View style={styles.vacio}>
            <EmptyState
              icon={Landmark}
              title="Sin cuentas todavía"
              hint="Crea tu primera cuenta, de banco o efectivo, para empezar a registrar movimientos."
              action={<Button label="Crear tu primera cuenta" onPress={() => router.push('/cuentas/nueva')} />}
            />
          </View>
        )
      ) : null}

      {activas.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: theme.space.lg }}>
          {activas.map((c, i) => (
            <FilaCuenta
              key={c.id}
              cuenta={c}
              divider={i < activas.length - 1}
              onPress={() => router.push(`/cuentas/${c.id}`)}
            />
          ))}
        </Card>
      ) : null}

      {archivadas.length > 0 ? (
        <View style={{ marginTop: theme.space['3xl'] }}>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.space.md }}>
            Archivadas
          </Text>
          <Card padded={false} style={{ paddingHorizontal: theme.space.lg, opacity: 0.6 }}>
            {archivadas.map((c, i) => (
              <FilaCuenta
                key={c.id}
                cuenta={c}
                divider={i < archivadas.length - 1}
                onPress={() => router.push(`/cuentas/${c.id}`)}
              />
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  )
}

function FilaCuenta({
  cuenta,
  divider,
  onPress,
}: {
  cuenta: CuentaConSaldo
  divider: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  const negativo = Number.parseFloat(cuenta.saldo) < 0
  const esEfectivo = cuenta.tipo === 'efectivo'
  const subtitulo = esEfectivo ? 'Efectivo' : cuenta.banco ? `Banco · ${cuenta.banco}` : 'Banco'

  return (
    <ListRow
      divider={divider}
      onPress={onPress}
      leading={<IconBadge icon={esEfectivo ? Banknote : Landmark} color={theme.colors.actionText} />}
      title={cuenta.nombre}
      subtitle={cuenta.archivada ? `Archivada · ${subtitulo}` : subtitulo}
      trailing={
        <Amount
          value={cuenta.saldo}
          variant="bodyLg"
          tone={negativo ? 'expense' : undefined}
          style={{ fontFamily: theme.typography.fonts.semibold }}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  volver: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vacio: { minHeight: 360, flexDirection: 'row' },
})
