import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { AuthLayout, FormError } from '@/components/AuthLayout'
import { Text } from '@/components/Text'
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
    <AuthLayout
      title="Hola de nuevo"
      subtitle="Tu vida financiera, en orden y a la vista."
      footer={
        <View style={styles.links}>
          <Link href="/(auth)/reset" style={[theme.typography.scale.label, { color: theme.colors.actionText }]}>
            ¿Olvidaste tu contraseña?
          </Link>
          <Text tone="muted">
            ¿Aún no tienes cuenta?{' '}
            <Link href="/(auth)/register" style={{ color: theme.colors.actionText, fontFamily: theme.typography.fonts.semibold }}>
              Créala gratis
            </Link>
          </Text>
        </View>
      }
    >
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
        placeholder="Tu contraseña"
        onSubmitEditing={handleSubmit}
      />
      <FormError message={error} />
      <Button label="Entrar" onPress={handleSubmit} loading={loading} />
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  links: { alignItems: 'center', gap: 16 },
})
