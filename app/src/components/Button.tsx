import type { LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, StyleSheet } from 'react-native'

import { onBrand, useTheme } from '@/theme'
import { PressableScale } from './PressableScale'
import { Text } from './Text'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon: Icon,
  size = 'lg',
}: {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: ButtonVariant
  icon?: LucideIcon
  size?: 'md' | 'lg'
}) {
  const theme = useTheme()
  const isDisabled = disabled || loading
  const { bg, fg, border } = colors(theme, variant)

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.base,
        {
          minHeight: size === 'lg' ? 52 : theme.layout.minTouchTarget,
          borderRadius: theme.radius.md,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border === 'transparent' ? 0 : 1,
          opacity: isDisabled ? 0.5 : 1,
          gap: theme.space.sm,
        },
        variant === 'primary' && !isDisabled && theme.shadow.sm,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={18} color={fg} strokeWidth={2} /> : null}
          <Text variant="bodyLg" style={{ color: fg, fontFamily: theme.typography.fonts.semibold }}>
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  )
}

function colors(theme: ReturnType<typeof useTheme>, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { bg: theme.colors.brand[600], fg: onBrand.text, border: 'transparent' }
    case 'secondary':
      return { bg: theme.colors.surface, fg: theme.colors.text, border: theme.colors.border }
    case 'danger':
      return { bg: 'transparent', fg: theme.colors.financial.expense, border: theme.colors.border }
    default:
      return { bg: 'transparent', fg: theme.colors.actionText, border: 'transparent' }
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
})
