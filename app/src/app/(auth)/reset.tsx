import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { AuthLayout, FormError } from '@/components/AuthLayout'
import { Text } from '@/components/Text'
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
    <AuthLayout
      title="Restablece tu contraseña"
      subtitle="Escribe tu correo y te enviamos un enlace para elegir una nueva."
      footer={
        <View style={styles.links}>
          <Link href="/(auth)/login" style={[theme.typography.scale.label, { color: theme.colors.actionText }]}>
            Volver a iniciar sesión
          </Link>
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
      <Button label="Enviar enlace" onPress={handleSubmit} loading={loading} />
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  links: { alignItems: 'center', gap: 16 },
})
