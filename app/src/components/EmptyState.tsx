import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme'

/** Estado vacío reutilizable: título + pista + acción opcional. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  const theme = useTheme()
  return (
    <View style={styles.center}>
      <Text
        style={{
          ...theme.typography.scale.h3,
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.text,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {hint ? (
        <Text
          style={{
            ...theme.typography.scale.body,
            color: theme.colors.textMuted,
            textAlign: 'center',
            marginTop: theme.space.sm,
            maxWidth: 320,
          }}
        >
          {hint}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.space.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
})
