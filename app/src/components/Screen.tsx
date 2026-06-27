import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

import { useTheme } from '@/theme'

/** Contenedor base de pantalla: fondo del tema + padding lateral de marca (16). */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  padded = true,
}: {
  children: ReactNode
  edges?: Edge[]
  padded?: boolean
}) {
  const theme = useTheme()
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: theme.colors.bg }]}
    >
      <View
        style={[
          styles.content,
          padded && { paddingHorizontal: theme.layout.screenPadding },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
})
