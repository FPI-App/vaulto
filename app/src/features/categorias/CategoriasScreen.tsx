// Lista de categorías por tipo (issue #8). Dueño: lmilo (Track A).
import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import ArrowLeft from 'lucide-react-native/icons/arrow-left'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import Plus from 'lucide-react-native/icons/plus'
import Tags from 'lucide-react-native/icons/tags'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import type { TipoCategoria } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { ListRow } from '@/components/ListRow'
import { Screen } from '@/components/Screen'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Text } from '@/components/Text'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { sembrarCategoriasPorDefecto } from './data/categoriasRepo'
import { useCategorias, useSembrarCategoriasAlSincronizar } from './data/useCategorias'

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

  function volver() {
    if (router.canGoBack()) router.back()
    else router.replace('/movimientos')
  }

  return (
    <Screen scroll tabBar>
      <View style={[styles.header, { paddingTop: theme.space.lg, paddingBottom: theme.space.xl, gap: theme.space.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={volver}
          hitSlop={4}
          style={({ pressed }) => [
            styles.volver,
            { backgroundColor: theme.colors.surface2, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ArrowLeft size={20} color={theme.colors.text} strokeWidth={2} />
        </Pressable>
        <Text variant="h1" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
          Categorías
        </Text>
        <Button
          label="Nueva"
          variant="ghost"
          size="md"
          icon={Plus}
          onPress={() => router.push({ pathname: '/categorias/nueva', params: { tipo } })}
        />
      </View>

      <View style={{ marginBottom: theme.space.xl }}>
        <SegmentedControl<TipoCategoria>
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'egreso', label: 'Gastos' },
            { value: 'ingreso', label: 'Ingresos' },
          ]}
        />
      </View>

      {categorias.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: theme.space.lg }}>
          {categorias.map((c, i) => (
            <ListRow
              key={c.id}
              divider={i < categorias.length - 1}
              onPress={() => router.push(`/categorias/${c.id}`)}
              leading={<CategoriaIcon icono={c.icono} color={c.color} />}
              title={c.nombre}
              trailing={<ChevronRight size={18} color={theme.colors.textMuted} strokeWidth={2} />}
            />
          ))}
        </Card>
      ) : cargando ? null : (
        <View style={styles.vacio}>
          <EmptyState
            icon={Tags}
            title={tipo === 'egreso' ? 'Sin categorías de gasto' : 'Sin categorías de ingreso'}
            hint="Crea las tuyas o empieza con un set sugerido para Colombia que luego puedes editar."
            action={<Button label="Usar categorías sugeridas" onPress={usarSugeridas} />}
          />
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  volver: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vacio: { minHeight: 360, flexDirection: 'row' },
})
