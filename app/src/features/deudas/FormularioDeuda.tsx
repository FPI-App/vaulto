import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { normalizarMontoInput } from '@vaulto/shared'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Text } from '@/components/Text'
import { useTheme } from '@/theme'

import type { DatosDeuda } from './data/deudasRepo'
import { showAlert } from '@/lib/ui/alert'

export function FormularioDeuda({
  inicial,
  guardando,
  ctaLabel,
  onSubmit,
}: {
  inicial?: Partial<DatosDeuda>
  guardando: boolean
  ctaLabel: string
  onSubmit: (datos: DatosDeuda) => void
}) {
  const theme = useTheme()
  const [direccion, setDireccion] = useState<DatosDeuda['direccion']>(inicial?.direccion ?? 'yo_debo')
  const [contraparte, setContraparte] = useState(inicial?.contraparte ?? '')
  const [monto, setMonto] = useState(inicial?.monto_inicial ?? '')
  const [fechaLimite, setFechaLimite] = useState(inicial?.fecha_limite ?? '')
  const [prioridad, setPrioridad] = useState(String(inicial?.prioridad ?? 0))
  const [nota, setNota] = useState(inicial?.nota ?? '')

  function submit() {
    const montoNormalizado = normalizarMontoInput(monto)
    if (!contraparte.trim() || !montoNormalizado || Number(montoNormalizado) <= 0) {
      showAlert('Revisa los datos', 'Escribe la contraparte y un monto mayor que cero.')
      return
    }
    const fecha = fechaLimite.trim()
    if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) || new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) !== fecha)) {
      showAlert('Fecha inválida', 'Usa el formato AAAA-MM-DD.')
      return
    }
    const nivel = Number(prioridad)
    if (!prioridad.trim() || !Number.isInteger(nivel) || nivel < 0 || nivel > 5) {
      showAlert('Prioridad inválida', 'Elige un valor entre 0 y 5.')
      return
    }
    onSubmit({
      direccion,
      contraparte: contraparte.trim(),
      monto_inicial: montoNormalizado,
      fecha_limite: fecha || null,
      prioridad: nivel,
      nota: nota.trim() || null,
    })
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: theme.space.lg, paddingBottom: theme.space['3xl'] }}
    >
      <Card>
        <View style={{ marginBottom: theme.space.lg }}>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.space.xs }}>
            Dirección
          </Text>
          <SegmentedControl
            value={direccion}
            onChange={setDireccion}
            options={[
              { value: 'yo_debo', label: 'Yo debo' },
              { value: 'me_deben', label: 'Me deben' },
            ]}
          />
        </View>
        <Field label="Persona o entidad" value={contraparte} onChangeText={setContraparte} placeholder="Ej. Laura" />
        <Field label="Monto inicial" value={monto} onChangeText={setMonto} placeholder="0" keyboardType="decimal-pad" />
        <Field label="Fecha límite (opcional)" value={fechaLimite} onChangeText={setFechaLimite} placeholder="AAAA-MM-DD" />
        <Field label="Prioridad (0 a 5)" value={prioridad} onChangeText={setPrioridad} keyboardType="number-pad" />
        <Field label="Nota (opcional)" value={nota} onChangeText={setNota} placeholder="Detalle" multiline />
      </Card>
      <View style={{ marginTop: theme.space.xl }}>
        <Button label={ctaLabel} onPress={submit} loading={guardando} />
      </View>
    </ScrollView>
  )
}
