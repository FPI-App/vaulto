import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme'

/** Cabecera de pantalla presentada como modal: título + acción de cerrar. */
export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <Text
        style={{
          ...theme.typography.scale.h2,
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.text,
        }}
      >
        {title}
      </Text>
      <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
        <Text
          style={{
            ...theme.typography.scale.label,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.brand[600],
          }}
        >
          Cerrar
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
})
