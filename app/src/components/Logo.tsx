import { View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { useTheme } from '@/theme'
import { Text } from './Text'

/**
 * Isotipo (§3.1): bóveda redondeada cuya cara es una «V» que también se lee
 * como flujo que baja y se recupera; el punto ámbar es la luz que entra.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const theme = useTheme()
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Vaulto">
      <Defs>
        <LinearGradient id="vaulto-g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={theme.colors.brand[500]} />
          <Stop offset="1" stopColor={theme.colors.brand[700]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="48" height="48" rx="14" fill="url(#vaulto-g)" />
      <Path
        d="M13 15.5 L24 33 L35 15.5"
        stroke="#FFFFFF"
        strokeWidth={4.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="35" cy="15.5" r="3.2" fill={theme.colors.accent[500]} />
    </Svg>
  )
}

/** Lockup horizontal: isotipo + wordmark Semibold con tracking -1 %. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }}>
      <LogoMark size={size} />
      <Text variant="h2" style={{ fontSize: size * 0.62, lineHeight: size * 0.8, letterSpacing: -0.3 }}>
        Vaulto
      </Text>
    </View>
  )
}
