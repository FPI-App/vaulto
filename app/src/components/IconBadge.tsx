import type { LucideIcon } from 'lucide-react-native'
import { View } from 'react-native'

import { useTheme } from '@/theme'

/** Ícono en un círculo tintado con el color semántico (10–16% de opacidad). */
export function IconBadge({
  icon: Icon,
  color,
  size = 40,
}: {
  icon: LucideIcon
  color?: string
  size?: number
}) {
  const theme = useTheme()
  const tint = color ?? theme.colors.actionText
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(tint, theme.mode === 'dark' ? 0.16 : 0.1),
      }}
    >
      <Icon size={Math.round(size * 0.5)} color={tint} strokeWidth={1.9} />
    </View>
  )
}

/** `#RRGGBB` + alpha → `rgba()`. Los tokens de color son hex de 6 dígitos. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m?.[1]) return hex
  const n = Number.parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
