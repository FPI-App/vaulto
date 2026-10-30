import type { ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme'

/** Ancho máximo de la columna en web: la app es móvil y así se ve en escritorio. */
const MAX_WIDTH = 480

/**
 * En web centra la app en una columna tipo teléfono sobre un fondo exterior
 * tenue con el degradado de marca. En nativo no agrega nada.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const theme = useTheme()
  if (Platform.OS !== 'web') return <>{children}</>
  const glow = theme.mode === 'dark' ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.10)'
  return (
    <View
      style={[
        styles.outer,
        {
          backgroundColor: theme.colors.backdrop,
          // Solo web: degradado radial muy tenue (§4.4, 8–12 %).
          backgroundImage: `radial-gradient(1200px 600px at 50% -10%, ${glow}, transparent 70%)`,
        } as object,
      ]}
    >
      <View
        style={[
          styles.column,
          {
            backgroundColor: theme.colors.bg,
            borderColor: theme.colors.border,
          },
          theme.shadow.lg,
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
    overflow: 'hidden',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
})
