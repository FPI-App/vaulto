import { usePowerSync, useQuery } from '@powersync/react-native'
import { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

interface PerfilRow {
  id: string
  nombre: string
  apellido: string
  username: string
  descripcion: string | null
  ocupacion: string | null
  country: string
}

export function PerfilScreen() {
  const theme = useTheme()
  const db = usePowerSync()
  const { session, signOut } = useAuth()
  const { data, isLoading } = useQuery<PerfilRow>(
    `SELECT id, nombre, apellido, username, descripcion, ocupacion, country
     FROM perfil WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [session?.user.id ?? ''],
  )
  const perfil = data[0]
  const [nombre, setNombre] = useState<string | null>(null)
  const [apellido, setApellido] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [descripcion, setDescripcion] = useState<string | null>(null)
  const [ocupacion, setOcupacion] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!perfil) return
    const nombreFinal = (nombre ?? perfil.nombre).trim()
    const apellidoFinal = (apellido ?? perfil.apellido).trim()
    const usernameFinal = (username ?? perfil.username).trim().toLowerCase()
    if (!nombreFinal || !apellidoFinal || !/^[a-z0-9_]{3,24}$/.test(usernameFinal)) {
      Alert.alert('Revisa tus datos', 'Nombre y apellido son obligatorios. El usuario admite 3–24 letras, números o guion bajo.')
      return
    }
    setGuardando(true)
    try {
      await db.execute(
        `UPDATE perfil SET nombre = ?, apellido = ?, username = ?, descripcion = ?, ocupacion = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [nombreFinal, apellidoFinal, usernameFinal, (descripcion ?? perfil.descripcion)?.trim() || null,
          (ocupacion ?? perfil.ocupacion)?.trim() || null, new Date().toISOString(), perfil.id],
      )
      Alert.alert('Perfil actualizado', 'Tus cambios están guardados en este dispositivo y se sincronizarán al volver a tener conexión.')
    } catch (error) {
      const mensaje = String(error).toLowerCase().includes('unique')
        ? 'Ese nombre de usuario ya está ocupado.'
        : 'No se pudo guardar el perfil. Intenta de nuevo.'
      Alert.alert('No se pudo actualizar', mensaje)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: theme.space.lg, flexGrow: 1 }}>
        <Text style={{ ...theme.typography.scale.h1, color: theme.colors.text, fontFamily: theme.typography.fontFamily, marginBottom: theme.space.lg }}>
          Perfil
        </Text>
        {isLoading ? <Text style={{ color: theme.colors.textMuted }}>Cargando perfil…</Text> : null}
        {!isLoading && !perfil ? <Text style={{ ...theme.typography.scale.body, color: theme.colors.textMuted }}>Aún no encontramos tu perfil. Completa el onboarding.</Text> : null}
        {perfil ? (
          <>
            <Field label="Nombre" value={nombre ?? perfil.nombre} onChangeText={setNombre} autoCapitalize="words" />
            <Field label="Apellido" value={apellido ?? perfil.apellido} onChangeText={setApellido} autoCapitalize="words" />
            <Field label="Nombre de usuario" value={username ?? perfil.username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            <Field label="Ocupación (opcional)" value={ocupacion ?? perfil.ocupacion ?? ''} onChangeText={setOcupacion} />
            <Field label="Descripción (opcional)" value={descripcion ?? perfil.descripcion ?? ''} onChangeText={setDescripcion} multiline />
            <Button label="Guardar cambios" onPress={guardar} loading={guardando} />
          </>
        ) : null}
        <View style={{ marginTop: theme.space.lg }}>
          <Button label="Cerrar sesión" variant="ghost" onPress={() => signOut().catch((error) => Alert.alert('No se pudo cerrar sesión', String(error)))} />
        </View>
      </ScrollView>
    </Screen>
  )
}
