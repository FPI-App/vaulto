import { StyleSheet, View } from 'react-native'
import Hourglass from 'lucide-react-native/icons/hourglass'

import { Screen } from '@/components/Screen'
import { useTheme } from '@/theme'
import { IconBadge } from './IconBadge'
import { Text } from './Text'

/**
 * Placeholder de feature aún no implementada. Indica el dueño (track) en pantalla
 * para que durante el spine quede claro qué falta y de quién es. Se reemplaza por
 * la feature real; no es UI definitiva.
 */
export function Placeholder({
  title,
  owner,
  hint,
}: {
  title: string
  owner?: string
  hint?: string
}) {
  const theme = useTheme()
  return (
    <Screen>
      <View style={styles.center}>
        <View style={{ marginBottom: theme.space.lg }}>
          <IconBadge icon={Hourglass} size={64} />
        </View>
        <Text variant="h2" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        {hint ? (
          <Text tone="muted" style={{ marginTop: theme.space.sm, textAlign: 'center', maxWidth: 300 }}>
            {hint}
          </Text>
        ) : null}
        {owner ? (
          <Text variant="caption" tone="muted" style={{ marginTop: theme.space.lg }}>
            Pendiente · {owner}
          </Text>
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
