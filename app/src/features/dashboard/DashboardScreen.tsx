// Dashboard: 4 KPIs (issue #11). Dueño: lmilo (Track A).
//   1. Disponible: saldo total de cuentas no archivadas.
//   2. Me deben / 3. Debo: DeudasSelectors.getTotalPorDireccion.
//   4. Próximos vencimientos: DeudasSelectors.getProximosVencimientos.
// Con la impl noop, 2-4 muestran 0 / vacío; con la de Track B, valores reales sin tocar este archivo.
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { diasHastaVencimiento, etiquetaVencimiento, formatCOP, type VencimientoResumen } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

import { useDashboard } from './useDashboard'

export function DashboardScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { signOut } = useAuth()
  const { disponible, cuentasActivas, deudas, errorDeudas, refrescarDeudas } = useDashboard()

  const negativo = Number.parseFloat(disponible) < 0
  const tarjeta = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
  }
  const etiqueta = {
    ...theme.typography.scale.label,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textMuted,
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.space['4xl'] }}
      >
        <Text
          style={{
            ...theme.typography.scale.h1,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.text,
            marginTop: theme.space.lg,
            marginBottom: theme.space.lg,
          }}
        >
          Inicio
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityHint="Abre tus cuentas"
          onPress={() => router.push('/cuentas')}
          style={({ pressed }) => [styles.hero, tarjeta, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={etiqueta}>Disponible</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              ...theme.typography.scale.display,
              fontFamily: theme.typography.fontFamily,
              color: negativo ? theme.colors.financial.expense : theme.colors.text,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCOP(disponible)}
          </Text>
          <Text style={{ ...theme.typography.scale.caption, color: theme.colors.textMuted }}>
            {cuentasActivas === 0
              ? 'Aún no tienes cuentas activas'
              : `En ${cuentasActivas} ${cuentasActivas === 1 ? 'cuenta activa' : 'cuentas activas'}`}
          </Text>
        </Pressable>

        <View style={[styles.fila, { marginTop: theme.space.md }]}>
          <Kpi titulo="Me deben" valor={deudas?.meDeben} error={errorDeudas} />
          <Kpi titulo="Debo" valor={deudas?.yoDebo} error={errorDeudas} />
        </View>

        <View style={[styles.bloque, tarjeta, { marginTop: theme.space.md }]}>
          <Text style={[etiqueta, { marginBottom: theme.space.sm }]}>Próximos vencimientos</Text>
          {errorDeudas ? (
            <Pressable accessibilityRole="button" onPress={refrescarDeudas} hitSlop={8}>
              <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
                No se pudieron cargar las deudas. Toca para reintentar.
              </Text>
            </Pressable>
          ) : !deudas ? null : deudas.vencimientos.length === 0 ? (
            <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
              No tienes deudas por vencer.
            </Text>
          ) : (
            deudas.vencimientos.map((v, i) => (
              <FilaVencimiento key={v.deuda_id} v={v} conSeparador={i > 0} />
            ))
          )}
        </View>

        <View style={{ marginTop: theme.space.xl }}>
          <Button label="Registrar movimiento" onPress={() => router.push('/movimientos/nuevo')} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          hitSlop={8}
          style={{ marginTop: theme.space['3xl'], minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}
        >
          <Text style={{ ...etiqueta, color: theme.colors.brand[600] }}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  )
}

function Kpi({ titulo, valor, error }: { titulo: string; valor: number | undefined; error: boolean }) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.kpi,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.border },
      ]}
    >
      <Text style={{ ...theme.typography.scale.label, fontFamily: theme.typography.fontFamily, color: theme.colors.textMuted }}>
        {titulo}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          ...theme.typography.scale.h2,
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.financial.debt,
          fontVariant: ['tabular-nums'],
        }}
      >
        {error || valor === undefined ? '—' : formatCOP(valor)}
      </Text>
    </View>
  )
}

function FilaVencimiento({ v, conSeparador }: { v: VencimientoResumen; conSeparador: boolean }) {
  const theme = useTheme()
  // Vencida, hoy o mañana: se marca para que salte a la vista.
  const urgente = v.fecha_limite !== null && diasHastaVencimiento(v.fecha_limite) <= 1
  return (
    <View
      style={[
        styles.vencimiento,
        conSeparador && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
      ]}
    >
      <View style={styles.flex}>
        <Text
          numberOfLines={1}
          style={{ ...theme.typography.scale.bodyLg, fontFamily: theme.typography.fontFamily, color: theme.colors.text }}
        >
          {v.direccion === 'me_deben' ? `${v.contraparte} te debe` : `Le debes a ${v.contraparte}`}
        </Text>
        <Text
          style={{
            ...theme.typography.scale.caption,
            color: urgente ? theme.colors.financial.warning : theme.colors.textMuted,
          }}
        >
          {etiquetaVencimiento(v.fecha_limite)}
        </Text>
      </View>
      <Text
        style={{
          ...theme.typography.scale.bodyLg,
          fontWeight: theme.typography.weights.semibold,
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatCOP(v.saldo_pendiente, v.currency)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { padding: 20, gap: 4, borderWidth: 1 },
  fila: { flexDirection: 'row', gap: 12 },
  kpi: { flex: 1, padding: 16, gap: 4, borderWidth: 1 },
  bloque: { padding: 16, borderWidth: 1 },
  vencimiento: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  flex: { flex: 1 },
})
