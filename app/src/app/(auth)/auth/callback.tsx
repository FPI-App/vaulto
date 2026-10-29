import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

export default function AuthCallbackScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { authCallbackError, authCallbackSucceeded, initializing, isRecoveringPassword, session } = useAuth()
  const complete = authCallbackSucceeded && Boolean(session) && !authCallbackError && !isRecoveringPassword
  const recoveryReady = authCallbackSucceeded && Boolean(session) && !authCallbackError && isRecoveringPassword
  const waiting = !authCallbackError && !complete && !recoveryReady

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.lg }}>
        <Text
          accessibilityRole="header"
          style={{ ...theme.typography.scale.h1, fontFamily: theme.typography.fontFamily, color: theme.colors.text }}
        >
          {recoveryReady
            ? 'Verifica el enlace de recuperación'
            : complete
              ? 'Correo confirmado'
              : waiting
                ? 'Verificando correo'
                : 'No pudimos confirmar el correo'}
        </Text>
        <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
          {recoveryReady
            ? 'El enlace es válido. Continúa para elegir una nueva contraseña.'
            : complete
            ? 'Tu sesión está lista. Ya puedes continuar en Vaulto.'
            : waiting || initializing
              ? 'Estamos validando el enlace de forma segura.'
              : authCallbackError}
        </Text>
        {recoveryReady ? (
          <Button label="Crear nueva contraseña" onPress={() => router.replace('/(auth)/set-password')} />
        ) : complete ? (
          <Button label="Ir a Vaulto" onPress={() => router.replace('/(app)')} />
        ) : authCallbackError ? (
          <Button
            label={session ? 'Ir a Vaulto' : 'Volver a iniciar sesión'}
            onPress={() => router.replace(session ? '/(app)' : '/(auth)/login')}
          />
        ) : null}
      </View>
    </Screen>
  )
}
