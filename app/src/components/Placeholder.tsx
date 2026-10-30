import { StyleSheet, Text, View } from 'react-native'

import { Screen } from '@/components/Screen'
import { useTheme } from '@/theme'

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
        <Text
          style={{
            ...theme.typography.scale.h1,
            color: theme.colors.text,
          }}
        >
          {title}
        </Text>
        {hint ? (
          <Text
            style={{
              ...theme.typography.scale.body,
              color: theme.colors.textMuted,
              marginTop: theme.space.sm,
              textAlign: 'center',
            }}
          >
            {hint}
          </Text>
        ) : null}
        {owner ? (
          <Text
            style={{
              ...theme.typography.scale.caption,
              color: theme.colors.brand[600],
              marginTop: theme.space.lg,
            }}
          >
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
