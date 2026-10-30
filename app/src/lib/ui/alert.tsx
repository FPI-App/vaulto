import { useSyncExternalStore } from 'react'
import { Alert, Modal, Platform, Pressable, StyleSheet, View, type AlertButton } from 'react-native'

import { Button } from '@/components/Button'
import { Text } from '@/components/Text'
import { useTheme } from '@/theme'

interface PendingAlert {
  id: number
  title: string
  message?: string
  buttons: AlertButton[]
}

// En react-native-web `Alert.alert` es una función vacía: confirmaciones y
// errores desaparecían sin aviso. En web se pintan con <AlertHost /> (§6.1:
// modal con fondo velado); en nativo se delega al diálogo del sistema.
let queue: PendingAlert[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Misma firma que `Alert.alert`, pero funciona también en web. */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons)
    return
  }
  queue = [...queue, { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: 'Entendido' }] }]
  emit()
}

function dismiss(id: number) {
  queue = queue.filter((a) => a.id !== id)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Montar una vez en el layout raíz. En nativo no pinta nada. */
export function AlertHost() {
  const current = useSyncExternalStore(subscribe, () => queue[0], () => undefined)
  const theme = useTheme()
  if (!current) return null

  const cancel = current.buttons.find((b) => b.style === 'cancel')
  const close = (button?: AlertButton) => {
    dismiss(current.id)
    button?.onPress?.()
  }
  // Orden de lectura: la acción principal al final, como en el sistema.
  const ordered = [...current.buttons.filter((b) => b.style === 'cancel'), ...current.buttons.filter((b) => b.style !== 'cancel')]

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(cancel)}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Cerrar diálogo"
          style={StyleSheet.absoluteFill}
          onPress={() => close(cancel)}
        />
        <View
          accessibilityRole="alert"
          aria-modal
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
            theme.shadow.lg,
          ]}
        >
          <Text variant="h3" heading={2}>
            {current.title}
          </Text>
          {current.message ? (
            <Text tone="muted" style={{ marginTop: theme.space.sm }}>
              {current.message}
            </Text>
          ) : null}
          <View style={[styles.actions, { marginTop: theme.space['2xl'], gap: theme.space.sm }]}>
            {ordered.map((b, i) => (
              <View key={`${b.text}-${i}`} style={styles.action}>
                <Button
                  label={b.text ?? 'Aceptar'}
                  size="md"
                  variant={b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'secondary' : 'primary'}
                  onPress={() => close(b)}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(6,9,15,0.55)',
    // Solo web: el velo difumina lo de atrás (§6.1, modales).
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as object) : null),
  },
  card: { width: '100%', maxWidth: 380, padding: 24, borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 120 },
})
