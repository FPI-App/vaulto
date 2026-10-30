import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

import { useTheme } from '@/theme'
import { Text } from './Text'

/** Espacio inferior para que el contenido no quede bajo la tab bar flotante. */
export const TAB_BAR_CLEARANCE = 112

/**
 * Contenedor base de pantalla: fondo del tema, padding lateral de marca (16) y,
 * opcionalmente, cabecera con título grande y scroll.
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  padded = true,
  title,
  subtitle,
  headerRight,
  scroll = false,
  tabBar = false,
}: {
  children: ReactNode
  edges?: Edge[]
  padded?: boolean
  title?: string
  subtitle?: string
  headerRight?: ReactNode
  scroll?: boolean
  /** La pantalla vive bajo la tab bar: reserva su alto al final. */
  tabBar?: boolean
}) {
  const theme = useTheme()
  const header = title ? (
    <View style={[styles.header, { paddingTop: theme.space.lg, paddingBottom: theme.space.xl }]}>
      <View style={{ flex: 1 }}>
        <Text variant="h1" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" style={{ marginTop: 4 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {headerRight}
    </View>
  ) : null
  const padding = padded && { paddingHorizontal: theme.layout.screenPadding + 4 }

  return (
    <SafeAreaView
      edges={tabBar ? edges.filter((e) => e !== 'bottom') : edges}
      style={[styles.root, { backgroundColor: theme.colors.bg }]}
    >
      {scroll ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[padding, { paddingBottom: tabBar ? TAB_BAR_CLEARANCE : theme.space['3xl'] }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, padding, tabBar && { paddingBottom: TAB_BAR_CLEARANCE - 24 }]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
})
