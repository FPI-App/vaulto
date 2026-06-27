import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

export default function LoginScreen() {
  const theme = useTheme()
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      await signInWithPassword(email.trim(), password)
      // El guard del root layout redirige a (app) al detectar la sesión.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos iniciar sesión.')
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
          <View style={styles.header}>
            <Text
              style={{
                ...theme.typography.scale.display,
                fontFamily: theme.typography.fontFamily,
                color: theme.colors.text,
              }}
            >
              Vaulto
            </Text>
            <Text
              style={{
                ...theme.typography.scale.bodyLg,
                color: theme.colors.textMuted,
                marginTop: theme.space.xs,
              }}
            >
              Tu vida financiera, en orden y a la vista.
            </Text>
          </View>

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
            autoComplete="password"
            placeholder="••••••••"
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

          <Button label="Entrar" onPress={handleSubmit} loading={loading} />

          <View style={styles.links}>
            <Link href="/(auth)/reset" style={{ color: theme.colors.brand[600] }}>
              ¿Olvidaste tu contraseña?
            </Link>
            <Link href="/(auth)/register" style={{ color: theme.colors.brand[600] }}>
              Crear cuenta
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginTop: 48, marginBottom: 32 },
  links: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
