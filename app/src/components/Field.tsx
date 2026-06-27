import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

import { useTheme } from '@/theme'

export function Field({
  label,
  ...inputProps
}: { label: string } & TextInputProps) {
  const theme = useTheme()
  return (
    <View style={styles.wrapper}>
      <Text
        style={{
          ...theme.typography.scale.label,
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.textMuted,
          marginBottom: theme.space.xs,
        }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            minHeight: theme.layout.minTouchTarget,
            borderRadius: theme.radius.sm,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            ...theme.typography.scale.bodyLg,
          },
        ]}
        {...inputProps}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
  },
})
