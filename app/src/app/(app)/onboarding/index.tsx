import { useState } from 'react'
import { StyleSheet, View, Text, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as Crypto from 'expo-crypto'
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
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  const handleComenzar = async () => {
    console.log('[Onboarding] handleComenzar iniciado')
    if (!nombre.trim() || !apellido.trim() || !username.trim()) {
      Alert.alert('Datos incompletos', 'Por favor completa todos los campos para continuar.')
      return
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'No hay sesión activa.')
      return
    }

    setLoading(true)

    try {
      const userId = session.user.id
      const espacioId = Crypto.randomUUID()
      const miembroId = Crypto.randomUUID()
      const now = new Date().toISOString()
      
      console.log('[Onboarding] Iniciando writeTransaction para el usuario:', userId)

      await db.writeTransaction(async (tx) => {
        console.log('[Onboarding] Transacción iniciada, verificando espacio...')
        const espacioExiste = await tx.getOptional('SELECT id FROM espacio WHERE id = ?', [espacioId])
        if (espacioExiste) {
          console.log('[Onboarding] Espacio existe, haciendo UPDATE...')
          await tx.execute(
            `UPDATE espacio SET nombre = ?, owner_user_id = ?, base_currency = ?, country = ?, updated_at = ? WHERE id = ?`,
            ['Personal', userId, 'COP', 'CO', now, espacioId]
          )
        } else {
          console.log('[Onboarding] Espacio NO existe, haciendo INSERT...')
          await tx.execute(
            `INSERT INTO espacio (id, nombre, owner_user_id, base_currency, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [espacioId, 'Personal', userId, 'COP', 'CO', now, now]
          )
        }

        console.log('[Onboarding] Verificando espacio_miembro...')
        const miembroExiste = await tx.getOptional('SELECT id FROM espacio_miembro WHERE id = ?', [miembroId])
        if (!miembroExiste) {
          console.log('[Onboarding] Miembro NO existe, haciendo INSERT...')
          await tx.execute(
            `INSERT INTO espacio_miembro (id, espacio_id, user_id, rol, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [miembroId, espacioId, userId, 'owner', now, now]
          )
        } else {
          console.log('[Onboarding] Miembro ya existe, ignorando.')
        }

        console.log('[Onboarding] Verificando perfil...')
        const perfilExiste = await tx.getOptional('SELECT id FROM perfil WHERE id = ?', [userId])
        if (perfilExiste) {
          console.log('[Onboarding] Perfil existe, haciendo UPDATE...')
          await tx.execute(
            `UPDATE perfil SET espacio_id = ?, nombre = ?, apellido = ?, username = ?, country = ?, onboarding_completo = ?, updated_at = ? WHERE id = ?`,
            [espacioId, nombre.trim(), apellido.trim(), username.trim().toLowerCase(), 'CO', 1, now, userId]
          )
        } else {
          console.log('[Onboarding] Perfil NO existe, haciendo INSERT...')
          await tx.execute(
            `INSERT INTO perfil (id, espacio_id, nombre, apellido, username, country, onboarding_completo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, espacioId, nombre.trim(), apellido.trim(), username.trim().toLowerCase(), 'CO', 1, now, now]
          )
        }
      })

      console.log('[Onboarding] Transacción finalizada con éxito. Programando redirección...')
      
      const allProfiles = await db.getAll('SELECT * FROM perfil')
      console.log('[Onboarding] RAW PERFIL DUMP DESPUES DE TX:', JSON.stringify(allProfiles))

      setTimeout(() => {
        console.log('[Onboarding] Ejecutando router.replace(app)')
        router.replace('/(app)')
      }, 500)
    } catch (error) {
      console.error('[Onboarding] Error completando onboarding:', error)
      Alert.alert('Error', 'Hubo un problema guardando tu perfil. Por favor intenta de nuevo.')
    } finally {
      console.log('[Onboarding] Proceso terminado. setLoading(false)')
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
