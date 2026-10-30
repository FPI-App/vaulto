// Lista de movimientos con filtros (issue #10). Dueño: lmilo (Track A).
import { useRouter } from 'expo-router'
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right'
import Plus from 'lucide-react-native/icons/plus'
import ReceiptText from 'lucide-react-native/icons/receipt-text'
import Tags from 'lucide-react-native/icons/tags'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import {
  formatCOP,
  rangoDeMes,
  resumenMovimientos,
  signoMovimiento,
  type TipoMovimiento,
} from '@vaulto/shared'

import { Amount, type AmountKind } from '@/components/Amount'
import { Button } from '@/components/Button'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Card } from '@/components/Card'
import { Chips } from '@/components/Chips'
import { EmptyState } from '@/components/EmptyState'
import { IconBadge } from '@/components/IconBadge'
import { ListRow } from '@/components/ListRow'
import { Screen, TAB_BAR_CLEARANCE } from '@/components/Screen'
import { Text } from '@/components/Text'
import { useCategorias } from '@/features/categorias/data/useCategorias'
import { useCuentas } from '@/features/cuentas/data/useCuentas'
import { useEspacioActual } from '@/lib/espacio/useEspacioActual'
import { useTheme } from '@/theme'

import { useMovimientos, type MovimientoListado } from './data/useMovimientos'
import { claveDia, etiquetaDia, parseFecha } from './fechas'

type Periodo = 'mes' | 'mes_anterior' | 'todo'
type FiltroTipo = 'todos' | TipoMovimiento
const TODAS = '__todas__'

export function MovimientosScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { espacioId } = useEspacioActual()
  const { cuentas } = useCuentas(espacioId)

  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [cuentaId, setCuentaId] = useState<string>(TODAS)
  const [categoriaId, setCategoriaId] = useState<string>(TODAS)
  // El filtro de categoría solo aplica a gastos o ingresos (las transferencias no tienen).
  const tipoConCategoria = tipo === 'ingreso' || tipo === 'egreso' ? tipo : null
  const { categorias } = useCategorias(espacioId, tipoConCategoria ?? 'egreso')

  const rango = useMemo(() => {
    if (periodo === 'todo') return { desde: null, hasta: null }
    return rangoDeMes(new Date(), periodo === 'mes' ? 0 : -1)
  }, [periodo])

  const cuentaFiltro = cuentaId === TODAS ? null : cuentaId
  const categoriaFiltro = tipoConCategoria && categoriaId !== TODAS ? categoriaId : null
  const { movimientos, cargando } = useMovimientos(espacioId, {
    tipo: tipo === 'todos' ? null : tipo,
    cuentaId: cuentaFiltro,
    categoriaId: categoriaFiltro,
    ...rango,
  })

  const resumen = useMemo(() => resumenMovimientos(movimientos, cuentaFiltro), [movimientos, cuentaFiltro])
  const secciones = useMemo(() => agruparPorDia(movimientos), [movimientos])

  const hayFiltros = periodo !== 'todo' || tipo !== 'todos' || cuentaFiltro !== null || categoriaFiltro !== null

  return (
    <Screen
      edges={['top']}
      title="Movimientos"
      headerRight={
        <View style={styles.headerAcciones}>
          <Button
            label="Categorías"
            variant="ghost"
            size="md"
            icon={Tags}
            onPress={() => router.push('/categorias')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nuevo movimiento"
            onPress={() => router.push('/movimientos/nuevo')}
            hitSlop={2}
            style={({ pressed }) => [
              styles.nuevo,
              { backgroundColor: theme.colors.brand[600], opacity: pressed ? 0.85 : 1 },
              theme.shadow.sm,
            ]}
          >
            <Plus size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>
      }
    >
      <FlatList
        data={secciones}
        keyExtractor={(s) => s.clave}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.space.sm }}>
            <View style={{ gap: theme.space.sm, marginBottom: theme.space.lg }}>
              <Chips<Periodo>
                accessibilityLabel="Periodo"
                value={periodo}
                onChange={setPeriodo}
                options={[
                  { value: 'mes', label: 'Este mes' },
                  { value: 'mes_anterior', label: 'Mes pasado' },
                  { value: 'todo', label: 'Todo' },
                ]}
              />
              <Chips<FiltroTipo>
                accessibilityLabel="Tipo de movimiento"
                value={tipo}
                onChange={(nuevo) => {
                  setTipo(nuevo)
                  setCategoriaId(TODAS)
                }}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'egreso', label: 'Gastos' },
                  { value: 'ingreso', label: 'Ingresos' },
                  { value: 'transferencia', label: 'Transferencias' },
                ]}
              />
              {cuentas.length > 1 ? (
                <Chips
                  accessibilityLabel="Cuenta"
                  value={cuentaId}
                  onChange={setCuentaId}
                  options={[{ value: TODAS, label: 'Todas las cuentas' }, ...cuentas.map((c) => ({ value: c.id, label: c.nombre }))]}
                />
              ) : null}
              {tipoConCategoria && categorias.length > 0 ? (
                <Chips
                  accessibilityLabel="Categoría"
                  value={categoriaId}
                  onChange={setCategoriaId}
                  options={[{ value: TODAS, label: 'Todas las categorías' }, ...categorias.map((c) => ({ value: c.id, label: c.nombre }))]}
                />
              ) : null}
            </View>

            {movimientos.length > 0 ? (
              <Card style={styles.resumen}>
                <Total etiqueta="Entradas" valor={resumen.entradas} kind="income" />
                <Total etiqueta="Salidas" valor={resumen.salidas} kind="expense" />
                <Total etiqueta="Neto" valor={resumen.neto} kind="neutral" />
              </Card>
            ) : null}
          </View>
        }
        renderItem={({ item: seccion }) => (
          <View style={{ marginTop: theme.space.lg }}>
            <Text variant="caption" tone="muted" accessibilityRole="header" style={{ marginBottom: theme.space.sm }}>
              {seccion.titulo}
            </Text>
            <Card padded={false} style={{ paddingHorizontal: theme.space.lg }}>
              {seccion.data.map((m, i) => (
                <FilaMovimiento
                  key={m.id}
                  mov={m}
                  cuentaFiltro={cuentaFiltro}
                  divider={i < seccion.data.length - 1}
                  onPress={() => router.push(`/movimientos/${m.id}`)}
                />
              ))}
            </Card>
          </View>
        )}
        ListEmptyComponent={
          cargando ? undefined : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={ReceiptText}
                title={hayFiltros ? 'Nada con estos filtros' : 'Sin movimientos todavía'}
                hint={
                  hayFiltros
                    ? 'Prueba con otro periodo o quita el filtro de cuenta o tipo.'
                    : 'Registra tu primer gasto, ingreso o transferencia y aparecerá aquí.'
                }
                action={<Button label="Registrar movimiento" onPress={() => router.push('/movimientos/nuevo')} />}
              />
            </View>
          )
        }
      />
    </Screen>
  )
}

function Total({ etiqueta, valor, kind }: { etiqueta: string; valor: string; kind: AmountKind }) {
  return (
    <View style={styles.total}>
      <Text variant="caption" tone="muted">
        {etiqueta}
      </Text>
      <Amount value={valor} kind={kind} adjustsFontSizeToFit minimumFontScale={0.7} />
    </View>
  )
}

function FilaMovimiento({
  mov,
  cuentaFiltro,
  divider,
  onPress,
}: {
  mov: MovimientoListado
  cuentaFiltro: string | null
  divider: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  const signo = signoMovimiento(mov, cuentaFiltro)
  const esTransferencia = mov.tipo === 'transferencia'

  const titulo = esTransferencia
    ? 'Transferencia'
    : (mov.categoria_nombre ?? (mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'))
  const detalle = esTransferencia
    ? `${mov.cuenta_nombre ?? 'Cuenta eliminada'} → ${mov.cuenta_destino_nombre ?? 'Cuenta eliminada'}`
    : [mov.cuenta_nombre ?? 'Cuenta eliminada', mov.nota].filter(Boolean).join(' · ')
  const kind: AmountKind = signo === 1 ? 'income' : signo === -1 ? 'expense' : 'transfer'
  const signoTexto = signo === 1 ? 'Ingreso' : signo === -1 ? 'Egreso' : 'Transferencia'
  const montoTexto = formatCOP(mov.monto, mov.currency)

  return (
    <ListRow
      divider={divider}
      onPress={onPress}
      accessibilityLabel={`${titulo}. ${detalle}. ${signoTexto} ${montoTexto}${mov.pago_id ? '. Abono de deuda, solo lectura' : ''}`}
      leading={
        esTransferencia ? (
          <IconBadge icon={ArrowLeftRight} color={theme.colors.textMuted} />
        ) : (
          <CategoriaIcon icono={mov.categoria_icono} color={mov.categoria_color} />
        )
      }
      title={titulo}
      subtitle={detalle}
      trailing={
        <Amount
          value={mov.monto}
          kind={kind}
          variant="bodyLg"
          style={{ fontFamily: theme.typography.fonts.semibold }}
        />
      }
    />
  )
}

interface SeccionDia {
  clave: string
  titulo: string
  data: MovimientoListado[]
}

const FORMATO_LARGO = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const FORMATO_LARGO_ANIO = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** «Hoy», «Ayer» o fecha natural: «lunes 27 de octubre». */
function tituloDia(fecha: Date): string {
  const corto = etiquetaDia(fecha)
  if (corto === 'Hoy' || corto === 'Ayer') return corto
  const formato = fecha.getFullYear() === new Date().getFullYear() ? FORMATO_LARGO : FORMATO_LARGO_ANIO
  return formato.format(fecha).replace(',', '')
}

/** La lista ya viene ordenada por fecha desc: basta cortar cuando cambia el día local. */
function agruparPorDia(movs: MovimientoListado[]): SeccionDia[] {
  const secciones: SeccionDia[] = []
  let claveActual = ''
  for (const m of movs) {
    const fecha = parseFecha(m.fecha)
    const clave = claveDia(fecha)
    if (clave !== claveActual) {
      secciones.push({ clave, titulo: tituloDia(fecha), data: [] })
      claveActual = clave
    }
    secciones[secciones.length - 1]!.data.push(m)
  }
  return secciones
}

const styles = StyleSheet.create({
  headerAcciones: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nuevo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  resumen: { flexDirection: 'row', gap: 12 },
  total: { flex: 1, gap: 2 },
  emptyWrap: { minHeight: 320, flexDirection: 'row' },
})
