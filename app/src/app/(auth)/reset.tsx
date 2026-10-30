import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

export default function ResetScreen() {
  const theme = useTheme()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await resetPassword(email.trim())
      setInfo('Si el correo existe, te enviamos un enlace para restablecer la contraseña.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos enviar el enlace.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.flex}>
          <Text
            style={{
              ...theme.typography.scale.h1,
              color: theme.colors.text,
              marginTop: 48,
              marginBottom: 8,
            }}
          >
            Restablecer contraseña
          </Text>
          <Text
            style={{
              ...theme.typography.scale.body,
              color: theme.colors.textMuted,
              marginBottom: 24,
            }}
          >
            Te enviaremos un enlace a tu correo.
          </Text>

          <Field
            label="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            placeholder="tu@correo.com"
          />

          {error ? (
            <Text
              style={{
                ...theme.typography.scale.body,
                color: theme.colors.financial.expense,
                marginBottom: theme.space.md,
              }}
            >
              {error}
            </Text>
          ) : null}
          {info ? (
            <Text
              style={{
                ...theme.typography.scale.body,
                color: theme.colors.financial.success,
                marginBottom: theme.space.md,
              }}
            >
              {info}
            </Text>
          ) : null}

          <Button label="Enviar enlace" onPress={handleSubmit} loading={loading} />

          <View style={styles.links}>
            <Link href="/(auth)/login" style={{ color: theme.colors.brand[600] }}>
              Volver a iniciar sesión
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  links: { marginTop: 20, alignItems: 'center' },
})
