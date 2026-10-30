import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Alert } from 'react-native'
import { completarOnboarding } from '@/features/onboarding/onboardingRepo'
import { usePowerSync } from '@powersync/react-native'

import { useTheme } from '@/theme'
import { Screen } from '@/components/Screen'
import { Field } from '@/components/Field'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { LogoMark } from '@/components/Logo'
import { Text } from '@/components/Text'
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingVertical: theme.space['3xl'] }]}
        >
          <View style={{ marginBottom: theme.space['3xl'] }}>
            <LogoMark size={56} />
          </View>
          <Text variant="h1" accessibilityRole="header">
            Empecemos por lo básico
          </Text>
          <Text variant="bodyLg" tone="muted" style={{ marginTop: theme.space.sm, marginBottom: theme.space['3xl'] }}>
            Cuéntanos cómo te llamas y configuramos tu espacio personal. Podrás cambiarlo cuando quieras.
          </Text>

          <Card>
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
          </Card>

          <View style={{ marginTop: theme.space['2xl'] }}>
            <Button
              label="Comenzar"
              onPress={handleComenzar}
              loading={loading}
              disabled={!nombre || !apellido || !username}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', maxWidth: 440, width: '100%', alignSelf: 'center' },
})
