// Lista de categorías por tipo (issue #8). Dueño: lmilo (Track A).
import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import { useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import type { TipoCategoria } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { EmptyState } from '@/components/EmptyState'
import { ModalHeader } from '@/components/ModalHeader'
import { Screen } from '@/components/Screen'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { sembrarCategoriasPorDefecto } from './data/categoriasRepo'
import { useCategorias, useSembrarCategoriasAlSincronizar, type CategoriaRow } from './data/useCategorias'

export function CategoriasScreen() {
  const theme = useTheme()
  const router = useRouter()
  const db = usePowerSync()
  const { espacioId } = useEspacioActual()
  const [tipo, setTipo] = useState<TipoCategoria>('egreso')
  const { categorias, cargando } = useCategorias(espacioId, tipo)
  useSembrarCategoriasAlSincronizar(espacioId)

  function usarSugeridas() {
    if (!espacioId) return
    sembrarCategoriasPorDefecto(db, espacioId).catch((e) => Alert.alert('Error', String(e)))
  }

  return (
    <Screen>
      <ModalHeader title="Categorías" onClose={() => router.back()} />

      <View style={[styles.barra, { marginBottom: theme.space.lg }]}>
        <View style={styles.flex}>
          <SegmentedControl<TipoCategoria>
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'egreso', label: 'Gastos' },
              { value: 'ingreso', label: 'Ingresos' },
            ]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/categorias/nueva', params: { tipo } })}
          hitSlop={8}
          style={{ minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}
        >
          <Text
            style={{
              ...theme.typography.scale.label,
              color: theme.colors.brand[600],
            }}
          >
            + Nueva
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={categorias}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: theme.space['4xl'] }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <FilaCategoria categoria={item} onPress={() => router.push(`/categorias/${item.id}`)} />
        )}
        ListEmptyComponent={
          cargando ? undefined : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={tipo === 'egreso' ? 'Sin categorías de gasto' : 'Sin categorías de ingreso'}
                hint="Crea las tuyas o empieza con un set sugerido para Colombia que luego puedes editar."
                action={<Button label="Usar categorías sugeridas" onPress={usarSugeridas} />}
              />
            </View>
          )
        }
      />
    </Screen>
  )
}

function FilaCategoria({ categoria, onPress }: { categoria: CategoriaRow; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fila,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <CategoriaIcon icono={categoria.icono} color={categoria.color} />
      <Text
        numberOfLines={1}
        style={{
          ...theme.typography.scale.bodyLg,
          color: theme.colors.text,
          flex: 1,
        }}
      >
        {categoria.nombre}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  emptyWrap: { minHeight: 360 },
})
