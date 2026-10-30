import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme'
import { Logo } from './Logo'
import { Screen } from './Screen'
import { Text } from './Text'

/**
 * Marco común de las pantallas de acceso: logo, título, bajada y formulario,
 * con un pie para enlaces secundarios. El formulario va en una superficie
 * sólida; el fondo lleva el halo de marca muy tenue.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const theme = useTheme()
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: theme.layout.screenPadding + 8 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginBottom: theme.space['4xl'] }}>
            <Logo size={36} />
          </View>
          <Text variant="h1" heading={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyLg" tone="muted" style={{ marginTop: theme.space.sm, marginBottom: theme.space['3xl'] }}>
              {subtitle}
            </Text>
          ) : (
            <View style={{ height: theme.space['3xl'] }} />
          )}
          {children}
          {footer ? <View style={{ marginTop: theme.space['2xl'] }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

/** Mensaje de error de formulario: honesto, sin culpar (§8.2). */
export function FormError({ message }: { message: string | null }) {
  const theme = useTheme()
  if (!message) return null
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.colors.dangerSoft,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
        marginBottom: theme.space.lg,
      }}
    >
      <Text style={{ color: theme.colors.dangerText }}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 48, maxWidth: 440, width: '100%', alignSelf: 'center' },
})
