import { useState } from 'react'
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'

import { useTheme } from '@/theme'
import { Text } from './Text'

export function Field({
  label,
  hint,
  error,
  onFocus,
  onBlur,
  style,
  ...inputProps
}: { label: string; hint?: string; error?: string | null } & TextInputProps) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  const borderColor = error
    ? theme.colors.financial.expense
    : focused
      ? theme.colors.brand[600]
      : theme.colors.border

  return (
    <View style={styles.wrapper}>
      <Text variant="label" tone="muted" style={{ marginBottom: theme.space.sm }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.mode === 'dark' ? '#5F6B7B' : theme.colors.textMuted}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        style={[
          styles.input,
          theme.typography.scale.bodyLg,
          {
            minHeight: 52,
            borderRadius: theme.radius.sm,
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
          },
          // El anillo de foco lo dibuja el borde; en web se quita el outline nativo.
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
          style,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text accessibilityRole="alert" variant="caption" tone="expense" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 },
  input: { paddingHorizontal: 16 },
})
