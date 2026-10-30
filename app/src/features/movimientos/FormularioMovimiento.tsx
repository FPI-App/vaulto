// Formulario de crear/editar movimiento (issue #10). No sabe de navegación ni de
// DB: valida con el dominio de @vaulto/shared y entrega `DatosMovimiento`.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import Wallet from 'lucide-react-native/icons/wallet'
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import {
  MENSAJE_ERROR_MOVIMIENTO,
  normalizarBorrador,
  normalizarMontoInput,
  validarMovimiento,
  type TipoCategoria,
  type TipoMovimiento,
  formatNumero,
} from '@vaulto/shared'

import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Chips } from '@/components/Chips'
import { EmptyState } from '@/components/EmptyState'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Text } from '@/components/Text'
import { CategoriaPicker } from '@/features/categorias/CategoriaPicker'
import { useCategoriaHistorica, useCategorias } from '@/features/categorias/data/useCategorias'
import { useCuentas } from '@/features/cuentas/data/useCuentas'
import { tabularNums, useTheme } from '@/theme'

import type { DatosMovimiento } from './data/movimientosRepo'
import { claveDia, etiquetaDia } from './fechas'
import { showAlert } from '@/lib/ui/alert'

export interface ValoresInicialesMovimiento {
  tipo: TipoMovimiento
  montoTexto: string
  cuenta_id: string | null
  cuenta_destino_id: string | null
  categoria_id: string | null
  fecha: Date
  nota: string | null
}

type OpcionFecha = 'hoy' | 'ayer' | 'otra'

function opcionDeFecha(fecha: Date): OpcionFecha {
  const hoy = new Date()
  if (claveDia(fecha) === claveDia(hoy)) return 'hoy'
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  return claveDia(fecha) === claveDia(ayer) ? 'ayer' : 'otra'
}

export function FormularioMovimiento({
  espacioId,
  inicial,
  guardando,
  ctaLabel,
  onSubmit,
}: {
  espacioId: string | null
  inicial?: ValoresInicialesMovimiento
  guardando: boolean
  ctaLabel: string
  onSubmit: (datos: DatosMovimiento) => void
}) {
  const theme = useTheme()
  const router = useRouter()
  const { cuentas, cargando: cargandoCuentas } = useCuentas(espacioId)
  const { categorias: catIngreso } = useCategorias(espacioId, 'ingreso')
  const { categorias: catEgreso } = useCategorias(espacioId, 'egreso')
  const categoriaOriginal = useCategoriaHistorica(espacioId, inicial?.categoria_id ?? null)

  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? 'egreso')
  const [montoTexto, setMontoTexto] = useState(inicial?.montoTexto ?? '')
  const [cuentaId, setCuentaId] = useState<string | null>(inicial?.cuenta_id ?? null)
  const [destinoId, setDestinoId] = useState<string | null>(inicial?.cuenta_destino_id ?? null)
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial?.categoria_id ?? null)
  const [fecha, setFecha] = useState<Date>(inicial?.fecha ?? new Date())
  const [verCalendarioIOS, setVerCalendarioIOS] = useState(false)
  const [nota, setNota] = useState(inicial?.nota ?? '')

  // Elegibles: cuentas activas + las que el movimiento ya tenía (pueden estar archivadas).
  const cuentasElegibles = useMemo(
    () =>
      cuentas.filter(
        (c) => !c.archivada || c.id === inicial?.cuenta_id || c.id === inicial?.cuenta_destino_id,
      ),
    [cuentas, inicial?.cuenta_id, inicial?.cuenta_destino_id],
  )
  const tipoCategoria = useMemo(() => {
    const mapa = new Map<string, TipoCategoria>()
    for (const c of [...catIngreso, ...catEgreso]) mapa.set(c.id, c.tipo)
    if (categoriaOriginal) mapa.set(categoriaOriginal.id, categoriaOriginal.tipo)
    return mapa
  }, [catIngreso, catEgreso, categoriaOriginal])

  // Cuenta única: se preselecciona para ahorrar un toque en el caso más común.
  const cuentaEfectiva = cuentaId ?? (cuentasElegibles.length === 1 ? cuentasElegibles[0]!.id : null)
  const cuentaSeleccionada = cuentasElegibles.find((c) => c.id === cuentaEfectiva) ?? null
  const montoNormalizado = montoTexto.trim() ? normalizarMontoInput(montoTexto) : null

  if (!cargandoCuentas && cuentasElegibles.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Primero crea una cuenta"
        hint="Los movimientos salen de o entran a una cuenta (banco o efectivo)."
        action={<Button label="Crear cuenta" onPress={() => router.push('/cuentas/nueva')} />}
      />
    )
  }

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo)
    // Las categorías son por tipo: al cambiarlo, la elegida deja de aplicar.
    setCategoriaId(null)
    if (nuevo !== 'transferencia') setDestinoId(null)
  }

  function elegirFecha(opcion: OpcionFecha) {
    const ahora = new Date()
    if (opcion === 'hoy') return setFecha(ahora)
    if (opcion === 'ayer') return setFecha(new Date(ahora.getTime() - 24 * 60 * 60 * 1000))
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fecha,
        mode: 'date',
        onChange: (evento, elegida) => {
          if (evento.type === 'set' && elegida) setFecha(alMediodia(elegida))
        },
      })
    } else {
      setVerCalendarioIOS(true)
    }
  }

  function submit() {
    const borrador = normalizarBorrador({
      tipo,
      monto: montoNormalizado,
      cuenta_id: cuentaEfectiva,
      cuenta_destino_id: destinoId,
      categoria_id: categoriaId,
    })
    const errores = validarMovimiento(borrador, {
      cuentasDisponibles: new Set(cuentasElegibles.map((c) => c.id)),
      tipoCategoria,
    })
    if (errores.length > 0) {
      showAlert('Revisa el movimiento', MENSAJE_ERROR_MOVIMIENTO[errores[0]!])
      return
    }
    onSubmit({
      tipo: borrador.tipo,
      monto: borrador.monto!,
      cuenta_id: borrador.cuenta_id!,
      cuenta_destino_id: borrador.cuenta_destino_id,
      categoria_id: borrador.categoria_id,
      fecha: fecha.toISOString(),
      nota: nota.trim() || null,
    })
  }

  const opcionesCuenta = cuentasElegibles.map((c) => ({ value: c.id, label: c.nombre }))
  const colorMonto =
    tipo === 'ingreso'
      ? theme.colors.financial.income
      : tipo === 'egreso'
        ? theme.colors.financial.expense
        : theme.colors.text

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: theme.space.sm, paddingBottom: theme.space['2xl'] }}
      showsVerticalScrollIndicator={false}
    >
      <SegmentedControl<TipoMovimiento>
        value={tipo}
        onChange={cambiarTipo}
        options={[
          { value: 'egreso', label: 'Gasto' },
          { value: 'ingreso', label: 'Ingreso' },
          { value: 'transferencia', label: 'Transferencia' },
        ]}
      />

      <View style={[styles.montoWrap, { marginVertical: theme.space['3xl'] }]}>
        <Text variant="label" tone="muted" nativeID="etiqueta-monto">
          Monto
        </Text>
        <View style={styles.montoFila}>
          <Text style={[theme.typography.scale.display, { color: colorMonto }]}>$</Text>
          <TextInput
            accessibilityLabelledBy="etiqueta-monto"
            accessibilityLabel="Monto"
            value={montoTexto}
            onChangeText={setMontoTexto}
            placeholder="0"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoFocus={!inicial}
            style={[
              styles.montoInput,
              theme.typography.scale.display,
              tabularNums,
              { color: colorMonto },
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
            ]}
          />
        </View>
        {montoTexto.trim() ? (
          montoNormalizado ? (
            // La vista previa solo aporta si el texto aún no tiene el formato final.
            formatNumero(montoNormalizado) === montoTexto.trim() ? null : (
              <Amount value={montoNormalizado} variant="caption" tone="muted" />
            )
          ) : (
            <Text variant="caption" tone="expense">
              Usa solo números: 25.000 o 25000,50
            </Text>
          )
        ) : null}
      </View>

      <Card style={{ gap: theme.space.xl }}>
        <View>
          <Text variant="label" tone="muted" style={styles.etiqueta}>
            {tipo === 'transferencia' ? 'Desde' : 'Cuenta'}
          </Text>
          <Chips
            accessibilityLabel={tipo === 'transferencia' ? 'Cuenta de origen' : 'Cuenta'}
            options={opcionesCuenta}
            value={cuentaEfectiva}
            onChange={(id) => {
              setCuentaId(id)
              if (id === destinoId) setDestinoId(null)
            }}
          />
          {cuentaSeleccionada ? (
            <View style={[styles.saldo, { marginTop: theme.space.sm }]}>
              <Text variant="caption" tone="muted">
                Saldo actual:
              </Text>
              <Amount
                value={cuentaSeleccionada.saldo}
                variant="caption"
                tone="muted"
                style={{ fontFamily: theme.typography.fonts.medium }}
              />
            </View>
          ) : null}
        </View>

        {tipo === 'transferencia' ? (
          <View>
            <Text variant="label" tone="muted" style={styles.etiqueta}>
              Hacia
            </Text>
            <Chips
              accessibilityLabel="Cuenta de destino"
              options={opcionesCuenta.filter((o) => o.value !== cuentaEfectiva)}
              value={destinoId}
              onChange={setDestinoId}
            />
          </View>
        ) : (
          <View>
            <Text variant="label" tone="muted" style={styles.etiqueta}>
              Categoría (opcional)
            </Text>
            <CategoriaPicker
              espacioId={espacioId}
              tipo={tipo}
              value={categoriaId}
              onChange={setCategoriaId}
              extra={categoriaOriginal?.tipo === tipo ? categoriaOriginal : null}
            />
          </View>
        )}

        <View>
          <Text variant="label" tone="muted" style={styles.etiqueta}>
            Fecha
          </Text>
          <Chips<OpcionFecha>
            accessibilityLabel="Fecha"
            value={opcionDeFecha(fecha)}
            onChange={elegirFecha}
            options={[
              { value: 'hoy', label: 'Hoy' },
              { value: 'ayer', label: 'Ayer' },
              {
                value: 'otra',
                label: opcionDeFecha(fecha) === 'otra' ? etiquetaDia(fecha) : 'Otra fecha',
              },
            ]}
          />
          {verCalendarioIOS ? (
            <DateTimePicker
              value={fecha}
              mode="date"
              display="inline"
              locale="es-CO"
              onChange={(evento, elegida) => {
                if (evento.type === 'set' && elegida) setFecha(alMediodia(elegida))
                setVerCalendarioIOS(false)
              }}
            />
          ) : null}
        </View>

        <Field
          label="Nota (opcional)"
          value={nota}
          onChangeText={setNota}
          placeholder="Ej. Mercado del mes en D1"
          autoCapitalize="sentences"
          maxLength={140}
        />
      </Card>

      <View style={{ marginTop: theme.space['2xl'] }}>
        <Button label={ctaLabel} onPress={submit} loading={guardando} />
      </View>
    </ScrollView>
  )
}

/**
 * Fecha elegida en calendario → mediodía local. El picker entrega medianoche, y
 * a medianoche cualquier desfase de zona horaria corre el movimiento al día
 * anterior; a mediodía quedan 12 h de margen hacia ambos bordes.
 */
function alMediodia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
}

const styles = StyleSheet.create({
  montoWrap: { alignItems: 'flex-start', gap: 4 },
  montoFila: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  // minWidth 0: en web un input flex no se encoge por debajo de su ancho intrínseco y desborda.
  montoInput: { flex: 1, minWidth: 0, paddingVertical: 4 },
  etiqueta: { marginBottom: 8 },
  saldo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
})
