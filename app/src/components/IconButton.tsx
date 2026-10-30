import type { LucideIcon } from 'lucide-react-native'
import { StyleSheet } from 'react-native'

import { useTheme } from '@/theme'
import { PressableScale } from './PressableScale'

/** Botón circular de solo ícono (volver, cerrar). 44 px: área táctil real también en web, donde hitSlop no aplica. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon
  label: string
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.92}
      style={[styles.base, { backgroundColor: theme.colors.surface2 }]}
    >
      <Icon size={20} color={theme.colors.text} strokeWidth={2} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
})
