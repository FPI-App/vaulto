import { useState } from 'react'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { AuthLayout, FormError } from '@/components/AuthLayout'
import { useAuth } from '@/lib/auth/AuthProvider'

export default function SetPasswordScreen() {
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
    <AuthLayout title="Crea una nueva contraseña" subtitle="Elige una que no uses en otro sitio. Mínimo 8 caracteres.">
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
        onSubmitEditing={handleSubmit}
      />
      <FormError message={error} />
      <Button label="Actualizar contraseña" onPress={handleSubmit} loading={loading} />
    </AuthLayout>
  )
}
