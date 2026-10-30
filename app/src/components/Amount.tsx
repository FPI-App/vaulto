import { formatCOP } from '@vaulto/shared'
import type { TextProps } from 'react-native'

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
  kind = 'neutral',
  variant = 'bodyLg',
  tone,
  ...props
}: Omit<TextProps, 'children'> & {
  value: string | number
  kind?: AmountKind
  variant?: TextVariant
  tone?: TextTone
}) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  const sign = kind === 'income' ? '+ ' : kind === 'expense' ? '− ' : ''
  const text = sign + formatCOP(Number.isFinite(n) && sign ? Math.abs(n) : value)
  return (
    <Text variant={variant} tone={tone ?? TONE[kind]} tabular numberOfLines={1} {...props}>
      {text}
    </Text>
  )
}
