import { Tabs } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useQuery, useStatus } from '@powersync/react-native'

import { Screen } from '@/components/Screen'
import { Text } from '@/components/Text'
import { TabBar } from '@/components/TabBar'
import { useTheme } from '@/theme'
import { useAuth } from '@/lib/auth/AuthProvider'

// Navegación principal autenticada (BRANDBOOK §6.6): Inicio · Movimientos ·
// (+) · Deudas · Perfil, con tab bar de vidrio propia (components/TabBar).
export default function AppTabsLayout() {
  const { session, initializing } = useAuth()

  if (initializing || !session) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator accessibilityLabel="Cargando sesión" />
        </View>
      </Screen>
    )
  }

  return <AuthenticatedTabs userId={session.user.id} />
}

function AuthenticatedTabs({ userId }: { userId: string }) {
  const theme = useTheme()
  const { hasSynced } = useStatus()

  // Verificamos el estado del perfil en la base local (PowerSync)
  const { data: perfilData, isLoading, error } = useQuery<{ onboarding_completo: number | boolean }>(
    'SELECT onboarding_completo FROM perfil WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [userId],
  )

  const myProfile = perfilData[0]
  const isCompleted = Boolean(
    myProfile && (myProfile.onboarding_completo === 1 || myProfile.onboarding_completo === true),
  )

  if (isLoading || error || (!myProfile && !hasSynced)) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          {error ? (
            <Text accessibilityRole="alert" style={{ textAlign: 'center' }}>
              No pudimos consultar tu perfil. Cierra y vuelve a abrir la app para reintentar.
            </Text>
          ) : (
            <>
              <ActivityIndicator accessibilityLabel="Cargando perfil" color={theme.colors.actionText} />
              {!hasSynced && !myProfile ? <Text tone="muted" style={{ textAlign: 'center', maxWidth: 280 }}>Conecta a internet para recuperar tu perfil antes de configurar este dispositivo.</Text> : null}
            </>
          )}
        </View>
      </Screen>
    )
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Protected guard={isCompleted} redirectTo="/onboarding">
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
        <Tabs.Screen name="deudas" options={{ title: 'Deudas' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
        {/* Fuera de la barra (TabBar solo dibuja sus 4 destinos). Sin `href: null`:
            en web esa opción hace que la ruta redirija a Inicio. */}
        <Tabs.Screen name="cuentas" options={{ title: 'Cuentas' }} />
        <Tabs.Screen name="categorias" options={{ title: 'Categorías' }} />
      </Tabs.Protected>
      <Tabs.Protected guard={!isCompleted} redirectTo="/(app)">
        <Tabs.Screen name="onboarding" options={{ title: 'Configuración inicial' }} />
      </Tabs.Protected>
    </Tabs>
  )
}
