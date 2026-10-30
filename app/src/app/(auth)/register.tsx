import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { AuthLayout, FormError } from '@/components/AuthLayout'
import { Text } from '@/components/Text'
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
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Empieza a ver tu dinero con claridad. Toma menos de un minuto."
      footer={
        <View style={styles.links}>
          <Text tone="muted">
            ¿Ya tienes cuenta?{' '}
            <Link href="/(auth)/login" style={{ color: theme.colors.actionText, fontFamily: theme.typography.fonts.semibold }}>
              Inicia sesión
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
        autoComplete="new-password"
        placeholder="Mínimo 6 caracteres"
      />
      <FormError message={error} />
      {info ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: theme.colors.brandSoft,
            borderRadius: theme.radius.sm,
            paddingHorizontal: theme.space.lg,
            paddingVertical: theme.space.md,
            marginBottom: theme.space.lg,
          }}
        >
          <Text tone="brand">{info}</Text>
        </View>
      ) : null}
      <Button label="Crear cuenta" onPress={handleSubmit} loading={loading} />
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  links: { alignItems: 'center', gap: 16 },
})
