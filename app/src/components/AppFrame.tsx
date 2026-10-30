import { useEffect, type ReactNode } from 'react'
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
  useWebDocument(theme.colors.brand[500])
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

/**
 * Ajustes del documento en web que React Native no expresa:
 * - `lang`: el contenido es español; sin esto el lector de pantalla lo lee en inglés (WCAG 3.1.1).
 * - Foco visible solo con teclado (WCAG 2.4.7): react-native-web quita el outline de los pulsables.
 * - Pestañas inactivas: quedan montadas con aria-hidden pero seguían recibiendo
 *   foco con Tab. Se les pone `inert` mientras estén ocultas.
 */
function useWebDocument(focusColor: string) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    document.documentElement.lang = 'es-CO'
    const style = document.createElement('style')
    style.dataset.vaulto = 'focus'
    style.textContent = `
      [role="button"]:focus-visible, [role="tab"]:focus-visible, [role="link"]:focus-visible,
      a:focus-visible, button:focus-visible {
        outline: 2px solid ${focusColor} !important;
        outline-offset: 2px !important;
      }
    `
    document.head.appendChild(style)

    const syncInert = () => {
      document.querySelectorAll<HTMLElement>('[aria-hidden="true"]:not([inert])').forEach((el) => {
        el.inert = true
        el.dataset.vaultoInert = '1'
      })
      document.querySelectorAll<HTMLElement>('[data-vaulto-inert]:not([aria-hidden="true"])').forEach((el) => {
        el.inert = false
        delete el.dataset.vaultoInert
      })
    }
    syncInert()
    const observer = new MutationObserver(syncInert)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-hidden'] })

    return () => {
      observer.disconnect()
      style.remove()
    }
  }, [focusColor])
}
