import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme'

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
      style={[
        styles.row,
        { backgroundColor: theme.colors.surface2, borderRadius: theme.radius.sm },
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.seg,
              {
                borderRadius: theme.radius.xs,
                backgroundColor: active ? theme.colors.surface : 'transparent',
                opacity: pressed && !active ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={{
                ...theme.typography.scale.label,
                fontFamily: theme.typography.fontFamily,
                color: active ? theme.colors.brand[600] : theme.colors.textMuted,
              }}
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
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
})
