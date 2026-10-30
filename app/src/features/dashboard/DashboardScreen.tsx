// Dashboard: 4 KPIs (issue #11). Dueño: lmilo (Track A).
//   1. Disponible: saldo total de cuentas no archivadas.
//   2. Me deben / 3. Debo: DeudasSelectors.getTotalPorDireccion.
//   4. Próximos vencimientos: DeudasSelectors.getProximosVencimientos.
// Con la impl noop, 2-4 muestran 0 / vacío; con la de Track B, valores reales sin tocar este archivo.
import { useQuery } from '@powersync/react-native'
import { diasHastaVencimiento, etiquetaVencimiento, type VencimientoResumen } from '@vaulto/shared'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left'
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right'
import CalendarClock from 'lucide-react-native/icons/calendar-clock'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import { Pressable, StyleSheet, View } from 'react-native'

import { Amount } from '@/components/Amount'
import { Card } from '@/components/Card'
import { IconBadge } from '@/components/IconBadge'
import { ListRow } from '@/components/ListRow'
import { PressableScale } from '@/components/PressableScale'
import { Screen } from '@/components/Screen'
import { Text } from '@/components/Text'
import { useAuth } from '@/lib/auth/AuthProvider'
import { onBrand, useTheme } from '@/theme'

import { useDashboard } from './useDashboard'

export function DashboardScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { session } = useAuth()
  const { disponible, cuentasActivas, deudas, errorDeudas, refrescarDeudas } = useDashboard()
  const { data: perfil } = useQuery<{ nombre: string | null }>(
    'SELECT nombre FROM perfil WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [session?.user.id ?? ''],
  )
  const nombre = perfil[0]?.nombre?.trim()
  const fecha = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  // «Jueves, 29 de octubre»: solo la primera letra en mayúscula.
  const hoy = fecha.charAt(0).toUpperCase() + fecha.slice(1)

  return (
    <Screen scroll tabBar padded>
      <View style={[styles.saludo, { paddingTop: theme.space.lg, paddingBottom: theme.space.xl }]}>
        <Text variant="caption" tone="muted">
          {hoy}
        </Text>
        <Text variant="h1" heading={1} style={{ marginTop: 2 }}>
          {nombre ? `Hola, ${nombre}` : 'Hola'}
        </Text>
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Disponible. Abre tus cuentas"
        onPress={() => router.navigate('/cuentas')}
        scaleTo={0.985}
        style={[styles.hero, { borderRadius: theme.radius.lg + 4 }, theme.shadow.md]}
      >
        <LinearGradient
          colors={[theme.colors.brand[600], theme.colors.brand[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Luz de la bóveda: dos halos sutiles, decorativos. */}
        <View pointerEvents="none" style={[styles.halo, styles.haloA]} />
        <View pointerEvents="none" style={[styles.halo, styles.haloB]} />

        <Text variant="label" style={{ color: onBrand.textMuted }}>
          Disponible
        </Text>
        <Amount
          value={disponible}
          variant="display"
          tone="onBrand"
          adjustsFontSizeToFit
          style={{ marginTop: theme.space.sm, fontSize: 38, lineHeight: 46 }}
        />
        <View style={[styles.heroPie, { marginTop: theme.space.xl }]}>
          <Text variant="caption" style={{ color: onBrand.textMuted, flex: 1 }}>
            {cuentasActivas === 0
              ? 'Aún no tienes cuentas activas'
              : `En ${cuentasActivas} ${cuentasActivas === 1 ? 'cuenta activa' : 'cuentas activas'}`}
          </Text>
          <View style={styles.verCuentas}>
            <Text variant="label" tone="onBrand">
              Ver cuentas
            </Text>
            <ChevronRight size={16} color={onBrand.text} strokeWidth={2.2} />
          </View>
        </View>
      </PressableScale>

      <View style={[styles.fila, { marginTop: theme.space.lg, gap: theme.space.md }]}>
        <Kpi titulo="Me deben" icon={ArrowDownLeft} valor={deudas?.meDeben} error={errorDeudas} />
        <Kpi titulo="Debo" icon={ArrowUpRight} valor={deudas?.yoDebo} error={errorDeudas} />
      </View>

      <View style={[styles.seccion, { marginTop: theme.space['3xl'], marginBottom: theme.space.md }]}>
        <Text variant="h3" heading={2}>
          Próximos vencimientos
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/deudas')}
          style={{ minHeight: theme.layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Text variant="label" tone="brand">
            Ver deudas
          </Text>
        </Pressable>
      </View>
      <Card padded={false} style={{ paddingHorizontal: theme.space.lg }}>
        {errorDeudas ? (
          <Pressable accessibilityRole="button" onPress={refrescarDeudas} style={{ paddingVertical: theme.space.lg }}>
            <Text tone="muted">No pudimos cargar tus deudas. Toca para intentarlo de nuevo.</Text>
          </Pressable>
        ) : !deudas ? (
          <View style={{ height: 72 }} />
        ) : deudas.vencimientos.length === 0 ? (
          <View style={[styles.vacio, { paddingVertical: theme.space.xl, gap: theme.space.md }]}>
            <IconBadge icon={CalendarClock} color={theme.colors.textMuted} size={40} />
            <Text tone="muted" style={{ flex: 1 }}>
              No tienes pagos por vencer. Cuando registres una deuda con fecha, la verás aquí.
            </Text>
          </View>
        ) : (
          deudas.vencimientos.map((v, i) => (
            <FilaVencimiento key={v.deuda_id} v={v} divider={i < deudas.vencimientos.length - 1} />
          ))
        )}
      </Card>
    </Screen>
  )
}

function Kpi({
  titulo,
  icon,
  valor,
  error,
}: {
  titulo: string
  icon: typeof ArrowDownLeft
  valor: number | undefined
  error: boolean
}) {
  const theme = useTheme()
  return (
    <Card style={{ flex: 1, gap: theme.space.md }}>
      <View style={styles.kpiCabeza}>
        <IconBadge icon={icon} color={theme.colors.financial.debt} size={32} />
        <Text variant="label" tone="muted">
          {titulo}
        </Text>
      </View>
      {error || valor === undefined ? (
        <Text variant="h3" tone="muted">
          —
        </Text>
      ) : (
        <Amount value={valor} variant="h3" adjustsFontSizeToFit />
      )}
    </Card>
  )
}

function FilaVencimiento({ v, divider }: { v: VencimientoResumen; divider: boolean }) {
  const theme = useTheme()
  // Vencida, hoy o mañana: se marca para que salte a la vista, sin alarmismo (§8.2).
  const urgente = v.fecha_limite !== null && diasHastaVencimiento(v.fecha_limite) <= 1
  const meDeben = v.direccion === 'me_deben'
  return (
    <ListRow
      divider={divider}
      leading={<IconBadge icon={meDeben ? ArrowDownLeft : ArrowUpRight} color={theme.colors.financial.debt} />}
      title={meDeben ? `${v.contraparte} te debe` : `Le debes a ${v.contraparte}`}
      subtitle={etiquetaVencimiento(v.fecha_limite)}
      trailing={
        <>
          <Amount value={v.saldo_pendiente} variant="bodyLg" style={{ fontFamily: theme.typography.fonts.semibold }} />
          {urgente ? (
            <Text variant="caption" tone="warning" style={{ marginTop: 2 }}>
              Pronto
            </Text>
          ) : null}
        </>
      }
    />
  )
}

const styles = StyleSheet.create({
  saludo: {},
  hero: { overflow: 'hidden', padding: 24, minHeight: 176 },
  halo: { position: 'absolute', borderRadius: 999, backgroundColor: onBrand.halo },
  haloA: { width: 220, height: 220, top: -90, right: -60 },
  haloB: { width: 140, height: 140, bottom: -70, right: 40, backgroundColor: onBrand.haloAccent },
  heroPie: { flexDirection: 'row', alignItems: 'center' },
  verCuentas: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fila: { flexDirection: 'row' },
  kpiCabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seccion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vacio: { flexDirection: 'row', alignItems: 'center' },
})
