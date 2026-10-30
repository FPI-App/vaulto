import { Text as RNText, type TextProps } from 'react-native'

import { tabularNums, useTheme, type Theme } from '@/theme'

export type TextVariant = keyof Theme['typography']['scale']
export type TextTone =
  | 'default'
  | 'muted'
  | 'brand'
  | 'onBrand'
  | 'income'
  | 'expense'
  | 'debt'
  | 'warning'
  | 'success'

/** Texto de marca: variante tipográfica + tono semántico. Toda la UI pasa por aquí. */
export function Text({
  variant = 'body',
  tone = 'default',
  tabular = false,
  style,
  ...props
}: TextProps & { variant?: TextVariant; tone?: TextTone; tabular?: boolean }) {
  const theme = useTheme()
  return (
    <RNText
      {...props}
      style={[
        theme.typography.scale[variant],
        { color: toneColor(theme, tone) },
        tabular && tabularNums,
        style,
      ]}
    />
  )
}

export function toneColor(theme: Theme, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return theme.colors.textMuted
    case 'brand':
      return theme.colors.actionText
    case 'onBrand':
      return '#FFFFFF'
    case 'income':
    case 'expense':
    case 'debt':
    case 'warning':
    case 'success':
      return theme.colors.financial[tone]
    default:
      return theme.colors.text
  }
}
