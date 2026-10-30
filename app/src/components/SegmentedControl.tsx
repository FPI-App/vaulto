import { Pressable, StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme'
import { Text } from './Text'

export interface OpcionSegmento<T extends string> {
  value: T
  label: string
}

/** Control segmentado (2-3 opciones). Reutilizable: tipo de cuenta, de movimiento, etc. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: OpcionSegmento<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const theme = useTheme()
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.row, { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md }]}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[
              styles.seg,
              {
                borderRadius: theme.radius.sm,
                backgroundColor: active ? theme.colors.surface : 'transparent',
              },
              active && theme.shadow.sm,
            ]}
          >
            <Text
              variant="label"
              tone={active ? 'default' : 'muted'}
              style={active && { fontFamily: theme.typography.fonts.semibold }}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, padding: 4 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
})
