// Selector de categoría para el formulario de movimientos. Vive en la feature de
// categorías para que Movimientos no conozca cómo se consultan.
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { TipoCategoria } from '@vaulto/shared'

import { CategoriaIcon } from '@/components/CategoriaIcon'
import { useTheme } from '@/theme'

import { useCategorias, useSembrarCategoriasAlSincronizar, type CategoriaRow } from './data/useCategorias'

export function CategoriaPicker({
  espacioId,
  tipo,
  value,
  onChange,
  extra,
}: {
  espacioId: string | null
  tipo: TipoCategoria
  value: string | null
  onChange: (id: string | null) => void
  /** Categoría ya asignada que no está en la lista activa (borrada): se muestra para no perderla. */
  extra?: CategoriaRow | null
}) {
  const theme = useTheme()
  const router = useRouter()
  const { categorias } = useCategorias(espacioId, tipo)
  useSembrarCategoriasAlSincronizar(espacioId)

  const opciones = extra && !categorias.some((c) => c.id === extra.id) ? [...categorias, extra] : categorias

  return (
    <View>
      <View style={styles.grid}>
        {opciones.map((c) => {
          const activa = c.id === value
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={c.nombre}
              accessibilityState={{ selected: activa }}
              // Tocar la elegida la deselecciona: la categoría es opcional.
              onPress={() => onChange(activa ? null : c.id)}
              style={({ pressed }) => [
                styles.celda,
                {
                  borderRadius: theme.radius.md,
                  borderColor: activa ? (c.color ?? theme.colors.brand[600]) : 'transparent',
                  backgroundColor: activa ? theme.colors.surface : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <CategoriaIcon icono={c.icono} color={c.color} size={40} />
              <Text
                numberOfLines={1}
                style={{
                  ...theme.typography.scale.caption,
                  fontFamily: theme.typography.fontFamily,
                  color: activa ? theme.colors.text : theme.colors.textMuted,
                  marginTop: 4,
                }}
              >
                {c.nombre}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/categorias')}
        hitSlop={8}
        style={{ minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}
      >
        <Text
          style={{
            ...theme.typography.scale.label,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.brand[600],
          }}
        >
          {opciones.length ? 'Gestionar categorías' : 'Crear categorías'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  celda: { width: 76, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 2, borderWidth: 2 },
})
