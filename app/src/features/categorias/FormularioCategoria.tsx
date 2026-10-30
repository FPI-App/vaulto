// Formulario de crear/editar categoría. Igual que FormularioCuenta: no sabe de
// navegación ni de DB, entrega `DatosCategoria` validados vía onSubmit.
import { useState } from 'react'
import Check from 'lucide-react-native/icons/check'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import {
  COLORES_CATEGORIA,
  ICONOS_CATEGORIA,
  type IconoCategoria,
  type TipoCategoria,
} from '@vaulto/shared'

import { Button } from '@/components/Button'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Text } from '@/components/Text'
import { useTheme } from '@/theme'

import type { DatosCategoria } from './data/categoriasRepo'

const NOMBRE_ICONO: Record<IconoCategoria, string> = {
  'shopping-cart': 'Carrito',
  house: 'Casa',
  zap: 'Energía',
  bus: 'Bus',
  car: 'Carro',
  utensils: 'Cubiertos',
  'heart-pulse': 'Salud',
  film: 'Cine',
  'graduation-cap': 'Educación',
  shirt: 'Ropa',
  smartphone: 'Celular',
  plane: 'Avión',
  'paw-print': 'Mascotas',
  dumbbell: 'Gimnasio',
  baby: 'Bebé',
  wrench: 'Herramienta',
  receipt: 'Factura',
  gift: 'Regalo',
  briefcase: 'Maletín',
  'hand-coins': 'Monedas',
  'trending-up': 'Inversión',
  'piggy-bank': 'Alcancía',
  banknote: 'Billete',
  ellipsis: 'Otros',
}

const NOMBRE_COLOR: Record<(typeof COLORES_CATEGORIA)[number], string> = {
  '#DC2626': 'Rojo',
  '#EA580C': 'Naranja',
  '#B45309': 'Ámbar',
  '#16A34A': 'Verde',
  '#0D9488': 'Verde azulado',
  '#0891B2': 'Cian',
  '#2563EB': 'Azul',
  '#8B5CF6': 'Violeta',
  '#DB2777': 'Rosa',
  '#64748B': 'Gris',
}

export interface ValoresInicialesCategoria {
  nombre?: string
  icono?: IconoCategoria
  color?: string
}

export function FormularioCategoria({
  tipo,
  onCambiarTipo,
  inicial,
  guardando,
  ctaLabel,
  onSubmit,
}: {
  tipo: TipoCategoria
  /** Solo al crear: una categoría con movimientos no puede cambiar de tipo. */
  onCambiarTipo?: (tipo: TipoCategoria) => void
  inicial?: ValoresInicialesCategoria
  guardando: boolean
  ctaLabel: string
  onSubmit: (datos: DatosCategoria) => void
}) {
  const theme = useTheme()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [icono, setIcono] = useState<IconoCategoria>(inicial?.icono ?? 'ellipsis')
  const [color, setColor] = useState<string>(inicial?.color ?? COLORES_CATEGORIA[6])

  function submit() {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) {
      Alert.alert('Falta el nombre', 'Ponle un nombre a la categoría.')
      return
    }
    onSubmit({ nombre: nombreLimpio, icono, color })
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingVertical: theme.space.lg, paddingBottom: theme.space['2xl'] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.preview, { marginBottom: theme.space.xl }]}>
        <CategoriaIcon icono={icono} color={color} size={64} />
        <Text
          variant="h3"
          tone={nombre.trim() ? 'default' : 'muted'}
          numberOfLines={1}
          style={{ marginTop: theme.space.md }}
        >
          {nombre.trim() || 'Nueva categoría'}
        </Text>
      </View>

      {onCambiarTipo ? (
        <View style={{ marginBottom: theme.space.lg }}>
          <Text variant="label" tone="muted" style={styles.etiqueta}>
            Tipo
          </Text>
          <SegmentedControl<TipoCategoria>
            value={tipo}
            onChange={onCambiarTipo}
            options={[
              { value: 'egreso', label: 'Gasto' },
              { value: 'ingreso', label: 'Ingreso' },
            ]}
          />
        </View>
      ) : null}

      <Field
        label="Nombre"
        value={nombre}
        onChangeText={setNombre}
        placeholder={tipo === 'egreso' ? 'Ej. Mercado' : 'Ej. Salario'}
        autoCapitalize="sentences"
        maxLength={40}
      />

      <Text variant="label" tone="muted" style={styles.etiqueta}>
        Ícono
      </Text>
      <View style={[styles.grid, { marginBottom: theme.space.lg }]}>
        {ICONOS_CATEGORIA.map((nombreIcono) => {
          const activo = nombreIcono === icono
          return (
            <Pressable
              key={nombreIcono}
              accessibilityRole="button"
              accessibilityLabel={NOMBRE_ICONO[nombreIcono]}
              accessibilityState={{ selected: activo }}
              onPress={() => setIcono(nombreIcono)}
              style={[
                styles.celda,
                {
                  minWidth: theme.layout.minTouchTarget,
                  minHeight: theme.layout.minTouchTarget,
                  borderRadius: theme.radius.sm,
                  borderColor: activo ? color : 'transparent',
                },
              ]}
            >
              <CategoriaIcon icono={nombreIcono} color={activo ? color : theme.colors.textMuted} size={36} />
            </Pressable>
          )
        })}
      </View>

      <Text variant="label" tone="muted" style={styles.etiqueta}>
        Color
      </Text>
      <View style={[styles.grid, { marginBottom: theme.space.xl }]}>
        {COLORES_CATEGORIA.map((hex) => {
          const activo = hex === color
          return (
            <Pressable
              key={hex}
              accessibilityRole="button"
              accessibilityLabel={NOMBRE_COLOR[hex]}
              accessibilityState={{ selected: activo }}
              onPress={() => setColor(hex)}
              style={[
                styles.celda,
                {
                  minWidth: theme.layout.minTouchTarget,
                  minHeight: theme.layout.minTouchTarget,
                  borderRadius: theme.radius.full,
                  borderColor: activo ? theme.colors.text : 'transparent',
                },
              ]}
            >
              <View style={[styles.muestra, { backgroundColor: hex }]}>
                {activo ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          )
        })}
      </View>

      <Button label={ctaLabel} onPress={submit} loading={guardando} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  celda: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  muestra: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  etiqueta: { marginBottom: 8 },
})
