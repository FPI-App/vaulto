import { useStatus } from '@powersync/react-native'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SyncUploadError } from '@/lib/sync/SyncUploadError'
import { useTheme } from '@/theme'

export function SyncUploadNotice() {
  const theme = useTheme()
  const { uploadError } = useStatus()
  if (!uploadError) return null

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface }}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{
        ...theme.typography.scale.body, color: theme.colors.text,
        paddingHorizontal: theme.layout.screenPadding, paddingVertical: theme.space.sm,
      }}>
        {uploadError instanceof SyncUploadError
          ? uploadError.message
          : 'Hay cambios pendientes de sincronizar. Siguen guardados en este dispositivo.'}
      </Text>
    </SafeAreaView>
  )
}
