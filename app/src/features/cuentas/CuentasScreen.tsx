// Lista de cuentas con saldo en vivo (issue #7). Dueño: lmilo (Track A).
// Sienta el patrón que copian Categorías y Movimientos: hook reactivo de datos +
// pantalla que solo pinta y navega.
import { useRouter } from 'expo-router'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatCOP, sumarSaldos } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { useCuentas, type CuentaConSaldo } from './data/useCuentas'

export function CuentasScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { espacioId, cargando: cargandoEspacio } = useEspacioActual()
  const { cuentas, cargando, error } = useCuentas(espacioId)

  if (error) {
    return (
      <Screen>
        <EmptyState title="No se pudieron cargar las cuentas" hint="Tus datos se conservan. Vuelve a abrir esta pantalla para reintentar." />
      </Screen>
    )
  }

  // El onboarding (Track B) crea el espacio; el layout redirige ahí si falta.
  // Este estado solo se ve el instante en que la réplica local aún no lo trae.
  if (!cargandoEspacio && !espacioId) {
    return (
      <Screen>
        <EmptyState title="Preparando tu espacio" hint="Sincronizando tus datos…" />
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
              color: theme.colors.actionText,
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
                  color: theme.colors.text,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatCOP(totalDisponible)}
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => <FilaCuenta cuenta={item} onPress={() => router.push(`/cuentas/${item.id}`)} />}
        ListEmptyComponent={
          cargando ? undefined : (
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
            fontFamily: theme.typography.fonts.semibold,
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
