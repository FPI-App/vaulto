import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

import { darkTheme, lightTheme, type Theme } from './tokens'

const ThemeContext = createContext<Theme | null>(null)

/**
 * Provee el tema resuelto (claro/oscuro) según el esquema del sistema.
 * El modo oscuro de Vaulto es azul-tinta, no negro puro (ver BRAND.md §2).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  const theme = useMemo<Theme>(
    () => (scheme === 'dark' ? darkTheme : lightTheme),
    [scheme],
  )

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

/** Hook para consumir el tema activo. Lanza si se usa fuera del ThemeProvider. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext)
  if (!theme) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  }
  return theme
}
