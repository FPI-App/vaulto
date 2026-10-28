import { useRef, useState } from 'react'
import { StyleSheet, View, Text, Alert } from 'react-native'
import { completarOnboarding } from '@/features/onboarding/onboardingRepo'
import { usePowerSync } from '@powersync/react-native'

import { useTheme } from '@/theme'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import { useAuth } from '@/lib/auth/AuthProvider'

export default function OnboardingScreen() {
  const theme = useTheme()
  const { session } = useAuth()
  const db = usePowerSync()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  const handleComenzar = async () => {
    if (submitting.current) return
    if (!session?.user.id) {
      Alert.alert('Inicia sesión', 'Necesitas una sesión activa para continuar.')
      return
    }
    submitting.current = true
    setLoading(true)
    try {
      await completarOnboarding(db, session.user.id, { nombre, apellido, username })
    } catch (error) {
      Alert.alert('No se pudo completar el registro', error instanceof Error ? error.message : 'Intenta de nuevo.')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Screen padded edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={{ ...theme.typography.scale.h1, fontFamily: theme.typography.fontFamily, color: theme.colors.text }}>
          Te damos la bienvenida a Vaulto
        </Text>
        <Text style={{ ...theme.typography.scale.bodyLg, fontFamily: theme.typography.fontFamily, color: theme.colors.textMuted, marginTop: theme.space.xs }}>
          Para comenzar, configuremos tu perfil y tu espacio personal.
        </Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Nombre"
          placeholder="Ej: Juan"
          value={nombre}
          onChangeText={setNombre}
          editable={!loading}
        />
        <Field
          label="Apellido"
          placeholder="Ej: Pérez"
          value={apellido}
          onChangeText={setApellido}
          editable={!loading}
        />
        <Field
          label="Nombre de usuario"
          placeholder="Ej: juanperez"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
      </View>

      <View style={styles.footer}>
        <Button
          label="Comenzar"
          onPress={handleComenzar}
          loading={loading}
          disabled={!nombre || !apellido || !username}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    marginTop: 32,
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  footer: {
    paddingVertical: 24,
  },
})
