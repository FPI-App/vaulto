import { Tabs, useRouter, useSegments } from 'expo-router'
import { useEffect, useRef } from 'react'
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
  const { data: perfilData, isLoading } = useQuery('SELECT * FROM perfil')

  // Ref y no estado: el latch solo lo lee este efecto, no necesita re-render
  const completedRef = useRef(false)

  useEffect(() => {
    console.log('[Layout] useEffect disparado. isLoading:', isLoading, 'session:', !!session)
    if (isLoading || !session) return

    const isOnboarding = segments.includes('onboarding')
    const myProfile = perfilData?.find((p: any) => p.id === session.user.id)
    const hasProfile = !!myProfile
    const isCompleted = hasProfile && (myProfile.onboarding_completo == 1 || myProfile.onboarding_completo === true)

    // Si detectamos que se completó, guardamos este estado de forma optimista
    // Esto previene el "PowerSync Flicker" (cuando la mutación local se borra al subir, 
    // pero la descarga del servidor tarda un par de segundos en llegar).
    if (isCompleted) completedRef.current = true

    const effectivelyCompleted = completedRef.current

    console.log('[Layout] Estado actual -> isOnboarding:', isOnboarding, '| isCompleted (real):', isCompleted, '| effectivelyCompleted:', effectivelyCompleted)

    if (!effectivelyCompleted && !isOnboarding) {
      console.log('[Layout] Redirigiendo a onboarding porque no está completado.')
      router.replace('/(app)/onboarding')
    } else if (effectivelyCompleted && isOnboarding) {
      console.log('[Layout] Redirigiendo al dashboard porque ya está completado.')
      router.replace('/(app)')
    }
  }, [isLoading, perfilData, segments, router, session])

  // Ocultamos la barra de navegación si estamos en el flujo de onboarding
  const isOnboardingRoute = segments.includes('onboarding')

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
