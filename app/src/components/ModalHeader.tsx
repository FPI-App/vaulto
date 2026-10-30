import X from 'lucide-react-native/icons/x'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme'
import { IconButton } from './IconButton'
import { Text } from './Text'

/** Cabecera de pantalla presentada como modal: título + acción de cerrar. */
export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const theme = useTheme()
  return (
    <View style={[styles.row, { marginBottom: theme.space.lg }]}>
      <Text variant="h2" heading={1} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      <IconButton icon={X} label="Cerrar" onPress={onClose} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
})
