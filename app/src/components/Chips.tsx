import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'

import { useTheme } from '@/theme'

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
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => onChange(opt.value)}
            // 36 px visibles + 4 px arriba/abajo = objetivo táctil de 44 px.
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [
              styles.chip,
              {
                minHeight: 36,
                borderRadius: theme.radius.full,
                borderColor: activo ? theme.colors.brand[600] : theme.colors.border,
                backgroundColor: activo ? theme.colors.brand[600] : theme.colors.surface,
                opacity: pressed && !activo ? 0.7 : 1,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                ...theme.typography.scale.label,
                fontFamily: theme.typography.fontFamily,
                color: activo ? '#FFFFFF' : theme.colors.text,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
})
