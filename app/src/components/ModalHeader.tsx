import X from 'lucide-react-native/icons/x'
import { Pressable, StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme'
import { Text } from './Text'

/** Cabecera de pantalla presentada como modal: título + acción de cerrar. */
export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const theme = useTheme()
  return (
    <View style={[styles.row, { marginBottom: theme.space.lg }]}>
      <Text variant="h2" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        onPress={onClose}
        hitSlop={6}
        style={({ pressed }) => [
          styles.close,
          { backgroundColor: theme.colors.surface2, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <X size={20} color={theme.colors.text} strokeWidth={2} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
})
