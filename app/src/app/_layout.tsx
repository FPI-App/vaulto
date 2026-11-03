// Root layout: monta los providers globales y el guard de rutas protegidas.
// Orden de providers (de fuera hacia dentro):
//   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → AuthProvider →
//   [SyncProviders cuando hay sesión] → Stack
// PowerSync abre/cifra la SQLite local: solo se monta con sesión (no en login).
import { useFonts } from 'expo-font'
import { Stack, usePathname } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { type ReactNode, useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppFrame } from '@/components/AppFrame'
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider'
import { DeudasSelectorsProvider } from '@/lib/deudas/DeudasSelectorsProvider'
import { PowerSyncProvider } from '@/lib/powersync/PowerSyncProvider'
import { rememberInitialPath } from '@/lib/navigation/initialPath'
import { AlertHost } from '@/lib/ui/alert'
import { ThemeProvider, useTheme } from '@/theme'
import { fontSources } from '@/theme/fontSources'

void SplashScreen.preventAutoHideAsync()

/**
 * Monta los providers de sincronización solo cuando hay sesión. Sin ella
 * (pantallas de auth) devuelve los hijos sin tocar la SQLite cifrada.
 * El árbol de rutas (Stack) es siempre el mismo nodo: evita remontajes.
 */
function SyncProviders({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  if (!session) {
    return <>{children}</>
  }

  return (
    <PowerSyncProvider key={session.user.id} userId={session.user.id}>
      <DeudasSelectorsProvider>{children}</DeudasSelectorsProvider>
    </PowerSyncProvider>
  )
}

function Navigation() {
  const { session, initializing, isRecoveringPassword } = useAuth()
  rememberInitialPath(usePathname())

  return (
    <SyncProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Protected
          guard={initializing || Boolean(session && !isRecoveringPassword)}
          redirectTo={isRecoveringPassword ? '/(auth)/set-password' : '/(auth)/login'}
        >
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </SyncProviders>
  )
}

function ThemedStatusBar() {
  const theme = useTheme()
  return <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontSources)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync()
    }
  }, [fontError, fontsLoaded])

  // Si la fuente falla se sigue con la del sistema: no bloquear la app por tipografía.
  if (!fontsLoaded && !fontError) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <AppFrame>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
            <AlertHost />
          </AppFrame>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
