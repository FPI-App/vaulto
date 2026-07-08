// Lista de cuentas con saldo en vivo (issue #7). Dueño: lmilo (Track A).
// Sienta el patrón que copian Categorías y Movimientos: hook reactivo de datos +
// pantalla que solo pinta y navega.
import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatCOP, sumarSaldos } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { asegurarEspacioDev } from '@/lib/dev/bootstrapEspacioDev'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { useCuentas, type CuentaConSaldo } from './data/useCuentas'

export function CuentasScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { session } = useAuth()
  const { espacioId, cargando: cargandoEspacio } = useEspacioActual()
  const { cuentas, cargando } = useCuentas(espacioId)

  // Sin espacio todavía: el onboarding (Track B) aún no corrió. En dev se puede
  // crear uno de prueba para no bloquear el desarrollo de Track A.
  if (!cargandoEspacio && !espacioId) {
    return (
      <Screen>
        <EmptyState
          title="Aún no tienes un espacio"
          hint="El espacio lo crea el onboarding (Track B). Mientras tanto, en desarrollo puedes crear uno de prueba para empezar a registrar cuentas."
          action={
            <Button
              label="Crear espacio de prueba (dev)"
              onPress={() => {
                if (!session) return
                asegurarEspacioDev(db, session.user.id).catch((e) =>
                  Alert.alert('No se pudo crear el espacio', String(e)),
                )
              }}
            />
          }
        />
      </Screen>
    )
  }

  const activas = cuentas.filter((c) => !c.archivada)
  const totalDisponible = sumarSaldos(activas.map((c) => c.saldo))

  return (
    <Screen>
      <View style={styles.header}>
        <Text
          style={{
            ...theme.typography.scale.h1,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.text,
          }}
        >
          Cuentas
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/cuentas/nueva')}
          hitSlop={8}
        >
          <Text
            style={{
              ...theme.typography.scale.label,
              fontFamily: theme.typography.fontFamily,
              color: theme.colors.brand[600],
            }}
          >
            + Nueva
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={cuentas}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: theme.space['4xl'] }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          cuentas.length > 0 ? (
            <View
              style={[
                styles.resumen,
                { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg },
              ]}
            >
              <Text style={{ ...theme.typography.scale.label, color: theme.colors.textMuted }}>
                Disponible total
              </Text>
              <Text
                style={{
                  ...theme.typography.scale.display,
                  fontFamily: theme.typography.fontFamily,
                  color: theme.colors.text,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatCOP(totalDisponible)}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <FilaCuenta cuenta={item} onPress={() => router.push(`/cuentas/${item.id}`)} />}
        ListEmptyComponent={
          cargando ? null : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title="Sin cuentas todavía"
                hint="Crea tu primera cuenta (banco o efectivo) para empezar a registrar movimientos."
                action={
                  <Button label="Crear tu primera cuenta" onPress={() => router.push('/cuentas/nueva')} />
                }
              />
            </View>
          )
        }
      />
    </Screen>
  )
}

function FilaCuenta({ cuenta, onPress }: { cuenta: CuentaConSaldo; onPress: () => void }) {
  const theme = useTheme()
  const negativo = Number.parseFloat(cuenta.saldo) < 0
  const subtitulo =
    cuenta.tipo === 'efectivo' ? 'Efectivo' : cuenta.banco ? `Banco · ${cuenta.banco}` : 'Banco'

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fila,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          opacity: cuenta.archivada ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.filaTexto}>
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.scale.bodyLg,
            fontWeight: theme.typography.weights.semibold,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.text,
          }}
        >
          {cuenta.nombre}
        </Text>
        <Text style={{ ...theme.typography.scale.caption, color: theme.colors.textMuted, marginTop: 2 }}>
          {cuenta.archivada ? `Archivada · ${subtitulo}` : subtitulo}
        </Text>
      </View>
      <Text
        style={{
          ...theme.typography.scale.h3,
          fontFamily: theme.typography.fontFamily,
          color: negativo ? theme.colors.financial.expense : theme.colors.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatCOP(cuenta.saldo)}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  resumen: { padding: 20, marginBottom: 16 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  filaTexto: { flex: 1 },
  emptyWrap: { minHeight: 360 },
})
