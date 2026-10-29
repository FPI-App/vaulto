import { Tabs, usePathname } from 'expo-router'
import { ActivityIndicator, Text, View } from 'react-native'
import { useQuery, useStatus } from '@powersync/react-native'

import { Screen } from '@/components/Screen'
import { useTheme } from '@/theme'
import { useAuth } from '@/lib/auth/AuthProvider'

// Navegación principal autenticada. Cinco destinos del MVP:
// Inicio (dashboard) · Cuentas · Movimientos · Deudas · Perfil.
// Iconos definitivos: Lucide outline (BRAND.md §4). Aquí texto-only para no
// acoplar el spine a una librería de iconos antes de tiempo.
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
  const pathname = usePathname()
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

  // Ocultamos la barra de navegación si estamos en el flujo de onboarding
  const isOnboardingRoute = pathname === '/onboarding'

  if (isLoading || error || (!myProfile && !hasSynced)) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>
              No pudimos consultar tu perfil. Cierra y vuelve a abrir la app para reintentar.
            </Text>
          ) : (
            <>
              <ActivityIndicator accessibilityLabel="Cargando perfil" color={theme.colors.actionText} />
              {!hasSynced && !myProfile ? <Text style={{ color: theme.colors.textMuted }}>Conecta a internet para recuperar tu perfil antes de configurar este dispositivo.</Text> : null}
            </>
          )}
        </View>
      </Screen>
    )
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.actionText,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: isOnboardingRoute
          ? { display: 'none' }
          : {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.scale.label.fontSize,
        },
      }}
    >
      <Tabs.Protected guard={isCompleted} redirectTo="/onboarding">
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="cuentas" options={{ title: 'Cuentas' }} />
        <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
        <Tabs.Screen name="deudas" options={{ title: 'Deudas' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
        <Tabs.Screen name="categorias" options={{ href: null }} />
      </Tabs.Protected>
      <Tabs.Protected guard={!isCompleted} redirectTo="/(app)">
        <Tabs.Screen name="onboarding" options={{ title: 'Configuración inicial' }} />
      </Tabs.Protected>
    </Tabs>
  )
}
