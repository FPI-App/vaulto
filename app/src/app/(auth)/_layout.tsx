import { Stack } from 'expo-router'
import { useAuth } from '@/lib/auth/AuthProvider'

// Protege las pantallas del grupo Auth sin bloquear el callback nativo.
export default function AuthLayout() {
  const { session, initializing, isRecoveringPassword } = useAuth()

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected
        guard={!session || initializing}
        redirectTo={isRecoveringPassword ? '/(auth)/set-password' : '/(app)'}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="reset" />
      </Stack.Protected>
      <Stack.Protected
        guard={Boolean(session && isRecoveringPassword)}
        redirectTo={session ? '/(app)' : '/(auth)/login'}
      >
        <Stack.Screen name="set-password" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  )
}
