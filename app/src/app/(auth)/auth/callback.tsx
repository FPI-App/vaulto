import { useRouter } from 'expo-router'
import { ActivityIndicator } from 'react-native'

import { Button } from '@/components/Button'
import { AuthLayout, FormError } from '@/components/AuthLayout'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

export default function AuthCallbackScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { authCallbackError, authCallbackSucceeded, initializing, isRecoveringPassword, session } = useAuth()
  const complete = authCallbackSucceeded && Boolean(session) && !authCallbackError && !isRecoveringPassword
  const recoveryReady = authCallbackSucceeded && Boolean(session) && !authCallbackError && isRecoveringPassword
  const waiting = !authCallbackError && !complete && !recoveryReady

  const title = recoveryReady
    ? 'Verifica el enlace de recuperación'
    : complete
      ? 'Correo confirmado'
      : waiting
        ? 'Verificando correo'
        : 'No pudimos confirmar el correo'
  const subtitle = recoveryReady
    ? 'El enlace es válido. Continúa para elegir una nueva contraseña.'
    : complete
      ? 'Tu sesión está lista. Ya puedes continuar en Vaulto.'
      : waiting || initializing
        ? 'Estamos validando el enlace de forma segura.'
        : undefined

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      {waiting ? (
        <ActivityIndicator accessibilityLabel="Verificando" color={theme.colors.actionText} style={{ alignSelf: 'flex-start' }} />
      ) : null}
      {!waiting && !recoveryReady && !complete ? <FormError message={authCallbackError} /> : null}
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
    </AuthLayout>
  )
}
