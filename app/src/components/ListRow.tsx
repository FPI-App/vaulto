import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme'
import { PressableScale } from './PressableScale'
import { Text } from './Text'

/** Fila de lista: elemento a la izquierda, título/subtítulo y valor a la derecha. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
  divider = false,
}: {
  leading?: ReactNode
  title: string
  subtitle?: string
  trailing?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  divider?: boolean
}) {
  const theme = useTheme()
  const content = (
    <>
      {leading}
      <View style={styles.texts}>
        <Text variant="bodyLg" numberOfLines={1} style={{ fontFamily: theme.typography.fonts.medium }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  )
  const rowStyle = [
    styles.row,
    { gap: theme.space.md, paddingVertical: theme.space.md },
    divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  ]
  if (!onPress) return <View style={rowStyle}>{content}</View>
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      scaleTo={0.985}
      style={rowStyle}
    >
      {content}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  texts: { flex: 1, minWidth: 0 },
  trailing: { alignItems: 'flex-end', flexShrink: 0 },
})
