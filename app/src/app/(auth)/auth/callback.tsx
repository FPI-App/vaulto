import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

export default function AuthCallbackScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { authCallbackError, initializing, session } = useAuth()
  const complete = Boolean(session)
  const waiting = !authCallbackError && !complete

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.lg }}>
        <Text
          accessibilityRole="header"
          style={{ ...theme.typography.scale.h1, fontFamily: theme.typography.fontFamily, color: theme.colors.text }}
        >
          {complete ? 'Correo confirmado' : waiting ? 'Verificando correo' : 'No pudimos confirmar el correo'}
        </Text>
        <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>
          {complete
            ? 'Tu sesión está lista. Ya puedes continuar en Vaulto.'
            : waiting || initializing
              ? 'Estamos validando el enlace de forma segura.'
              : authCallbackError}
        </Text>
        {authCallbackError ? (
          <Button label="Volver a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
        ) : null}
      </View>
    </Screen>
  )
}
