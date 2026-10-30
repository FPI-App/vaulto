import { formatCOP } from '@vaulto/shared'
import { useState } from 'react'
import { Platform, type TextProps } from 'react-native'

import { useTheme } from '@/theme'

import { Text, type TextTone, type TextVariant } from './Text'

export type AmountKind = 'income' | 'expense' | 'transfer' | 'debt' | 'neutral'

const TONE: Record<AmountKind, TextTone> = {
  income: 'income',
  expense: 'expense',
  debt: 'debt',
  transfer: 'default',
  neutral: 'default',
}

/**
 * Monto en COP con dígitos tabulares. Ingreso y egreso llevan signo explícito
 * además del color: el color nunca va solo (§4.3, daltonismo).
 */
export function Amount({
  value,
  currency = 'COP',
  kind = 'neutral',
  variant = 'bodyLg',
  tone,
  ...props
}: Omit<TextProps, 'children'> & {
  value: string | number
  /** ISO 4217. COP sin decimales; otras monedas con 2 (ver formatCOP). */
  currency?: string
  kind?: AmountKind
  variant?: TextVariant
  tone?: TextTone
}) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  const sign = kind === 'income' ? '+ ' : kind === 'expense' ? '− ' : ''
  const text = sign + formatCOP(Number.isFinite(n) && sign ? Math.abs(n) : value, currency)
  const theme = useTheme()
  const [width, setWidth] = useState(0)
  // En web `adjustsFontSizeToFit` no existe: se estima el ancho del texto
  // (dígitos tabulares de Inter ≈ 0,62 em) y se reduce la fuente para que quepa.
  const fitOnWeb = Platform.OS === 'web' && props.adjustsFontSizeToFit
  const base = (props.style as { fontSize?: number } | undefined)?.fontSize ?? theme.typography.scale[variant].fontSize
  const fitted = fitOnWeb && width > 0 ? Math.min(base, width / (text.length * 0.62)) : base
  const fitStyle = fitOnWeb && fitted < base ? { fontSize: fitted, lineHeight: Math.round(fitted * 1.2) } : null
  return (
    <Text
      variant={variant}
      tone={tone ?? TONE[kind]}
      tabular
      numberOfLines={1}
      {...props}
      onLayout={(e) => {
        if (fitOnWeb) setWidth(e.nativeEvent.layout.width)
        props.onLayout?.(e)
      }}
      style={[props.style, fitStyle]}
    >
      {text}
    </Text>
  )
}
