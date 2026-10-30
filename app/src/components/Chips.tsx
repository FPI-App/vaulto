import { Platform, ScrollView, StyleSheet } from 'react-native'

import { useTheme } from '@/theme'
import { PressableScale } from './PressableScale'
import { Text } from './Text'

export interface OpcionChip<T extends string> {
  value: T
  label: string
}

/**
 * Fila horizontal de chips de selección única. Para listas de largo variable
 * (cuentas, categorías, periodos) donde un SegmentedControl no cabe.
 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: OpcionChip<T>[]
  value: T | null
  onChange: (value: T) => void
  accessibilityLabel?: string
}) {
  const theme = useTheme()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((opt) => {
        const activo = opt.value === value
        return (
          <PressableScale
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => onChange(opt.value)}
            // Nativo: 36 px visibles + 4 px de hitSlop = 44. En web hitSlop no existe: 44 reales.
            hitSlop={{ top: 4, bottom: 4 }}
            style={[
              styles.chip,
              {
                minHeight: Platform.OS === 'web' ? 44 : 36,
                borderRadius: theme.radius.full,
                borderColor: activo ? 'transparent' : theme.colors.border,
                backgroundColor: activo ? theme.colors.brandSoft : 'transparent',
              },
            ]}
          >
            <Text
              variant="label"
              numberOfLines={1}
              tone="muted"
              style={activo && { color: theme.colors.brandSoftText, fontFamily: theme.typography.fonts.semibold }}
            >
              {opt.label}
            </Text>
          </PressableScale>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
})
