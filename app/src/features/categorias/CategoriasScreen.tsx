// Lista de categorías por tipo (issue #8). Dueño: lmilo (Track A).
import { useRouter } from 'expo-router'
import { usePowerSync } from '@powersync/react-native'
import ArrowLeft from 'lucide-react-native/icons/arrow-left'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import Plus from 'lucide-react-native/icons/plus'
import Tags from 'lucide-react-native/icons/tags'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { TipoCategoria } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Card } from '@/components/Card'
import { IconButton } from '@/components/IconButton'
import { EmptyState } from '@/components/EmptyState'
import { ListRow } from '@/components/ListRow'
import { Screen } from '@/components/Screen'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Text } from '@/components/Text'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { sembrarCategoriasPorDefecto } from './data/categoriasRepo'
import { useCategorias, useSembrarCategoriasAlSincronizar } from './data/useCategorias'
import { showAlert } from '@/lib/ui/alert'

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
    sembrarCategoriasPorDefecto(db, espacioId).catch((e) => showAlert('Error', String(e)))
  }

  function volver() {
    if (router.canGoBack()) router.back()
    else router.replace('/movimientos')
  }

  return (
    <Screen scroll tabBar>
      <View style={[styles.header, { paddingTop: theme.space.lg, paddingBottom: theme.space.xl, gap: theme.space.md }]}>
        <IconButton icon={ArrowLeft} label="Volver" onPress={volver} />
        <Text variant="h1" heading={1} style={{ flex: 1 }} numberOfLines={1}>
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
  vacio: { minHeight: 360, flexDirection: 'row' },
})
