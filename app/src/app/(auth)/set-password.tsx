import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

export default function SetPasswordScreen() {
  const theme = useTheme()
  const { completePasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      await completePasswordRecovery(password)
    } catch {
      setError('No pudimos actualizar la contraseña. Solicita otro enlace e inténtalo de nuevo.')
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
              fontFamily: theme.typography.fontFamily,
              color: theme.colors.text,
              marginTop: 48,
              marginBottom: 24,
            }}
          >
            Crea una nueva contraseña
          </Text>

          <Field
            label="Nueva contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!loading}
          />
          <Field
            label="Confirma la contraseña"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoComplete="new-password"
            editable={!loading}
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

          <Button label="Actualizar contraseña" onPress={handleSubmit} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
