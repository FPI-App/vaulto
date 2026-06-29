import { Tabs, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { useQuery } from '@powersync/react-native'

import { useTheme } from '@/theme'
import { useAuth } from '@/lib/auth/AuthProvider'

// Navegación principal autenticada. Cinco destinos del MVP:
// Inicio (dashboard) · Cuentas · Movimientos · Deudas · Perfil.
// Iconos definitivos: Lucide outline (BRAND.md §4). Aquí texto-only para no
// acoplar el spine a una librería de iconos antes de tiempo.
export default function AppTabsLayout() {
  const theme = useTheme()
  const { session } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  // Verificamos el estado del perfil en la base local (PowerSync)
  const { data: perfilData, isLoading } = useQuery(
    'SELECT onboarding_completo FROM perfil WHERE id = ?',
    [session?.user?.id]
  )

  useEffect(() => {
    if (isLoading || !session) return

    const isOnboarding = segments[segments.length - 1] === 'onboarding'
    const hasProfile = perfilData && perfilData.length > 0
    const isCompleted = hasProfile && perfilData[0].onboarding_completo === 1

    if (!isCompleted && !isOnboarding) {
      router.replace('/(app)/onboarding')
    } else if (isCompleted && isOnboarding) {
      router.replace('/(app)')
    }
  }, [isLoading, perfilData, segments, router, session])

  // Ocultamos la barra de navegación si estamos en el flujo de onboarding
  const isOnboardingRoute = segments[segments.length - 1] === 'onboarding'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand[600],
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
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="cuentas" options={{ title: 'Cuentas' }} />
      <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="deudas" options={{ title: 'Deudas' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      {/* Rutas fuera de la tab bar (modales / flujos): se ocultan como tabs. */}
      <Tabs.Screen name="categorias" options={{ href: null }} />
      <Tabs.Screen name="onboarding" options={{ href: null }} />
    </Tabs>
  )
}
