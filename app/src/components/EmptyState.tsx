import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme'
import { IconBadge } from './IconBadge'
import { Text } from './Text'

/** Estado vacío reutilizable: ícono + título + pista + acción opcional. */
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string
  hint?: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  const theme = useTheme()
  return (
    <View style={styles.center}>
      {icon ? (
        <View style={{ marginBottom: theme.space.lg }}>
          <IconBadge icon={icon} size={64} />
        </View>
      ) : null}
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {hint ? (
        <Text tone="muted" style={{ textAlign: 'center', marginTop: theme.space.sm, maxWidth: 300 }}>
          {hint}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.space['2xl'], alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
})
