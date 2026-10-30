import { useQuery, usePowerSync } from '@powersync/react-native'
import { useRef, useState } from 'react'
import { Alert, Image, View } from 'react-native'
import LogOut from 'lucide-react-native/icons/log-out'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Text } from '@/components/Text'
import { Field } from '@/components/Field'
import { Screen } from '@/components/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/theme'

import { guardarPerfil } from './perfilRepo'

interface PerfilRow {
  id: string
  nombre: string
  apellido: string
  username: string
  foto_url: string | null
  descripcion: string | null
  ocupacion: string | null
}

export function PerfilScreen() {
  const theme = useTheme()
  const { session, signOut } = useAuth()
  const { data, isLoading } = useQuery<PerfilRow>(
    `SELECT id, nombre, apellido, username, foto_url, descripcion, ocupacion
     FROM perfil WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [session?.user.id ?? ''],
  )
  const perfil = data[0]

  return (
    <Screen title="Perfil" scroll tabBar>
      {isLoading ? <Text tone="muted">Cargando perfil…</Text> : null}
      {!isLoading && !perfil ? (
        <Text tone="muted">Aún no encontramos tu perfil. Completa el registro inicial.</Text>
      ) : null}
      {perfil ? <PerfilEditor key={perfil.id} perfil={perfil} /> : null}
      <View style={{ marginTop: theme.space.xl }}>
        <Button
          label="Cerrar sesión"
          variant="secondary"
          icon={LogOut}
          onPress={() => signOut().catch(() => Alert.alert('No se pudo cerrar sesión', 'Intenta de nuevo.'))}
        />
      </View>
    </Screen>
  )
}

function PerfilEditor({ perfil }: { perfil: PerfilRow }) {
  const db = usePowerSync()
  const theme = useTheme()
  const submitting = useRef(false)
  const [nombre, setNombre] = useState<string | null>(null)
  const [apellido, setApellido] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [descripcion, setDescripcion] = useState<string | null>(null)
  const [ocupacion, setOcupacion] = useState<string | null>(null)
  const [fotoFallida, setFotoFallida] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const foto = perfil.foto_url?.startsWith('https://') ? perfil.foto_url : null

  async function guardar() {
    if (submitting.current) return
    submitting.current = true
    setGuardando(true)
    try {
      await guardarPerfil(db, perfil.id, {
        nombre: nombre ?? perfil.nombre,
        apellido: apellido ?? perfil.apellido,
        username: username ?? perfil.username,
        foto_url: fotoUrl ?? perfil.foto_url,
        descripcion: descripcion ?? perfil.descripcion,
        ocupacion: ocupacion ?? perfil.ocupacion,
      })
      Alert.alert('Perfil actualizado', 'Tus cambios se sincronizarán cuando tengas conexión.')
    } catch (error) {
      Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intenta de nuevo.')
    } finally {
      submitting.current = false
      setGuardando(false)
    }
  }

  const iniciales = `${perfil.nombre.slice(0, 1)}${perfil.apellido.slice(0, 1)}`.toUpperCase()

  return (
    <>
      <View style={{ alignItems: 'center', marginBottom: theme.space['2xl'] }}>
        {foto && foto !== fotoFallida ? (
          <Image
            source={{ uri: foto }}
            accessibilityLabel="Tu foto de perfil"
            style={{ width: 96, height: 96, borderRadius: 48 }}
            onError={() => setFotoFallida(foto)}
          />
        ) : (
          <View
            accessibilityLabel="Perfil sin foto disponible"
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.brandSoft,
            }}
          >
            <Text variant="h1" tone="brand">
              {iniciales}
            </Text>
          </View>
        )}
        <Text variant="h2" style={{ marginTop: theme.space.lg }} numberOfLines={1}>
          {`${perfil.nombre} ${perfil.apellido}`.trim()}
        </Text>
        <Text tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
          @{perfil.username}
        </Text>
      </View>
      <Card>
        <Field label="Nombre" value={nombre ?? perfil.nombre} onChangeText={setNombre} autoCapitalize="words" maxLength={80} editable={!guardando} />
        <Field label="Apellido" value={apellido ?? perfil.apellido} onChangeText={setApellido} autoCapitalize="words" maxLength={80} editable={!guardando} />
        <Field label="Nombre de usuario" value={username ?? perfil.username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={24} editable={!guardando} />
        <Field label="URL de foto (opcional)" value={fotoUrl ?? perfil.foto_url ?? ''} onChangeText={setFotoUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://…" maxLength={2048} editable={!guardando} />
        <Text variant="caption" tone="muted" style={{ marginBottom: theme.space.lg }}>
          Usa un enlace HTTPS a una imagen. Deja el campo vacío para quitar la foto.
        </Text>
        <Field label="Ocupación (opcional)" value={ocupacion ?? perfil.ocupacion ?? ''} onChangeText={setOcupacion} maxLength={100} editable={!guardando} />
        <Field label="Descripción (opcional)" value={descripcion ?? perfil.descripcion ?? ''} onChangeText={setDescripcion} multiline maxLength={500} editable={!guardando} />
        <Button label="Guardar cambios" onPress={guardar} loading={guardando} />
      </Card>
    </>
  )
}
