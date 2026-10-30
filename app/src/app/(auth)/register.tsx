import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

export default function RegisterScreen() {
  const theme = useTheme()
  const { signUpWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await signUpWithPassword(email.trim(), password)
      setInfo('Abre el enlace que enviamos a tu correo desde este teléfono para confirmar la cuenta y continuar en Vaulto.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear la cuenta.')
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
              marginBottom: 24,
            }}
          >
            Crear cuenta
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
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
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

          <Button label="Crear cuenta" onPress={handleSubmit} loading={loading} />

          <View style={styles.links}>
            <Link href="/(auth)/login" style={{ color: theme.colors.brand[600] }}>
              Ya tengo cuenta
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
