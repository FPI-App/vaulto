// Formulario compartido de crear/editar cuenta. No sabe de navegación ni de DB:
// recibe datos iniciales y entrega `DatosCuenta` validados vía onSubmit. Así lo
// reutilizan la pantalla "nueva" y la de edición sin duplicar validación.
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { normalizarMontoInput, type TipoCuenta } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Text } from '@/components/Text'
import { useTheme } from '@/theme'

import type { DatosCuenta } from './data/cuentasRepo'
import { showAlert } from '@/lib/ui/alert'

export interface ValoresIniciales {
  nombre?: string
  tipo?: TipoCuenta
  banco?: string | null
  /** Texto crudo para el input de saldo (ej. "1.250.000"). */
  saldoInicialTexto?: string
}

export function FormularioCuenta({
  inicial,
  guardando,
  ctaLabel,
  onSubmit,
}: {
  inicial?: ValoresIniciales
  guardando: boolean
  ctaLabel: string
  onSubmit: (datos: DatosCuenta) => void
}) {
  const theme = useTheme()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoCuenta>(inicial?.tipo ?? 'banco')
  const [banco, setBanco] = useState(inicial?.banco ?? '')
  const [saldoTexto, setSaldoTexto] = useState(inicial?.saldoInicialTexto ?? '')

  function submit() {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) {
      showAlert('Falta el nombre', 'Ponle un nombre a la cuenta.')
      return
    }
    // Saldo vacío = 0. Si escribió algo, debe ser un monto válido.
    const saldo = saldoTexto.trim() ? normalizarMontoInput(saldoTexto) : '0.00'
    if (saldo === null) {
      showAlert('Saldo inválido', 'Revisa el saldo inicial: usa solo números.')
      return
    }
    onSubmit({
      nombre: nombreLimpio,
      tipo,
      banco: tipo === 'banco' ? banco.trim() || null : null,
      saldo_inicial: saldo,
    })
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingVertical: theme.space.lg, paddingBottom: theme.space['2xl'] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: theme.space.lg }}>
        <Text variant="label" tone="muted" style={{ marginBottom: theme.space.sm }}>
          Tipo
        </Text>
        <SegmentedControl<TipoCuenta>
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'banco', label: 'Banco' },
            { value: 'efectivo', label: 'Efectivo' },
          ]}
        />
      </View>

      <Field
        label="Nombre"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej. Bancolombia ahorros"
        autoCapitalize="sentences"
        returnKeyType="next"
      />

      {tipo === 'banco' ? (
        <Field
          label="Banco (opcional)"
          value={banco ?? ''}
          onChangeText={setBanco}
          placeholder="Ej. Bancolombia"
          autoCapitalize="words"
        />
      ) : null}

      <Field
        label="Saldo inicial"
        value={saldoTexto}
        onChangeText={setSaldoTexto}
        placeholder="0"
        keyboardType="numeric"
        inputMode="numeric"
        hint="Lo que hay en la cuenta hoy. Puedes dejarlo vacío para empezar en cero."
      />

      <Button label={ctaLabel} onPress={submit} loading={guardando} />
    </ScrollView>
  )
}
