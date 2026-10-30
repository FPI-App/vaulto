// Root layout: monta los providers globales y el guard de rutas protegidas.
// Orden de providers (de fuera hacia dentro):
//   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → AuthProvider →
//   [SyncProviders cuando hay sesión] → Stack
// PowerSync abre/cifra la SQLite local: solo se monta con sesión (no en login).
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { type ReactNode } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider'
import { DeudasSelectorsProvider } from '@/lib/deudas/DeudasSelectorsProvider'
import { PowerSyncProvider } from '@/lib/powersync/PowerSyncProvider'
import { ThemeProvider, useTheme } from '@/theme'

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <AuthProvider>
            <Navigation />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
