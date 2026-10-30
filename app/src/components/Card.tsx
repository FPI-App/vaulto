import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import { useTheme } from '@/theme'
import { PressableScale } from './PressableScale'

/** Superficie sólida de contenido (listas, formularios). El glass no va aquí (§6.1). */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  padded = true,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  padded?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: theme.mode === 'dark' ? 1 : 0,
    borderColor: theme.colors.border,
    padding: padded ? theme.space.lg : 0,
    ...(theme.mode === 'light' ? theme.shadow.sm : null),
  }
  if (!onPress) return <View style={[base, style]}>{children}</View>
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.985}
      style={[base, style]}
    >
      {children}
    </PressableScale>
  )
}
