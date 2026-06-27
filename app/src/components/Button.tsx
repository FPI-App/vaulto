import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

import { useTheme } from '@/theme'

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'ghost'
}) {
  const theme = useTheme()
  const isDisabled = disabled || loading
  const isPrimary = variant === 'primary'

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.layout.minTouchTarget,
          borderRadius: theme.radius.md,
          backgroundColor: isPrimary
            ? pressed
              ? theme.colors.brand[700]
              : theme.colors.brand[600]
            : 'transparent',
          opacity: isDisabled ? 0.5 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.colors.brand[100] : theme.colors.brand[600]} />
      ) : (
        <Text
          style={{
            ...theme.typography.scale.label,
            fontFamily: theme.typography.fontFamily,
            color: isPrimary ? '#FFFFFF' : theme.colors.brand[600],
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
})
